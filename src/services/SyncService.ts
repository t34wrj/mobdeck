/**
 * SyncService - Comprehensive Bidirectional Synchronization Service
 *
 * Features:
 * - Two-way sync between local SQLite and Readeck server
 * - Last-Write-Wins conflict resolution strategy
 * - Network-aware sync with retry logic
 * - Batch processing for efficient data transfer
 * - Comprehensive error handling and recovery
 * - Integration with Redux sync slice for state management
 * - Progress tracking and status reporting
 */

import DatabaseService, { DatabaseUtilityFunctions } from './DatabaseService';
import { readeckApiService } from './ReadeckApiService';
import { articlesApiService } from './ArticlesApiService';
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
import { connectivityManager, ConnectivityStatus } from '../utils/connectivityManager';

interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'article' | 'label';
  localData?: any;
  remoteData?: any;
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  retryCount: number;
}

interface SyncBatch {
  operations: SyncOperation[];
  batchId: string;
  startTime: number;
  endTime?: number;
  totalOperations: number;
  completedOperations: number;
  failedOperations: number;
}

interface SyncResult {
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

/**
 * SyncService - Manages bidirectional synchronization between local and remote data
 */
class SyncService {
  private static instance: SyncService;
  private isRunning = false;
  private currentBatch: SyncBatch | null = null;
  private syncQueue: SyncOperation[] = [];
  private retryQueue: SyncOperation[] = [];
  private config: SyncConfiguration;
  private abortController: AbortController | null = null;

  private constructor() {
    // Initialize with default configuration
    this.config = {
      backgroundSyncEnabled: true,
      syncInterval: 15,
      syncOnWifiOnly: false,
      syncOnCellular: true,
      downloadImages: true,
      fullTextSync: true,
      conflictResolutionStrategy: ConflictResolutionStrategy.LAST_WRITE_WINS,
      batchSize: 50,
    };
  }

