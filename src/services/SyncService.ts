/**
 * SyncService - Simplified bidirectional synchronization service
 *
 * Consolidated from:
 * - Original SyncService
 * - BackgroundSyncService (without background complexity)
 * - BackgroundTaskManager (without background complexity)
 *
 * Features:
 * - Simple two-way sync between local and remote
 * - Network-aware sync with retry logic
 * - Conflict resolution with Last-Write-Wins
 * - App lifecycle sync (no background tasks)
 * - Integration with consolidated services
 */

import { readeckApiService } from './ReadeckApiService';
import { localStorageService } from './LocalStorageService';
import { ShareService } from './ShareService';
import { store } from '../store';
import { errorHandler, ErrorCategory } from '../utils/errorHandler';
import {
  startSync,
  syncProgress,
  syncSuccess,
  syncError,
  addConflict,
  resolveConflict,
  updateSyncStats,
  updateNetworkStatus,
} from '../store/slices/syncSlice';
import {
  SyncConfiguration,
  SyncPhase,
  ConflictType,
  ConflictResolutionStrategy,
  NetworkType,
} from '../types/sync';
import { Article } from '../types';
import { resolveConflict as resolveArticleConflict } from '../utils/conflictResolution';
import { connectivityManager } from '../utils/connectivityManager';
import { DatabaseUtilityFunctions } from './DatabaseService';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  conflictCount: number;
  errorCount: number;
  duration: number;
  phase: SyncPhase;
  errors: Array<{
    operation: string;
    error: string;
    retryable: boolean;
  }>;
}

export interface SimpleSyncServiceInterface {
  initialize(): Promise<void>;
  startFullSync(forceSync?: boolean): Promise<SyncResult>;
  syncUp(): Promise<SyncResult>;
  syncDown(): Promise<SyncResult>;
  isSyncRunning(): boolean;
  stopSync(): Promise<void>;
  updateConfiguration(config: Partial<SyncConfiguration>): void;
  getConfiguration(): SyncConfiguration;
  getSyncStats(): Promise<any>;
  triggerManualSync(): Promise<void>;
  backfillMissingContent(): Promise<{
    processed: number;
    updated: number;
    errors: number;
  }>;
}

/**
 * SyncService - Simplified sync management without background complexity
 */
class SyncService implements SimpleSyncServiceInterface {
  private static instance: SyncService;
  private isRunning = false;
  private config: SyncConfiguration;
  private abortController: AbortController | null = null;

  private constructor() {
    // Initialize with mobile-friendly configuration
    this.config = {
      backgroundSyncEnabled: false, // Disabled - no background tasks
      syncInterval: 30, // 30 minutes for manual sync intervals
      syncOnWifiOnly: false,
      syncOnCellular: true,
      downloadImages: true,
      fullTextSync: true,
      conflictResolutionStrategy: ConflictResolutionStrategy.LAST_WRITE_WINS,
      batchSize: 25, // Smaller batch size for mobile
    };
  }

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  async initialize(): Promise<void> {
    try {
      console.log('[SyncService] Initializing simplified sync service...');

      // Get current sync configuration from Redux store
      const state = store.getState();
      this.config = { ...this.config, ...state.sync.config };

      // Set up network monitoring
      this.setupNetworkMonitoring();

      // Process any pending sync operations
      await this.processPendingSyncOperations();

      console.log(
        '[SyncService] Simplified sync service initialized successfully'
      );
    } catch (error) {
      console.error('[SyncService] Failed to initialize:', error);
      throw error;
    }
  }

  updateConfiguration(newConfig: Partial<SyncConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[SyncService] Configuration updated:', newConfig);
  }

  getConfiguration(): SyncConfiguration {
    return { ...this.config };
  }

