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
import { logger, LogCategory } from '../utils/logger';
import { syncMonitoringService } from './SyncMonitoringService';
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
  SyncStatus,
  ConflictType,
  ConflictResolutionStrategy,
  NetworkType,
} from '../types/sync';
import { Article } from '../types';
import { resolveConflict as resolveArticleConflict } from '../utils/conflictResolution';
import { connectivityManager } from '../utils/connectivityManager';
import { DatabaseUtilityFunctions } from './DatabaseService';
import { contentOperationCoordinator } from '../utils/ContentOperationCoordinator';

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
      logger.info('Initializing simplified sync service', undefined, LogCategory.SYNC);

      // Get current sync configuration from Redux store
      const state = store.getState();
      this.config = { ...this.config, ...state.sync.config };

      // Set up network monitoring
      this.setupNetworkMonitoring();

      // Process any pending sync operations
      await this.processPendingSyncOperations();

      logger.info('Simplified sync service initialized successfully', {
        config: this.config
      }, LogCategory.SYNC);
    } catch (error) {
      logger.error('Failed to initialize SyncService', error, LogCategory.SYNC);
      throw error;
    }
  }

  updateConfiguration(newConfig: Partial<SyncConfiguration>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    logger.info('Configuration updated', {
      oldConfig,
      newConfig,
      finalConfig: this.config
    }, LogCategory.SYNC);
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
      logger.warn('Cannot sync - server unreachable', {
        networkStatus,
        forceSync
      }, LogCategory.SYNC);
      store.dispatch(
        syncError({
          error: 'Server is unreachable. Please check your connection.',
          phase: SyncPhase.CHECKING_CONNECTION,
          isRetryable: true,
        })
      );
      throw new Error('Server is unreachable. Please check your connection.');
    }

    // Check network constraints based on user settings
    if (this.config.syncOnWifiOnly && !networkStatus.isWifi) {
      logger.warn('Sync blocked - WiFi-only mode enabled and not connected to WiFi', {
        networkStatus,
        config: this.config
      }, LogCategory.SYNC);
      store.dispatch(
        syncError({
          error: 'Sync is set to WiFi-only mode. Please connect to WiFi or change sync settings.',
          phase: SyncPhase.CHECKING_CONNECTION,
          isRetryable: true,
        })
      );
      throw new Error('Sync is set to WiFi-only mode. Please connect to WiFi or change sync settings.');
    }

    // Check if cellular sync is disabled but we're on cellular
    if (!this.config.syncOnCellular && networkStatus.isCellular) {
      logger.warn('Sync blocked - cellular sync disabled and connected to cellular', {
        networkStatus,
        config: this.config
      }, LogCategory.SYNC);
      store.dispatch(
        syncError({
          error: 'Sync on cellular is disabled. Please connect to WiFi or change sync settings.',
          phase: SyncPhase.CHECKING_CONNECTION,
          isRetryable: true,
        })
      );
      throw new Error('Sync on cellular is disabled. Please connect to WiFi or change sync settings.');
    }

    // Generate unique sync ID for tracking
    const syncId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info('Starting full sync', {
      syncId,
      forceSync,
      networkStatus,
      config: this.config
    }, LogCategory.SYNC);

    // Start sync monitoring
    syncMonitoringService.startSyncOperation(
      syncId,
      SyncPhase.INITIALIZING,
      networkStatus.isWifi ? NetworkType.WIFI : NetworkType.CELLULAR,
      this.config.batchSize
    );

    this.isRunning = true;
    this.abortController = new AbortController();

    logger.startPerformanceTimer(`full_sync_${syncId}`);

    store.dispatch(
      startSync({
        fullSync: true,
        forceSync,
        syncOptions: this.config,
      })
    );

    try {
      const result = await this.executeFullSync(syncId);
      const duration = logger.endPerformanceTimer(`full_sync_${syncId}`, LogCategory.SYNC);

      // Complete sync monitoring
      syncMonitoringService.completeSyncOperation(
        syncId,
        SyncStatus.SUCCESS,
        result.conflictCount
      );

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

      logger.info('Full sync completed successfully', {
        syncId,
        duration,
        syncedCount: result.syncedCount,
        conflictCount: result.conflictCount,
        errorCount: result.errorCount
      }, LogCategory.SYNC);

      return {
        ...result,
        duration,
        success: true,
      };
    } catch (error) {
      const duration = logger.endPerformanceTimer(`full_sync_${syncId}`, LogCategory.SYNC);

      // Record error in monitoring
      syncMonitoringService.recordSyncError(syncId, SyncPhase.FINALIZING, error.message);
      syncMonitoringService.completeSyncOperation(syncId, SyncStatus.ERROR);

      const handledError = errorHandler.handleError(error, {
        category: ErrorCategory.SYNC_OPERATION,
        context: {
          actionType: 'full_sync',
          syncPhase: SyncPhase.FINALIZING,
          syncId,
        },
      });

      // Use enhanced error logging with classification
      const errorClassification = logger.errorWithClassification('Full sync failed', error, LogCategory.SYNC);
      
      logger.error('Full sync failed', {
        syncId,
        duration,
        error: handledError.message,
        retryable: this.isRetryableError(error),
        userMessage: errorClassification.userMessage,
        suggestedAction: errorClassification.suggestedAction
      }, LogCategory.SYNC);

      store.dispatch(
        syncError({
          error: errorClassification.userMessage || handledError.message,
          errorCode: errorClassification.errorCode || 'SYNC_FAILED',
          phase: SyncPhase.FINALIZING,
          isRetryable: errorClassification.isRetryable,
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

  private async executeFullSync(syncId: string): Promise<SyncResult> {
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
      logger.syncLog(
        syncId,
        SyncPhase.UPLOADING_CHANGES,
        'phase_start',
        'Starting upload phase - detecting local changes'
      );

      store.dispatch(
        syncProgress({
          phase: SyncPhase.UPLOADING_CHANGES,
          totalItems: 0,
          processedItems: 0,
          currentItem: 'Detecting local changes...',
        })
      );

      logger.startPerformanceTimer(`upload_phase_${syncId}`);
      const uploadResult = await this.syncUp(syncId);
      const uploadDuration = logger.endPerformanceTimer(`upload_phase_${syncId}`, LogCategory.SYNC);
      
      syncMonitoringService.addPerformanceMarker(syncId, 'upload_phase', uploadDuration);
      syncMonitoringService.updateSyncProgress(
        syncId,
        SyncPhase.UPLOADING_CHANGES,
        uploadResult.syncedCount,
        uploadResult.syncedCount - uploadResult.errorCount,
        uploadResult.errorCount
      );

      syncResult.syncedCount += uploadResult.syncedCount;
      syncResult.conflictCount += uploadResult.conflictCount;
      syncResult.errorCount += uploadResult.errorCount;
      syncResult.errors.push(...uploadResult.errors);

      logger.syncLog(
        syncId,
        SyncPhase.UPLOADING_CHANGES,
        'phase_complete',
        'Upload phase completed',
        {
          duration: uploadDuration,
          itemCount: uploadResult.syncedCount,
          errorCount: uploadResult.errorCount
        }
      );

      // Phase 2: Download remote changes
      logger.syncLog(
        syncId,
        SyncPhase.DOWNLOADING_UPDATES,
        'phase_start',
        'Starting download phase - fetching remote updates'
      );

      store.dispatch(
        syncProgress({
          phase: SyncPhase.DOWNLOADING_UPDATES,
          totalItems: 0,
          processedItems: 0,
          currentItem: 'Fetching remote updates...',
        })
      );

      logger.startPerformanceTimer(`download_phase_${syncId}`);
      const downloadResult = await this.syncDown(syncId);
      const downloadDuration = logger.endPerformanceTimer(`download_phase_${syncId}`, LogCategory.SYNC);
      
      syncMonitoringService.addPerformanceMarker(syncId, 'download_phase', downloadDuration);
      syncMonitoringService.updateSyncProgress(
        syncId,
        SyncPhase.DOWNLOADING_UPDATES,
        downloadResult.syncedCount,
        downloadResult.syncedCount - downloadResult.errorCount,
        downloadResult.errorCount
      );

      syncResult.syncedCount += downloadResult.syncedCount;
      syncResult.conflictCount += downloadResult.conflictCount;
      syncResult.errorCount += downloadResult.errorCount;
      syncResult.errors.push(...downloadResult.errors);

      logger.syncLog(
        syncId,
        SyncPhase.DOWNLOADING_UPDATES,
        'phase_complete',
        'Download phase completed',
        {
          duration: downloadDuration,
          itemCount: downloadResult.syncedCount,
          errorCount: downloadResult.errorCount
        }
      );

      // Phase 3: Resolve conflicts if any
      if (syncResult.conflictCount > 0) {
        logger.syncLog(
          syncId,
          SyncPhase.RESOLVING_CONFLICTS,
          'phase_start',
          'Starting conflict resolution phase',
          {
            itemCount: syncResult.conflictCount
          }
        );

        store.dispatch(
          syncProgress({
            phase: SyncPhase.RESOLVING_CONFLICTS,
            totalItems: syncResult.conflictCount,
            processedItems: 0,
            currentItem: 'Resolving conflicts...',
          })
        );

        logger.startPerformanceTimer(`conflicts_phase_${syncId}`);
        await this.resolveAllConflicts(syncId);
        const conflictsDuration = logger.endPerformanceTimer(`conflicts_phase_${syncId}`, LogCategory.SYNC);
        
        syncMonitoringService.addPerformanceMarker(syncId, 'conflicts_phase', conflictsDuration);
        
        logger.syncLog(
          syncId,
          SyncPhase.RESOLVING_CONFLICTS,
          'phase_complete',
          'Conflict resolution phase completed',
          {
            duration: conflictsDuration,
            itemCount: syncResult.conflictCount
          }
        );
      }

      // Phase 4: Process pending shared URLs
      logger.syncLog(
        syncId,
        SyncPhase.FINALIZING,
        'shared_urls_start',
        'Processing pending shared URLs'
      );

      logger.startPerformanceTimer(`shared_urls_${syncId}`);
      await this.processPendingSharedUrls(syncId);
      const sharedUrlsDuration = logger.endPerformanceTimer(`shared_urls_${syncId}`, LogCategory.SYNC);
      
      syncMonitoringService.addPerformanceMarker(syncId, 'shared_urls_phase', sharedUrlsDuration);
      
      logger.syncLog(
        syncId,
        SyncPhase.FINALIZING,
        'shared_urls_complete',
        'Shared URLs processing completed',
        {
          duration: sharedUrlsDuration
        }
      );

      // Phase 5: Backfill missing content
      logger.syncLog(
        syncId,
        SyncPhase.FINALIZING,
        'backfill_start',
        'Starting content backfill phase'
      );

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
        logger.startPerformanceTimer(`backfill_${syncId}`);
        const backfillResult = await this.backfillMissingContent(syncId);
        const backfillDuration = logger.endPerformanceTimer(`backfill_${syncId}`, LogCategory.SYNC);
        
        syncMonitoringService.addPerformanceMarker(syncId, 'backfill_phase', backfillDuration);
        
        if (backfillResult.updated > 0) {
          logger.syncLog(
            syncId,
            SyncPhase.FINALIZING,
            'backfill_complete',
            'Content backfill completed successfully',
            {
              duration: backfillDuration,
              itemCount: backfillResult.updated,
              errorCount: backfillResult.errors
            }
          );
        }
      } catch (error) {
        logger.syncError(
          syncId,
          SyncPhase.FINALIZING,
          'backfill_error',
          'Content backfill failed',
          error
        );
        // Don't fail the sync if backfill fails
      }

      // Phase 6: Finalize sync
      logger.syncLog(
        syncId,
        SyncPhase.FINALIZING,
        'finalize_start',
        'Finalizing sync operation'
      );

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
        logger.syncLog(
          syncId,
          SyncPhase.FINALIZING,
          'finalize_complete',
          'Sync completed with errors',
          {
            itemCount: syncResult.syncedCount,
            errorCount: syncResult.errorCount,
            conflictCount: syncResult.conflictCount
          }
        );
      } else {
        logger.syncLog(
          syncId,
          SyncPhase.FINALIZING,
          'finalize_complete',
          'Sync completed successfully',
          {
            itemCount: syncResult.syncedCount,
            conflictCount: syncResult.conflictCount
          }
        );
      }

      return syncResult;
    } catch (error) {
      logger.syncError(
        syncId,
        syncResult.phase,
        'execute_full_sync',
        'Full sync execution failed',
        error
      );
      
      syncMonitoringService.recordSyncError(syncId, syncResult.phase, error.message);
      
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

  async syncUp(syncId?: string): Promise<SyncResult> {
    const currentSyncId = syncId || `syncup_${Date.now()}`;
    logger.syncLog(
      currentSyncId,
      SyncPhase.UPLOADING_CHANGES,
      'sync_up_start',
      'Starting sync up (local -> remote)'
    );

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
      logger.syncLog(
        currentSyncId,
        SyncPhase.UPLOADING_CHANGES,
        'modified_articles_found',
        'Found locally modified articles',
        {
          itemCount: modifiedArticles.length
        }
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

      logger.syncLog(
        currentSyncId,
        SyncPhase.UPLOADING_CHANGES,
        'sync_up_complete',
        'Sync up completed',
        {
          itemCount: result.syncedCount,
          errorCount: result.errorCount,
          conflictCount: result.conflictCount
        }
      );
      return result;
    } catch (error) {
      logger.syncError(
        currentSyncId,
        SyncPhase.UPLOADING_CHANGES,
        'sync_up_failed',
        'Sync up failed',
        error
      );
      
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

  async syncDown(syncId?: string): Promise<SyncResult> {
    const currentSyncId = syncId || `syncdown_${Date.now()}`;
    logger.syncLog(
      currentSyncId,
      SyncPhase.DOWNLOADING_UPDATES,
      'sync_down_start',
      'Starting sync down (remote -> local)'
    );

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

      logger.syncLog(
        currentSyncId,
        SyncPhase.DOWNLOADING_UPDATES,
        'last_sync_timestamp',
        'Retrieved last sync timestamp',
        {
          lastSyncTimestamp: lastSyncTimestamp.toISOString()
        }
      );

      // Fetch articles from remote
      logger.startPerformanceTimer(`fetch_remote_${currentSyncId}`);
      const remoteArticles =
        await this.fetchRemoteArticlesSince(lastSyncTimestamp, currentSyncId);
      const fetchDuration = logger.endPerformanceTimer(`fetch_remote_${currentSyncId}`, LogCategory.SYNC);
      
      logger.syncLog(
        currentSyncId,
        SyncPhase.DOWNLOADING_UPDATES,
        'remote_articles_found',
        'Found remote articles to sync',
        {
          itemCount: remoteArticles.length,
          duration: fetchDuration
        }
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

      logger.syncLog(
        currentSyncId,
        SyncPhase.DOWNLOADING_UPDATES,
        'sync_down_complete',
        'Sync down completed',
        {
          itemCount: result.syncedCount,
          errorCount: result.errorCount,
          conflictCount: result.conflictCount
        }
      );
      return result;
    } catch (error) {
      const errorMessage = this.serializeError(error);
      const _handledError = errorHandler.handleError(error, {
        category: ErrorCategory.SYNC_OPERATION,
        context: {
          actionType: 'sync_down',
          syncPhase: SyncPhase.FETCHING_REMOTE_DATA,
          syncId: currentSyncId,
        },
      });

      logger.syncError(
        currentSyncId,
        SyncPhase.DOWNLOADING_UPDATES,
        'sync_down_failed',
        'Sync down failed',
        error,
        {
          errorMessage,
          retryable: this.isRetryableError(error)
        }
      );
      
      result.success = false;
      result.errorCount++;
      result.errors.push({
        operation: 'sync_down',
        error: errorMessage,
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

  private async resolveAllConflicts(syncId?: string): Promise<void> {
    const state = store.getState();
    const conflicts = state.sync.conflicts;

    const currentSyncId = syncId || `resolve_conflicts_${Date.now()}`;
    logger.syncLog(
      currentSyncId,
      SyncPhase.RESOLVING_CONFLICTS,
      'resolve_conflicts_start',
      'Starting conflict resolution',
      {
        itemCount: conflicts.length
      }
    );

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

  private async fetchRemoteArticlesSince(since: Date, syncId?: string): Promise<Article[]> {
    const currentSyncId = syncId || `fetch_remote_${Date.now()}`;
    let response;
    try {
      logger.syncLog(
        currentSyncId,
        SyncPhase.FETCHING_REMOTE_DATA,
        'fetch_start',
        'Fetching remote articles since timestamp',
        {
          since: since.toISOString()
        }
      );
      
      response = await readeckApiService.fetchArticlesWithFilters({
        page: 1,
        limit: 1000,
        forceRefresh: true,
      });
      
      logger.syncLog(
        currentSyncId,
        SyncPhase.FETCHING_REMOTE_DATA,
        'fetch_complete',
        'Successfully fetched articles from remote',
        {
          itemCount: response.items.length
        }
      );
    } catch (error) {
      const errorMessage = this.serializeError(error);
      logger.syncError(
        currentSyncId,
        SyncPhase.FETCHING_REMOTE_DATA,
        'fetch_failed',
        'Failed to fetch remote articles',
        error,
        {
          errorMessage,
          since: since.toISOString()
        }
      );
      throw error;
    }

    // Filter articles modified since the timestamp
    const filteredArticles = response.items.filter(
      article => new Date(article.updatedAt) > since
    );

    logger.syncLog(
      currentSyncId,
      SyncPhase.FETCHING_REMOTE_DATA,
      'articles_filtered',
      'Filtered articles to sync',
      {
        itemCount: filteredArticles.length,
        fullTextSync: this.config.fullTextSync
      }
    );

    // Fetch full content for each article during sync (if enabled)
    // Use ContentOperationCoordinator to prevent conflicts with individual content fetching
    const articlesWithContent: Article[] = [];
    for (const article of filteredArticles) {
      try {
        if (this.config.fullTextSync) {
          logger.syncDebug(
            currentSyncId,
            SyncPhase.FETCHING_REMOTE_DATA,
            'content_fetch_start',
            'Fetching full content for article via coordinator',
            {
              articleId: article.id
            }
          );
          
          // Check if content is already being fetched by individual operation
          if (contentOperationCoordinator.isArticleBeingFetched(article.id)) {
            const activeOperation = contentOperationCoordinator.getActiveOperation(article.id);
            if (activeOperation?.type === 'individual') {
              logger.syncDebug(
                currentSyncId,
                SyncPhase.FETCHING_REMOTE_DATA,
                'content_fetch_skip',
                'Skipping article - individual fetch in progress',
                {
                  articleId: article.id
                }
              );
              // Just get basic article data without content
              const basicArticle = await readeckApiService.getArticleWithContent(article.id);
              articlesWithContent.push({
                ...basicArticle,
                content: basicArticle.content || '' // Keep any existing content
              });
              continue;
            }
          }
          
          try {
            // Use coordinator to fetch content with sync priority
            const content = await contentOperationCoordinator.requestContentFetch({
              articleId: article.id,
              type: 'sync',
              priority: 'normal',
              timeout: 20000, // Shorter timeout for sync operations
              debounceMs: 0 // No debouncing for sync operations
            });
            
            // Get basic article metadata
            const fullArticle = await readeckApiService.getArticleWithContent(article.id);
            
            articlesWithContent.push({
              ...fullArticle,
              content
            });
            
            logger.syncDebug(
              currentSyncId,
              SyncPhase.FETCHING_REMOTE_DATA,
              'content_fetch_success',
              'Successfully fetched content for article',
              {
                articleId: article.id,
                contentLength: content.length
              }
            );
          } catch {
            logger.syncDebug(
              currentSyncId,
              SyncPhase.FETCHING_REMOTE_DATA,
              'content_fetch_fallback',
              'Coordinator fetch failed, falling back to basic article data',
              {
                articleId: article.id
              }
            );
            // Fallback to basic article without content
            const basicArticle = await readeckApiService.getArticleWithContent(article.id);
            articlesWithContent.push(basicArticle);
          }
        } else {
          logger.syncDebug(
            currentSyncId,
            SyncPhase.FETCHING_REMOTE_DATA,
            'content_fetch_skip',
            'Skipping content fetch (fullTextSync disabled)',
            {
              articleId: article.id
            }
          );
          // Just fetch basic article metadata without content
          const basicArticle = await readeckApiService.getArticleWithContent(article.id);
          articlesWithContent.push(basicArticle);
        }
      } catch (error) {
        logger.syncError(
          currentSyncId,
          SyncPhase.FETCHING_REMOTE_DATA,
          'article_fetch_failed',
          'Failed to fetch article',
          error,
          {
            articleId: article.id
          }
        );
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

  private async processPendingSharedUrls(syncId?: string): Promise<void> {
    try {
      const pendingUrls = await ShareService.getPendingSharedUrls();

      const currentSyncId = syncId || `shared_urls_${Date.now()}`;
      
      if (pendingUrls.length === 0) {
        logger.syncLog(
          currentSyncId,
          SyncPhase.FINALIZING,
          'shared_urls_none',
          'No pending shared URLs to process'
        );
        return;
      }

      logger.syncLog(
        currentSyncId,
        SyncPhase.FINALIZING,
        'shared_urls_start',
        'Processing pending shared URLs',
        {
          itemCount: pendingUrls.length
        }
      );

      for (const sharedUrl of pendingUrls) {
        try {
          logger.syncLog(
            currentSyncId,
            SyncPhase.FINALIZING,
            'shared_url_process',
            'Creating article from shared URL',
            {
              url: sharedUrl.url,
              urlId: sharedUrl.id
            }
          );

          await readeckApiService.createArticleWithMetadata({
            url: sharedUrl.url,
            title: sharedUrl.title,
          });

          logger.syncLog(
            currentSyncId,
            SyncPhase.FINALIZING,
            'shared_url_success',
            'Successfully created article for shared URL',
            {
              urlId: sharedUrl.id
            }
          );

          // Remove from queue
          await ShareService.removeFromQueue(sharedUrl.id);
        } catch (error) {
          logger.syncError(
            currentSyncId,
            SyncPhase.FINALIZING,
            'shared_url_error',
            'Error processing shared URL',
            error,
            {
              urlId: sharedUrl.id,
              url: sharedUrl.url
            }
          );
        }
      }
    } catch (error) {
      const currentSyncId = syncId || `shared_urls_${Date.now()}`;
      logger.syncError(
        currentSyncId,
        SyncPhase.FINALIZING,
        'shared_urls_error',
        'Error processing pending shared URLs',
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

  private serializeError(error: any): string {
    try {
      // If error is already a string, return it
      if (typeof error === 'string') return error;
      
      // If error has a message property, use that
      if (error?.message) {
        // Also include status code if available
        if (error?.response?.status) {
          return `${error.message} (Status: ${error.response.status})`;
        }
        return error.message;
      }
      
      // Try to extract meaningful error information from response
      if (error?.response?.data?.message) {
        return `${error.response.data.message} (Status: ${error.response.status || 'unknown'})`;
      }
      
      if (error?.response?.statusText) {
        return `${error.response.statusText} (Status: ${error.response.status || 'unknown'})`;
      }
      
      // Handle axios-specific errors
      if (error?.code) {
        const statusText = error?.response?.status ? ` (Status: ${error.response.status})` : '';
        return `${error.code}: ${error.message || 'Unknown error'}${statusText}`;
      }
      
      // If it's an object, try to extract meaningful properties
      if (typeof error === 'object' && error !== null) {
        const errorInfo = [];
        
        if (error.name) errorInfo.push(`Name: ${error.name}`);
        if (error.code) errorInfo.push(`Code: ${error.code}`);
        if (error.status) errorInfo.push(`Status: ${error.status}`);
        if (error.statusText) errorInfo.push(`Status Text: ${error.statusText}`);
        
        if (errorInfo.length > 0) {
          return errorInfo.join(', ');
        }
        
        // Last resort: try to stringify with key properties
        try {
          const keys = Object.keys(error).filter(key => 
            typeof error[key] !== 'function' && 
            typeof error[key] !== 'object' ||
            key === 'message' || key === 'code' || key === 'status'
          );
          
          if (keys.length > 0) {
            const obj = {};
            keys.forEach(key => {
              obj[key] = error[key];
            });
            return JSON.stringify(obj);
          }
        } catch {
          // If JSON.stringify fails, fall back to simpler approach
        }
      }
      
      // Fallback to toString
      return error?.toString?.() || 'Unknown error occurred';
    } catch (serializationError) {
      return `[Error serialization failed: ${serializationError.message}] Original error type: ${typeof error}`;
    }
  }

  async stopSync(): Promise<void> {
    if (this.isRunning && this.abortController) {
      logger.info('Stopping sync operation', undefined, LogCategory.SYNC);
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
    logger.info('Manual sync triggered by user', undefined, LogCategory.SYNC);
    await this.startFullSync(true);
  }

  /**
   * Fetch content for articles that are missing full content
   * This can be called after sync to ensure all articles have content
   */
  async backfillMissingContent(syncId?: string): Promise<{
    processed: number;
    updated: number;
    errors: number;
  }> {
    const currentSyncId = syncId || `backfill_${Date.now()}`;
    logger.syncLog(
      currentSyncId,
      SyncPhase.FINALIZING,
      'backfill_start',
      'Starting content backfill for articles missing content'
    );
    
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

      logger.syncLog(
        currentSyncId,
        SyncPhase.FINALIZING,
        'backfill_articles_found',
        'Found articles needing content backfill',
        {
          itemCount: articlesNeedingContent.length
        }
      );

      for (const dbArticle of articlesNeedingContent) {
        result.processed++;
        
        try {
          logger.syncDebug(
            currentSyncId,
            SyncPhase.FINALIZING,
            'backfill_article_start',
            'Backfilling content for article',
            {
              articleId: dbArticle.id
            }
          );
          
          const content = await readeckApiService.getArticleContent(dbArticle.content_url);
          
          if (content && content.trim().length > 0) {
            await localStorageService.updateArticle(dbArticle.id, {
              content,
              updated_at: Math.floor(Date.now() / 1000)
            });
            result.updated++;
            
            logger.syncLog(
              currentSyncId,
              SyncPhase.FINALIZING,
              'backfill_article_success',
              'Successfully backfilled content for article',
              {
                articleId: dbArticle.id,
                contentLength: content.length
              }
            );
          } else {
            logger.syncLog(
              currentSyncId,
              SyncPhase.FINALIZING,
              'backfill_article_no_content',
              'No content returned for article',
              {
                articleId: dbArticle.id
              }
            );
          }
        } catch (error) {
          result.errors++;
          logger.syncError(
            currentSyncId,
            SyncPhase.FINALIZING,
            'backfill_article_error',
            'Failed to backfill content for article',
            error,
            {
              articleId: dbArticle.id
            }
          );
        }
      }

      logger.syncLog(
        currentSyncId,
        SyncPhase.FINALIZING,
        'backfill_complete',
        'Content backfill completed',
        {
          processed: result.processed,
          updated: result.updated,
          errors: result.errors
        }
      );
      return result;
    } catch (error) {
      logger.syncError(
        currentSyncId,
        SyncPhase.FINALIZING,
        'backfill_failed',
        'Content backfill failed',
        error
      );
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