  /**
   * Get singleton instance of SyncService
   */
  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  /**
   * Initialize sync service and set up background tasks
   */
  public async initialize(): Promise<void> {
    try {
      console.log('[SyncService] Initializing sync service...');

      // Get current sync configuration from Redux store
      const state = store.getState();
      this.config = { ...this.config, ...state.sync.config };

      // Set up network monitoring
      this.setupNetworkMonitoring();

      // Process any pending sync operations
      await this.processPendingSyncOperations();

      console.log('[SyncService] Sync service initialized successfully');
    } catch (error) {
      console.error('[SyncService] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Update sync configuration
   */
  public updateConfiguration(newConfig: Partial<SyncConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[SyncService] Configuration updated:', newConfig);
  }

  /**
   * Get current sync configuration
   */
  public getConfiguration(): SyncConfiguration {
    return { ...this.config };
  }

  /**
   * Start full bidirectional synchronization
   */
  public async startFullSync(forceSync = false): Promise<SyncResult> {
    if (this.isRunning && !forceSync) {
      throw new Error('Sync already in progress');
    }

    // Check connectivity before starting sync
    console.log('[SyncService] Checking connectivity...');
    const connectivityStatus = await connectivityManager.checkConnectivity();
    console.log('[SyncService] Connectivity status:', connectivityStatus);
    if (connectivityStatus !== ConnectivityStatus.ONLINE) {
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

    // Dispatch sync start action
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

      // Dispatch sync success
      store.dispatch(
        syncSuccess({
          syncDuration: duration,
          itemsProcessed: result.syncedCount,
          conflictsDetected: result.conflictCount,
          syncTime: new Date().toISOString(),
        })
      );

      // Update sync statistics
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

      // Use centralized error handling
      const handledError = errorHandler.handleError(error, {
        category: ErrorCategory.SYNC_OPERATION,
        context: { 
          actionType: 'full_sync',
          syncPhase: SyncPhase.FINALIZING,
        },
      });

      // Dispatch sync error
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

  /**
   * Execute the complete synchronization process
   */
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

      // Phase 3: Resolve any pending conflicts
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

      // Phase 4: Finalize sync
      store.dispatch(
        syncProgress({
          phase: SyncPhase.FINALIZING,
          totalItems: syncResult.syncedCount,
          processedItems: syncResult.syncedCount,
          currentItem: 'Finalizing sync...',
        })
      );

      syncResult.phase = SyncPhase.FINALIZING;
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

  /**
   * Sync Up: Upload local changes to server
   */
  public async syncUp(): Promise<SyncResult> {
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
      // Ensure database is initialized before sync operations
      await this.ensureDatabaseInitialized();

      // Get all locally modified articles
      const modifiedArticlesResult = await DatabaseService.getArticles({
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

  /**
   * Sync Down: Download remote changes to local
   */
  public async syncDown(): Promise<SyncResult> {
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
      // Ensure database is initialized before sync operations
      await this.ensureDatabaseInitialized();

      // Get last sync timestamp
      const lastSyncResult = await DatabaseService.getStats();
      const lastSyncTimestamp =
        lastSyncResult.success && lastSyncResult.data?.lastSyncAt
          ? new Date(lastSyncResult.data.lastSyncAt * 1000)
          : new Date(0);

      console.log(
        `[SyncService] Last sync: ${lastSyncTimestamp.toISOString()}`
      );

      // Fetch articles modified since last sync
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
      // Use centralized error handling
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

  /**
   * Upload a batch of articles to the server
   */
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

    // Ensure database is initialized
    await this.ensureDatabaseInitialized();

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
          await articlesApiService.updateArticle({
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
          await DatabaseService.updateArticle(article.id, {
            is_modified: 0,
            synced_at: Math.floor(Date.now() / 1000),
          });

          result.syncedCount++;
        } else {
          // Check if this is a locally created article (has local ID)
          const isLocallyCreated = article.id.startsWith('local_');
          
          // Create new article on server
          console.log(`[SyncService] Creating article on server: ${article.title}`);
          const createResult = await articlesApiService.createArticle({
            title: article.title,
            url: article.url,
            summary: article.summary,
            content: article.content,
            tags: article.tags || [],
          });

          if (createResult.success && createResult.data) {
            const serverArticle = createResult.data;
            console.log(`[SyncService] Article created on server with ID: ${serverArticle.id}`);
            
            if (isLocallyCreated) {
              // For locally created articles, we need to replace the local record with the server record
              const oldLocalId = article.id;
              
              // Delete the old local record
              await DatabaseService.deleteArticle(oldLocalId);
              
              // Create new record with server ID
              await DatabaseService.createArticle({
                id: serverArticle.id,
                title: serverArticle.title || article.title,
                url: serverArticle.url || article.url,
                summary: serverArticle.summary || article.summary,
                content: serverArticle.content || article.content,
                imageUrl: serverArticle.image_url || article.imageUrl || '',
                readTime: serverArticle.read_time || article.readTime,
                sourceUrl: serverArticle.source_url || article.sourceUrl || article.url,
                isArchived: serverArticle.is_archived || article.isArchived,
                isFavorite: serverArticle.is_favorite || article.isFavorite,
                isRead: serverArticle.is_read || article.isRead,
                isModified: false, // Mark as synced
                createdAt: serverArticle.created_at ? Math.floor(new Date(serverArticle.created_at).getTime() / 1000) : article.createdAt,
                updatedAt: serverArticle.updated_at ? Math.floor(new Date(serverArticle.updated_at).getTime() / 1000) : Math.floor(Date.now() / 1000),
                syncedAt: Math.floor(Date.now() / 1000),
              });
              
              console.log(`[SyncService] Replaced local article ${oldLocalId} with server article ${serverArticle.id}`);
            } else {
              // For articles with server IDs, just mark as synced
              await DatabaseService.updateArticle(article.id, {
                is_modified: 0,
                synced_at: Math.floor(Date.now() / 1000),
              });
            }
            
            result.syncedCount++;
          } else {
            throw new Error(createResult.error || 'Failed to create article on server');
          }
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

  /**
   * Fetch full article content if fullTextSync is enabled
   */
  private async fetchFullArticleContent(articleId: string): Promise<Article | null> {
    try {
      if (!this.config.fullTextSync) {
        return null;
      }

      console.log(`[SyncService] Fetching full content for article: ${articleId}`);
      const response = await readeckApiService.getArticle(articleId);
      
      if (response.success && response.data) {
        // Convert ReadeckArticle to Article format manually
        const readeckArticle = response.data;
        const fullArticle: Article = {
          id: readeckArticle.id,
          title: readeckArticle.title || '',
          summary: readeckArticle.summary || '',
          content: readeckArticle.content || '',
          url: readeckArticle.url || '',
          imageUrl: readeckArticle.image_url || '',
          readTime: readeckArticle.read_time || 0,
          isArchived: readeckArticle.is_archived || false,
          isFavorite: readeckArticle.is_favorite || false,
          isRead: readeckArticle.is_read || false,
          tags: readeckArticle.tags || [],
          sourceUrl: readeckArticle.source_url || readeckArticle.url || '',
          createdAt: readeckArticle.created_at || new Date().toISOString(),
          updatedAt: readeckArticle.updated_at || new Date().toISOString(),
          syncedAt: new Date().toISOString(),
        };
        console.log(`[SyncService] Full content fetched for article: ${articleId}, content length: ${fullArticle.content?.length || 0}`);
        return fullArticle;
      }

      console.warn(`[SyncService] Failed to fetch full content for article: ${articleId}`);
      return null;
    } catch (error) {
      console.error(`[SyncService] Error fetching full content for article: ${articleId}`, error);
      return null;
    }
  }

  /**
   * Sync a remote article to local database
   */
  private async syncRemoteArticle(remoteArticle: Article): Promise<{
    success: boolean;
    conflict: boolean;
    error?: string;
  }> {
    try {
      // Ensure database is initialized
      await this.ensureDatabaseInitialized();

      // Fetch full content if fullTextSync is enabled and content is missing
      let articleToSync = remoteArticle;
      if (this.config.fullTextSync && (!remoteArticle.content || remoteArticle.content.trim() === '')) {
        const fullArticle = await this.fetchFullArticleContent(remoteArticle.id);
        if (fullArticle) {
          articleToSync = fullArticle;
        }
      }

      // Check if article exists locally
      const localArticleResult = await DatabaseService.getArticle(
        articleToSync.id
      );

      if (!localArticleResult.success) {
        // Article doesn't exist locally, create it
        const dbArticle =
          DatabaseUtilityFunctions.convertArticleToDBArticle(articleToSync);
        dbArticle.synced_at = Math.floor(Date.now() / 1000);
        dbArticle.is_modified = 0;

        const createResult = await DatabaseService.createArticle(dbArticle);

        return {
          success: createResult.success,
          conflict: false,
          error: createResult.error,
        };
      }

      // Article exists locally, check for conflicts
      const localArticle = DatabaseUtilityFunctions.convertDBArticleToArticle(
        localArticleResult.data
      );

      if (this.hasConflict(localArticle, articleToSync)) {
        // Handle conflict based on strategy
        const resolved = await this.handleConflict(localArticle, articleToSync);

        return {
          success: resolved,
          conflict: !resolved,
        };
      } else {
        // No conflict, update local article
        const remoteDbArticle =
          DatabaseUtilityFunctions.convertArticleToDBArticle(articleToSync);
        remoteDbArticle.synced_at = Math.floor(Date.now() / 1000);
        remoteDbArticle.is_modified = 0;

        const updateResult = await DatabaseService.updateArticle(
          articleToSync.id,
          remoteDbArticle
        );

        return {
          success: updateResult.success,
          conflict: false,
          error: updateResult.error,
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

  /**
   * Check if there's a conflict between local and remote articles
   */
  private hasConflict(localArticle: Article, remoteArticle: Article): boolean {
    // Check if both articles have been modified since last sync
    const localModified = localArticle.isModified || false;
    const remoteModified =
      new Date(remoteArticle.updatedAt) >
      (localArticle.syncedAt || new Date(0));

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

  /**
   * Handle conflict between local and remote articles
   */
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
        // For manual resolution, we'll store the conflict and return false
        return false;

      default:
        console.warn(
          `[SyncService] Unknown conflict resolution strategy: ${this.config.conflictResolutionStrategy}`
        );
        return false;
    }
  }

  /**
   * Resolve conflict using Last-Write-Wins strategy
   */
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

      // Update local database with resolved article
      const dbArticle =
        DatabaseUtilityFunctions.convertArticleToDBArticle(resolvedArticle);
      dbArticle.synced_at = Math.floor(Date.now() / 1000);
      dbArticle.is_modified = 0;

      const updateResult = await DatabaseService.updateArticle(
        resolvedArticle.id,
        dbArticle
      );

      if (updateResult.success) {
        // Mark conflict as resolved
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

  /**
   * Resolve conflict using Local-Wins strategy
   */
  private async resolveLocalWins(
    localArticle: Article,
    _remoteArticle: Article
  ): Promise<boolean> {
    try {
      // Keep local version, but update sync timestamp
      const updateResult = await DatabaseService.updateArticle(
        localArticle.id,
        {
          synced_at: Math.floor(Date.now() / 1000),
          is_modified: 1, // Keep as modified to upload later
        }
      );

      if (updateResult.success) {
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

  /**
   * Resolve conflict using Remote-Wins strategy
   */
  private async resolveRemoteWins(
    localArticle: Article,
    remoteArticle: Article
  ): Promise<boolean> {
    try {
      // Use remote version
      const dbArticle =
        DatabaseUtilityFunctions.convertArticleToDBArticle(remoteArticle);
      dbArticle.synced_at = Math.floor(Date.now() / 1000);
      dbArticle.is_modified = 0;

      const updateResult = await DatabaseService.updateArticle(
        remoteArticle.id,
        dbArticle
      );

      if (updateResult.success) {
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

  /**
   * Resolve all pending conflicts
   */
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

  /**
   * Fetch remote articles modified since a specific timestamp
   */
  private async fetchRemoteArticlesSince(since: Date): Promise<Article[]> {
    // Use the existing ArticlesApiService to fetch articles
    const response = await articlesApiService.fetchArticles({
      page: 1,
      limit: 1000, // Fetch a large batch for sync
      forceRefresh: true,
    });

    // Filter articles modified since the timestamp
    return response.items.filter(
      article => new Date(article.updatedAt) > since
    );
  }

  /**
   * Check if an article exists on the server
   */
  private async checkArticleExistsOnServer(
    articleId: string
  ): Promise<boolean> {
    try {
      await articlesApiService.getArticle(articleId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Process any pending sync operations from previous sessions
   */
  private async processPendingSyncOperations(): Promise<void> {
    try {
      // Ensure database is initialized
      await this.ensureDatabaseInitialized();

      const pendingResult = await DatabaseService.getSyncMetadata({
        syncStatus: 'pending',
        limit: 100,
      });

      if (pendingResult.success && pendingResult.data?.items.length > 0) {
        console.log(
          `[SyncService] Found ${pendingResult.data.items.length} pending sync operations`
        );
        
        // Skip processing old shared URL queue - we now save articles directly offline-first
        // await this.processPendingSharedUrls();
        
        // Process other pending operations
        await this.processPendingOperations();
      }
    } catch (error) {
      console.error(
        '[SyncService] Failed to process pending sync operations:',
        error
      );
    }
  }

  /**
   * Set up network monitoring
   */
  private setupNetworkMonitoring(): void {
    // TODO: Implement network monitoring using NetInfo
    // For now, assume we're online
    store.dispatch(
      updateNetworkStatus({
        isOnline: true,
        networkType: NetworkType.WIFI,
      })
    );
  }

  /**
   * Create batches from an array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process pending shared URLs when coming back online
   */
  private async processPendingSharedUrls(): Promise<void> {
    try {
      const pendingUrls = await ShareService.getPendingSharedUrls();
      
      if (pendingUrls.length === 0) {
        console.log('[SyncService] No pending shared URLs to process');
        return;
      }
      
      console.log(`[SyncService] Processing ${pendingUrls.length} pending shared URLs`);
      
      for (const sharedUrl of pendingUrls) {
        try {
          console.log(`[SyncService] Creating article from shared URL: ${sharedUrl.url}`);
          
          // Create article using ArticlesApiService
          const result = await articlesApiService.createArticle({
            url: sharedUrl.url,
            title: sharedUrl.title,
          });
          
          if (result.success) {
            console.log(`[SyncService] Successfully created article for shared URL: ${sharedUrl.id}`);
            
            // Remove from queue
            await ShareService.removeFromQueue(sharedUrl.id);
            
            // Show success notification
            // TODO: Add notification service
            console.log(`[SyncService] Article "${sharedUrl.title}" added successfully`);
          } else {
            console.error(`[SyncService] Failed to create article for shared URL: ${sharedUrl.id}`, result.error);
          }
        } catch (error) {
          console.error(`[SyncService] Error processing shared URL ${sharedUrl.id}:`, error);
          
          // For now, we'll keep the URL in the queue for retry
          // TODO: Implement retry logic with exponential backoff
        }
      }
    } catch (error) {
      console.error('[SyncService] Error processing pending shared URLs:', error);
    }
  }

  /**
   * Process other pending sync operations
   */
  private async processPendingOperations(): Promise<void> {
    try {
      // TODO: Implement processing of other pending operations
      console.log('[SyncService] Processing other pending operations - not implemented yet');
    } catch (error) {
      console.error('[SyncService] Error processing pending operations:', error);
    }
  }

  /**
   * Ensure database is initialized before sync operations
   */
  private async ensureDatabaseInitialized(): Promise<void> {
    try {
      await DatabaseService.initialize();
    } catch (error) {
      console.error('[SyncService] Database initialization failed:', error);
      throw new Error(`Database initialization failed: ${error.message}`);
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors, timeouts, and server errors are retryable
    if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') return true;
    if (error.status >= 500 && error.status < 600) return true;
    if (error.message.includes('network') || error.message.includes('timeout'))
      return true;

    return false;
  }

  /**
   * Stop sync if currently running
   */
  public async stopSync(): Promise<void> {
    if (this.isRunning && this.abortController) {
      console.log('[SyncService] Stopping sync...');
      this.abortController.abort();
      this.isRunning = false;
    }
  }

  /**
   * Update sync configuration
   */
  public updateConfig(config: Partial<SyncConfiguration>): void {
    this.config = { ...this.config, ...config };
    console.log('[SyncService] Configuration updated:', config);
  }

  /**
   * Get current sync status
   */
  public isSyncRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get sync statistics
   */
  public async getSyncStats(): Promise<any> {
    const state = store.getState();
    return state.sync.stats;
  }
}

// Export singleton instance
export const syncService = SyncService.getInstance();

// Export class for testing
export default SyncService;