  async startFullSync(forceSync = false): Promise<SyncResult> {
    if (this.isRunning && !forceSync) {
      throw new Error('Sync already in progress');
    }

    // Check connectivity before starting sync
    const networkStatus = await connectivityManager.checkNetworkStatus();
    if (!networkStatus.isConnected) {
      console.log('[SyncService] Cannot sync - server unreachable');
      store.dispatch(
        syncError({
          error: 'Server is unreachable. Please check your connection.',
          phase: SyncPhase.CHECKING_CONNECTION,
          isRetryable: true,
        })
      );
      throw new Error('Server is unreachable. Please check your connection.');
    }

    console.log('[SyncService] Starting full sync...');

    this.isRunning = true;
    this.abortController = new AbortController();

    const startTime = Date.now();

    store.dispatch(
      startSync({
        fullSync: true,
        forceSync,
        syncOptions: this.config,
      })
    );

    try {
      const result = await this.executeFullSync();
      const duration = Date.now() - startTime;

      store.dispatch(
        syncSuccess({
          syncDuration: duration,
          itemsProcessed: result.syncedCount,
          conflictsDetected: result.conflictCount,
          syncTime: new Date().toISOString(),
        })
      );

      store.dispatch(
        updateSyncStats({
          articlesCreated: result.syncedCount,
          articlesUpdated: 0,
          articlesDeleted: 0,
        })
      );

      console.log(`[SyncService] Full sync completed in ${duration}ms`);

      return {
        ...result,
        duration,
        success: true,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      const handledError = errorHandler.handleError(error, {
        category: ErrorCategory.SYNC_OPERATION,
        context: {
          actionType: 'full_sync',
          syncPhase: SyncPhase.FINALIZING,
        },
      });

      store.dispatch(
        syncError({
          error: handledError.message,
          errorCode: 'SYNC_FAILED',
          phase: SyncPhase.FINALIZING,
          retryable: this.isRetryableError(error),
        })
      );

      return {
        success: false,
        syncedCount: 0,
        conflictCount: 0,
        errorCount: 1,
        duration,
        phase: SyncPhase.FINALIZING,
        errors: [
          {
            operation: 'full_sync',
            error: error.message,
            retryable: this.isRetryableError(error),
          },
        ],
      };
    } finally {
      this.isRunning = false;
      this.abortController = null;
    }
  }

  private async executeFullSync(): Promise<SyncResult> {
    const syncResult: SyncResult = {
      success: true,
      syncedCount: 0,
      conflictCount: 0,
      errorCount: 0,
      duration: 0,
      phase: SyncPhase.INITIALIZING,
      errors: [],
    };

    try {
      // Phase 1: Upload local changes
      store.dispatch(
        syncProgress({
          phase: SyncPhase.UPLOADING_CHANGES,
          totalItems: 0,
          processedItems: 0,
          currentItem: 'Detecting local changes...',
        })
      );

      const uploadResult = await this.syncUp();
      syncResult.syncedCount += uploadResult.syncedCount;
      syncResult.conflictCount += uploadResult.conflictCount;
      syncResult.errorCount += uploadResult.errorCount;
      syncResult.errors.push(...uploadResult.errors);

      // Phase 2: Download remote changes
      store.dispatch(
        syncProgress({
          phase: SyncPhase.DOWNLOADING_UPDATES,
          totalItems: 0,
          processedItems: 0,
          currentItem: 'Fetching remote updates...',
        })
      );

      const downloadResult = await this.syncDown();
      syncResult.syncedCount += downloadResult.syncedCount;
      syncResult.conflictCount += downloadResult.conflictCount;
      syncResult.errorCount += downloadResult.errorCount;
      syncResult.errors.push(...downloadResult.errors);

      // Phase 3: Resolve conflicts if any
      if (syncResult.conflictCount > 0) {
        store.dispatch(
          syncProgress({
            phase: SyncPhase.RESOLVING_CONFLICTS,
            totalItems: syncResult.conflictCount,
            processedItems: 0,
            currentItem: 'Resolving conflicts...',
          })
        );

        await this.resolveAllConflicts();
      }

      // Phase 4: Process pending shared URLs
      await this.processPendingSharedUrls();

      // Phase 5: Backfill missing content
      store.dispatch(
        syncProgress({
          phase: SyncPhase.FINALIZING,
          totalItems: syncResult.syncedCount,
          processedItems: syncResult.syncedCount,
          currentItem: 'Checking for missing content...',
        })
      );

      // Attempt to backfill any missing content
      try {
        const backfillResult = await this.backfillMissingContent();
        if (backfillResult.updated > 0) {
          console.log(`[SyncService] Backfilled content for ${backfillResult.updated} articles`);
        }
      } catch (error) {
        console.error('[SyncService] Content backfill failed:', error);
        // Don't fail the sync if backfill fails
      }

      // Phase 6: Finalize sync
      store.dispatch(
        syncProgress({
          phase: SyncPhase.FINALIZING,
          totalItems: syncResult.syncedCount,
          processedItems: syncResult.syncedCount,
          currentItem: 'Finalizing sync...',
        })
      );

      syncResult.phase = SyncPhase.FINALIZING;

      // Set success to false if there were any errors
      if (syncResult.errorCount > 0) {
        syncResult.success = false;
      }

      return syncResult;
    } catch (error) {
      syncResult.success = false;
      syncResult.errorCount++;
      syncResult.errors.push({
        operation: 'execute_full_sync',
        error: error.message,
        retryable: this.isRetryableError(error),
      });
      throw error;
    }
  }

  async syncUp(): Promise<SyncResult> {
    console.log('[SyncService] Starting sync up (local -> remote)...');

    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      conflictCount: 0,
      errorCount: 0,
      duration: 0,
      phase: SyncPhase.UPLOADING_CHANGES,
      errors: [],
    };

    try {
      await localStorageService.initialize();

      // Get locally modified articles
      const modifiedArticlesResult = await localStorageService.getArticles({
        isModified: true,
        sortBy: 'updated_at',
        sortOrder: 'ASC',
      });

      if (!modifiedArticlesResult.success) {
        throw new Error(
          `Failed to get modified articles: ${modifiedArticlesResult.error}`
        );
      }

      const modifiedArticles = modifiedArticlesResult.data?.items || [];
      console.log(
        `[SyncService] Found ${modifiedArticles.length} locally modified articles`
      );

      // Process articles in batches
      const batches = this.createBatches(
        modifiedArticles,
        this.config.batchSize
      );

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];

        store.dispatch(
          syncProgress({
            phase: SyncPhase.UPLOADING_CHANGES,
            totalItems: modifiedArticles.length,
            processedItems: i * this.config.batchSize,
            currentItem: `Processing batch ${i + 1}/${batches.length}`,
          })
        );

        const batchResult = await this.uploadBatch(batch);
        result.syncedCount += batchResult.syncedCount;
        result.conflictCount += batchResult.conflictCount;
        result.errorCount += batchResult.errorCount;
        result.errors.push(...batchResult.errors);

        // Check for abort signal
        if (this.abortController?.signal.aborted) {
          throw new Error('Sync aborted by user');
        }
      }

      console.log(
        `[SyncService] Sync up completed: ${result.syncedCount} synced, ${result.conflictCount} conflicts`
      );
      return result;
    } catch (error) {
      console.error('[SyncService] Sync up failed:', error);
      result.success = false;
      result.errorCount++;
      result.errors.push({
        operation: 'sync_up',
        error: error.message,
        retryable: this.isRetryableError(error),
      });
      return result;
    }
  }

  async syncDown(): Promise<SyncResult> {
    console.log('[SyncService] Starting sync down (remote -> local)...');

    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      conflictCount: 0,
      errorCount: 0,
      duration: 0,
      phase: SyncPhase.DOWNLOADING_UPDATES,
      errors: [],
    };

    try {
      await localStorageService.initialize();

      // Get last sync timestamp
      const lastSyncResult = await localStorageService.getStats();
      const lastSyncTimestamp =
        lastSyncResult.success && lastSyncResult.data?.lastSyncAt
          ? new Date(lastSyncResult.data.lastSyncAt * 1000)
          : new Date(0);

      console.log(
        `[SyncService] Last sync: ${lastSyncTimestamp.toISOString()}`
      );

      // Fetch articles from remote
      const remoteArticles =
        await this.fetchRemoteArticlesSince(lastSyncTimestamp);
      console.log(
        `[SyncService] Found ${remoteArticles.length} remote articles to sync`
      );

      // Process remote articles
      for (let i = 0; i < remoteArticles.length; i++) {
        const remoteArticle = remoteArticles[i];

        store.dispatch(
          syncProgress({
            phase: SyncPhase.DOWNLOADING_UPDATES,
            totalItems: remoteArticles.length,
            processedItems: i,
            currentItem: `Syncing: ${remoteArticle.title}`,
          })
        );

        try {
          const syncResult = await this.syncRemoteArticle(remoteArticle);

          if (syncResult.success) {
            result.syncedCount++;
          } else if (syncResult.conflict) {
            result.conflictCount++;
          } else {
            result.errorCount++;
            result.errors.push({
              operation: `sync_article_${remoteArticle.id}`,
              error: syncResult.error || 'Unknown error',
              retryable: true,
            });
          }
        } catch (error) {
          result.errorCount++;
          result.errors.push({
            operation: `sync_article_${remoteArticle.id}`,
            error: error.message,
            retryable: this.isRetryableError(error),
          });
        }

        // Check for abort signal
        if (this.abortController?.signal.aborted) {
          throw new Error('Sync aborted by user');
        }
      }

      console.log(
        `[SyncService] Sync down completed: ${result.syncedCount} synced, ${result.conflictCount} conflicts`
      );
      return result;
    } catch (error) {
      const handledError = errorHandler.handleError(error, {
        category: ErrorCategory.SYNC_OPERATION,
        context: {
          actionType: 'sync_down',
          syncPhase: SyncPhase.FETCHING_REMOTE_DATA,
        },
      });

      result.success = false;
      result.errorCount++;
      result.errors.push({
        operation: 'sync_down',
        error: handledError.message,
        retryable: this.isRetryableError(error),
      });
      return result;
    }
  }

  private async uploadBatch(articles: any[]): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      conflictCount: 0,
      errorCount: 0,
      duration: 0,
      phase: SyncPhase.UPLOADING_CHANGES,
      errors: [],
    };

    for (const dbArticle of articles) {
      try {
        const article =
          DatabaseUtilityFunctions.convertDBArticleToArticle(dbArticle);

        // Check if article exists on server
        const existsOnServer = await this.checkArticleExistsOnServer(
          article.id
        );

        if (existsOnServer) {
          // Update existing article
          await readeckApiService.updateArticleWithMetadata({
            id: article.id,
            updates: {
              title: article.title,
              isArchived: article.isArchived,
              isFavorite: article.isFavorite,
              isRead: article.isRead,
              tags: article.tags || [],
            },
          });

          // Mark as synced in local database
          await localStorageService.updateArticle(article.id, {
            is_modified: 0,
            synced_at: Math.floor(Date.now() / 1000),
          });

          result.syncedCount++;
        } else {
          // Create new article on server
          console.log(
            `[SyncService] Creating article on server: ${article.title}`
          );
          const serverArticle =
            await readeckApiService.createArticleWithMetadata({
              title: article.title,
              url: article.url,
              summary: article.summary,
              content: article.content,
              tags: article.tags || [],
            });

          // Update local article with server ID if it was a local article
          if (article.id.startsWith('local_')) {
            await localStorageService.deleteArticle(article.id);
            await localStorageService.createArticleFromAppFormat({
              ...serverArticle,
              id: serverArticle.id,
            });
          } else {
            await localStorageService.updateArticle(article.id, {
              is_modified: 0,
              synced_at: Math.floor(Date.now() / 1000),
            });
          }

          result.syncedCount++;
        }
      } catch (error) {
        console.error(
          `[SyncService] Failed to upload article ${dbArticle.id}:`,
          error
        );
        result.errorCount++;
        result.errors.push({
          operation: `upload_article_${dbArticle.id}`,
          error: error.message,
          retryable: this.isRetryableError(error),
        });
      }
    }

    return result;
  }

  private async syncRemoteArticle(remoteArticle: Article): Promise<{
    success: boolean;
    conflict: boolean;
    error?: string;
  }> {
    try {
      await localStorageService.initialize();

      // Check if article exists locally
      const localArticle = await localStorageService.getArticleAsAppFormat(
        remoteArticle.id
      );

      if (!localArticle) {
        // Article doesn't exist locally, create it
        const created = await localStorageService.createArticleFromAppFormat({
          ...remoteArticle,
          syncedAt: new Date().toISOString(),
          isModified: false,
        });

        return {
          success: !!created,
          conflict: false,
          error: created ? undefined : 'Failed to create local article',
        };
      }

      // Article exists locally, check for conflicts
      if (this.hasConflict(localArticle, remoteArticle)) {
        const resolved = await this.handleConflict(localArticle, remoteArticle);
        return {
          success: resolved,
          conflict: !resolved,
        };
      } else {
        // No conflict, update local article
        const updated = await localStorageService.updateArticleFromAppFormat(
          remoteArticle.id,
          {
            ...remoteArticle,
            syncedAt: new Date().toISOString(),
            isModified: false,
          }
        );

        return {
          success: updated,
          conflict: false,
          error: updated ? undefined : 'Failed to update local article',
        };
      }
    } catch (error) {
      return {
        success: false,
        conflict: false,
        error: error.message,
      };
    }
  }

  private hasConflict(localArticle: Article, remoteArticle: Article): boolean {
    // Check if both articles have been modified since last sync
    const localModified = localArticle.isModified || false;
    const remoteModified =
      new Date(remoteArticle.updatedAt) > new Date(localArticle.syncedAt || 0);

    if (!localModified || !remoteModified) {
      return false;
    }

    // Check for actual differences in content
    return (
      localArticle.title !== remoteArticle.title ||
      localArticle.isArchived !== remoteArticle.isArchived ||
      localArticle.isFavorite !== remoteArticle.isFavorite ||
      localArticle.isRead !== remoteArticle.isRead ||
      JSON.stringify(localArticle.tags || []) !==
        JSON.stringify(remoteArticle.tags || [])
    );
  }

  private async handleConflict(
    localArticle: Article,
    remoteArticle: Article
  ): Promise<boolean> {
    console.log(
      `[SyncService] Conflict detected for article: ${localArticle.id}`
    );

    // Add conflict to Redux state
    store.dispatch(
      addConflict({
        articleId: localArticle.id,
        type: ConflictType.CONTENT_MODIFIED,
        localVersion: localArticle,
        remoteVersion: remoteArticle,
      })
    );

    // Apply conflict resolution strategy
    switch (this.config.conflictResolutionStrategy) {
      case ConflictResolutionStrategy.LAST_WRITE_WINS:
        return await this.resolveLastWriteWins(localArticle, remoteArticle);
      case ConflictResolutionStrategy.LOCAL_WINS:
        return await this.resolveLocalWins(localArticle, remoteArticle);
      case ConflictResolutionStrategy.REMOTE_WINS:
        return await this.resolveRemoteWins(localArticle, remoteArticle);
      case ConflictResolutionStrategy.MANUAL:
        return false; // Manual resolution required
      default:
        console.warn(
          `[SyncService] Unknown conflict resolution strategy: ${this.config.conflictResolutionStrategy}`
        );
        return false;
    }
  }

  private async resolveLastWriteWins(
    localArticle: Article,
    remoteArticle: Article
  ): Promise<boolean> {
    try {
      const resolvedArticle = resolveArticleConflict(
        localArticle,
        remoteArticle,
        ConflictResolutionStrategy.LAST_WRITE_WINS
      );

      const updated = await localStorageService.updateArticleFromAppFormat(
        resolvedArticle.id,
        {
          ...resolvedArticle,
          syncedAt: new Date().toISOString(),
          isModified: false,
        }
      );

      if (updated) {
        store.dispatch(
          resolveConflict({
            conflictId: `${localArticle.id}_${Date.now()}`,
            resolution: ConflictResolutionStrategy.LAST_WRITE_WINS,
            resolvedVersion: resolvedArticle,
          })
        );

        console.log(
          `[SyncService] Conflict resolved for article: ${localArticle.id} using Last-Write-Wins`
        );
        return true;
      }

      return false;
    } catch (error) {
      console.error(
        `[SyncService] Failed to resolve conflict for article: ${localArticle.id}`,
        error
      );
      return false;
    }
  }

  private async resolveLocalWins(
    localArticle: Article,
    _remoteArticle: Article
  ): Promise<boolean> {
    try {
      const updated = await localStorageService.updateArticleFromAppFormat(
        localArticle.id,
        {
          syncedAt: new Date().toISOString(),
          isModified: true, // Keep as modified to upload later
        }
      );

      if (updated) {
        store.dispatch(
          resolveConflict({
            conflictId: `${localArticle.id}_${Date.now()}`,
            resolution: ConflictResolutionStrategy.LOCAL_WINS,
            resolvedVersion: localArticle,
          })
        );

        console.log(
          `[SyncService] Conflict resolved for article: ${localArticle.id} using Local-Wins`
        );
        return true;
      }

      return false;
    } catch (error) {
      console.error(
        `[SyncService] Failed to resolve conflict for article: ${localArticle.id}`,
        error
      );
      return false;
    }
  }

  private async resolveRemoteWins(
    localArticle: Article,
    remoteArticle: Article
  ): Promise<boolean> {
    try {
      const updated = await localStorageService.updateArticleFromAppFormat(
        remoteArticle.id,
        {
          ...remoteArticle,
          syncedAt: new Date().toISOString(),
          isModified: false,
        }
      );

      if (updated) {
        store.dispatch(
          resolveConflict({
            conflictId: `${localArticle.id}_${Date.now()}`,
            resolution: ConflictResolutionStrategy.REMOTE_WINS,
            resolvedVersion: remoteArticle,
          })
        );

        console.log(
          `[SyncService] Conflict resolved for article: ${localArticle.id} using Remote-Wins`
        );
        return true;
      }

      return false;
    } catch (error) {
      console.error(
        `[SyncService] Failed to resolve conflict for article: ${localArticle.id}`,
        error
      );
      return false;
    }
  }

  private async resolveAllConflicts(): Promise<void> {
    const state = store.getState();
    const conflicts = state.sync.conflicts;

    console.log(`[SyncService] Resolving ${conflicts.length} conflicts...`);

    for (let i = 0; i < conflicts.length; i++) {
      const conflict = conflicts[i];

      store.dispatch(
        syncProgress({
          phase: SyncPhase.RESOLVING_CONFLICTS,
          totalItems: conflicts.length,
          processedItems: i,
          currentItem: `Resolving conflict for article: ${conflict.articleId}`,
        })
      );

      try {
        await this.handleConflict(
          conflict.localVersion,
          conflict.remoteVersion
        );
      } catch (error) {
        console.error(
          `[SyncService] Failed to resolve conflict for article: ${conflict.articleId}`,
          error
        );
      }
    }
  }

  private async fetchRemoteArticlesSince(since: Date): Promise<Article[]> {
    const response = await readeckApiService.fetchArticlesWithFilters({
      page: 1,
      limit: 1000,
      forceRefresh: true,
    });

    // Filter articles modified since the timestamp
    const filteredArticles = response.items.filter(
      article => new Date(article.updatedAt) > since
    );

    // Fetch full content for each article during sync
    const articlesWithContent: Article[] = [];
    for (const article of filteredArticles) {
      try {
        console.log(`[SyncService] Fetching full content for article ${article.id}`);
        const fullArticle = await readeckApiService.getArticleWithContent(article.id);
        
        // Verify that content was actually fetched
        if (fullArticle.content && fullArticle.content.trim().length > 0) {
          console.log(`[SyncService] Successfully fetched content for article ${article.id} (${fullArticle.content.length} chars)`);
          articlesWithContent.push(fullArticle);
        } else if (fullArticle.contentUrl) {
          // If no content but contentUrl exists, try to fetch content directly
          console.log(`[SyncService] No content found, trying to fetch from contentUrl for article ${article.id}`);
          try {
            const content = await readeckApiService.getArticleContent(fullArticle.contentUrl);
            articlesWithContent.push({
              ...fullArticle,
              content: content
            });
            console.log(`[SyncService] Successfully fetched content from contentUrl for article ${article.id} (${content.length} chars)`);
          } catch (contentError) {
            console.error(`[SyncService] Failed to fetch content from contentUrl for article ${article.id}:`, contentError);
            // Store article with contentUrl for later content fetching
            articlesWithContent.push(fullArticle);
          }
        } else {
          console.warn(`[SyncService] No content or contentUrl available for article ${article.id}`);
          // Store the article without content - user can manually refresh later
          articlesWithContent.push(fullArticle);
        }
      } catch (error) {
        console.error(`[SyncService] Failed to fetch content for article ${article.id}:`, error);
        // Store the article without content - user can manually refresh later
        articlesWithContent.push(article);
      }
    }

    return articlesWithContent;
  }

  private async checkArticleExistsOnServer(
    articleId: string
  ): Promise<boolean> {
    try {
      await readeckApiService.getArticleWithContent(articleId);
      return true;
    } catch {
      return false;
    }
  }

  private async processPendingSyncOperations(): Promise<void> {
    // Simplified - just process shared URLs
    await this.processPendingSharedUrls();
  }

  private async processPendingSharedUrls(): Promise<void> {
    try {
      const pendingUrls = await ShareService.getPendingSharedUrls();

      if (pendingUrls.length === 0) {
        console.log('[SyncService] No pending shared URLs to process');
        return;
      }

      console.log(
        `[SyncService] Processing ${pendingUrls.length} pending shared URLs`
      );

      for (const sharedUrl of pendingUrls) {
        try {
          console.log(
            `[SyncService] Creating article from shared URL: ${sharedUrl.url}`
          );

          await readeckApiService.createArticleWithMetadata({
            url: sharedUrl.url,
            title: sharedUrl.title,
          });

          console.log(
            `[SyncService] Successfully created article for shared URL: ${sharedUrl.id}`
          );

          // Remove from queue
          await ShareService.removeFromQueue(sharedUrl.id);
        } catch (error) {
          console.error(
            `[SyncService] Error processing shared URL ${sharedUrl.id}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error(
        '[SyncService] Error processing pending shared URLs:',
        error
      );
    }
  }

  private setupNetworkMonitoring(): void {
    // Simplified network monitoring
    store.dispatch(
      updateNetworkStatus({
        isOnline: true,
        networkType: NetworkType.WIFI,
      })
    );
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private isRetryableError(error: any): boolean {
    if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') return true;
    if (error.status >= 500 && error.status < 600) return true;
    if (error.message.includes('network') || error.message.includes('timeout'))
      return true;
    return false;
  }

  async stopSync(): Promise<void> {
    if (this.isRunning && this.abortController) {
      console.log('[SyncService] Stopping sync...');
      this.abortController.abort();
      this.isRunning = false;
    }
  }

  isSyncRunning(): boolean {
    return this.isRunning;
  }

  async getSyncStats(): Promise<any> {
    const state = store.getState();
    return state.sync.stats;
  }

  async triggerManualSync(): Promise<void> {
    console.log('[SyncService] Manual sync triggered');
    await this.startFullSync(true);
  }

  /**
   * Fetch content for articles that are missing full content
   * This can be called after sync to ensure all articles have content
   */
  async backfillMissingContent(): Promise<{
    processed: number;
    updated: number;
    errors: number;
  }> {
    console.log('[SyncService] Starting content backfill for articles missing content...');
    
    const result = {
      processed: 0,
      updated: 0,
      errors: 0
    };

    try {
      await localStorageService.initialize();

      // Get articles that have contentUrl but no content
      const articlesResult = await localStorageService.getArticles({
        limit: 1000,
        sortBy: 'updated_at',
        sortOrder: 'DESC'
      });

      if (!articlesResult.success || !articlesResult.data) {
        console.error('[SyncService] Failed to get articles for content backfill');
        return result;
      }

      const articles = articlesResult.data.items;
      const articlesNeedingContent = articles.filter(dbArticle => {
        const hasContentUrl = dbArticle.content_url && dbArticle.content_url.trim().length > 0;
        const hasContent = dbArticle.content && dbArticle.content.trim().length > 0;
        return hasContentUrl && !hasContent;
      });

      console.log(`[SyncService] Found ${articlesNeedingContent.length} articles needing content backfill`);

      for (const dbArticle of articlesNeedingContent) {
        result.processed++;
        
        try {
          console.log(`[SyncService] Backfilling content for article ${dbArticle.id}`);
          const content = await readeckApiService.getArticleContent(dbArticle.content_url);
          
          if (content && content.trim().length > 0) {
            await localStorageService.updateArticle(dbArticle.id, {
              content: content,
              updated_at: Math.floor(Date.now() / 1000)
            });
            result.updated++;
            console.log(`[SyncService] Successfully backfilled content for article ${dbArticle.id} (${content.length} chars)`);
          } else {
            console.warn(`[SyncService] No content returned for article ${dbArticle.id}`);
          }
        } catch (error) {
          result.errors++;
          console.error(`[SyncService] Failed to backfill content for article ${dbArticle.id}:`, error);
        }
      }

      console.log(`[SyncService] Content backfill completed: ${result.updated} updated, ${result.errors} errors`);
      return result;
    } catch (error) {
      console.error('[SyncService] Content backfill failed:', error);
      return result;
    }
  }
}

// Export singleton instance
export const syncService = SyncService.getInstance();

// Export class for testing
export default SyncService;

// Export types
export type { SyncResult, SimpleSyncServiceInterface };
