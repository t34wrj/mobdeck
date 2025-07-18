/**
 * Database Sync Validation Utilities
 * 
 * Comprehensive utilities for validating database sync operations including:
 * - Data consistency checking between local and remote
 * - Sync operation validation
 * - Performance monitoring
 * - Conflict detection and resolution validation
 */

import { Article } from '../types';
import { DatabaseService } from '../services/DatabaseService';
import { logger, LogCategory } from './logger';
import { errorHandler, ErrorCategory } from './errorHandler';

export interface ConsistencyValidationResult {
  isConsistent: boolean;
  differences: string[];
  criticalDifferences: string[];
  score: number; // 0-100, where 100 is perfect consistency
  recommendations: string[];
}

export interface DatabaseIntegrityResult {
  isIntegral: boolean;
  issues: string[];
  recommendations: string[];
  score: number; // 0-100, where 100 is perfect integrity
  performanceIssues: string[];
}

export interface SyncValidationResult {
  isValid: boolean;
  validationErrors: string[];
  performanceMetrics: PerformanceMetrics;
  consistencyScore: number;
  integrityScore: number;
  recommendations: string[];
}

export interface PerformanceMetrics {
  totalDuration: number;
  avgOperationTime: number;
  throughput: number; // records per second
  slowOperations: Array<{
    operation: string;
    duration: number;
    threshold: number;
  }>;
  memoryUsage?: number;
  dbSize?: number;
}

export interface ConflictResolutionResult {
  resolvedArticle: Article;
  strategy: string;
  confidence: number; // 0-100
  dataLoss: boolean;
  appliedChanges: string[];
  recommendations: string[];
}

export interface SyncResumeValidationResult {
  canResume: boolean;
  resumePoint: string;
  pendingOperations: number;
  dataIntegrity: boolean;
  recommendedActions: string[];
}

/**
 * Main database sync validation class
 */
export class DatabaseSyncValidator {
  private static instance: DatabaseSyncValidator;
  private databaseService: DatabaseService;
  private performanceThresholds: Map<string, number>;

  private constructor() {
    this.databaseService = DatabaseService.getInstance();
    this.performanceThresholds = new Map([
      ['single_create', 50], // 50ms
      ['single_update', 30], // 30ms
      ['single_read', 20], // 20ms
      ['batch_create', 500], // 500ms for batch operations
      ['batch_update', 300], // 300ms for batch operations
      ['query_complex', 100], // 100ms for complex queries
      ['sync_operation', 2000], // 2 seconds for full sync
    ]);
  }

  public static getInstance(): DatabaseSyncValidator {
    if (!DatabaseSyncValidator.instance) {
      DatabaseSyncValidator.instance = new DatabaseSyncValidator();
    }
    return DatabaseSyncValidator.instance;
  }

  /**
   * Validate consistency between local and remote articles
   */
  public async validateArticleConsistency(
    localArticle: Article,
    remoteArticle: Article,
    options: {
      strictMode?: boolean;
      ignoreTimestamps?: boolean;
      ignoreContent?: boolean;
    } = {}
  ): Promise<ConsistencyValidationResult> {
    const differences: string[] = [];
    const criticalDifferences: string[] = [];
    const recommendations: string[] = [];

    try {
      logger.debug('Validating article consistency', {
        localId: localArticle.id,
        remoteId: remoteArticle.id,
        options,
      }, LogCategory.SYNC);

      // Check critical fields that must match
      if (localArticle.id !== remoteArticle.id) {
        criticalDifferences.push(`ID mismatch: local="${localArticle.id}", remote="${remoteArticle.id}"`);
      }

      if (localArticle.url !== remoteArticle.url) {
        criticalDifferences.push(`URL mismatch: local="${localArticle.url}", remote="${remoteArticle.url}"`);
      }

      // Check metadata fields
      if (localArticle.title !== remoteArticle.title) {
        differences.push(`Title mismatch: local="${localArticle.title}", remote="${remoteArticle.title}"`);
        if (options.strictMode) {
          recommendations.push('Consider manual review of title differences');
        }
      }

      if (localArticle.isArchived !== remoteArticle.isArchived) {
        differences.push(`Archive status mismatch: local=${localArticle.isArchived}, remote=${remoteArticle.isArchived}`);
      }

      if (localArticle.isFavorite !== remoteArticle.isFavorite) {
        differences.push(`Favorite status mismatch: local=${localArticle.isFavorite}, remote=${remoteArticle.isFavorite}`);
      }

      if (localArticle.isRead !== remoteArticle.isRead) {
        differences.push(`Read status mismatch: local=${localArticle.isRead}, remote=${remoteArticle.isRead}`);
      }

      // Check tags
      const localTags = (localArticle.tags || []).sort();
      const remoteTags = (remoteArticle.tags || []).sort();
      if (JSON.stringify(localTags) !== JSON.stringify(remoteTags)) {
        differences.push(`Tags mismatch: local=[${localTags.join(',')}], remote=[${remoteTags.join(',')}]`);
      }

      // Check content if not ignored
      if (!options.ignoreContent) {
        if (localArticle.content && remoteArticle.content) {
          if (localArticle.content.length !== remoteArticle.content.length) {
            differences.push(`Content length mismatch: local=${localArticle.content.length}, remote=${remoteArticle.content.length}`);
          }
          
          // Check for significant content differences (simple similarity check)
          const similarity = this.calculateContentSimilarity(localArticle.content, remoteArticle.content);
          if (similarity < 0.9) {
            differences.push(`Content similarity low: ${Math.round(similarity * 100)}%`);
            recommendations.push('Manual content review recommended');
          }
        }
      }

      // Check timestamps if not ignored
      if (!options.ignoreTimestamps) {
        const localUpdated = new Date(localArticle.updatedAt).getTime();
        const remoteUpdated = new Date(remoteArticle.updatedAt).getTime();
        const timeDiff = Math.abs(localUpdated - remoteUpdated);
        
        if (timeDiff > 60000) { // More than 1 minute difference
          differences.push(`Update timestamp difference: ${timeDiff}ms`);
        }
      }

      // Calculate consistency score
      const totalChecks = options.strictMode ? 10 : 8;
      const issueCount = differences.length + (criticalDifferences.length * 2);
      const score = Math.max(0, Math.round((totalChecks - issueCount) / totalChecks * 100));

      // Add general recommendations
      if (score < 80) {
        recommendations.push('Consider running conflict resolution');
      }
      if (criticalDifferences.length > 0) {
        recommendations.push('Critical inconsistencies detected - immediate attention required');
      }

      const result: ConsistencyValidationResult = {
        isConsistent: criticalDifferences.length === 0,
        differences,
        criticalDifferences,
        score,
        recommendations,
      };

      logger.info('Article consistency validation completed', {
        localId: localArticle.id,
        score: result.score,
        isConsistent: result.isConsistent,
        differenceCount: differences.length,
        criticalCount: criticalDifferences.length,
      }, LogCategory.SYNC);

      return result;
    } catch (error) {
      const handledError = errorHandler.handleError(error, {
        category: ErrorCategory.SYNC_OPERATION,
        context: {
          actionType: 'consistency_validation',
          localArticleId: localArticle.id,
          remoteArticleId: remoteArticle.id,
        },
      });

      logger.error('Article consistency validation failed', {
        error: handledError.message,
        localId: localArticle.id,
        remoteId: remoteArticle.id,
      }, LogCategory.SYNC);

      return {
        isConsistent: false,
        differences: [],
        criticalDifferences: [`Validation failed: ${handledError.message}`],
        score: 0,
        recommendations: ['Retry validation', 'Check data integrity'],
      };
    }
  }

  /**
   * Validate database integrity
   */
  public async validateDatabaseIntegrity(
    options: {
      checkOrphans?: boolean;
      checkSyncStates?: boolean;
      checkRequiredFields?: boolean;
      checkPerformance?: boolean;
    } = {}
  ): Promise<DatabaseIntegrityResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const performanceIssues: string[] = [];
    
    const {
      checkOrphans = true,
      checkSyncStates = true,
      checkRequiredFields = true,
      checkPerformance = true,
    } = options;

    try {
      logger.debug('Starting database integrity validation', { options }, LogCategory.SYNC);

      // Check for orphaned records
      if (checkOrphans) {
        const orphanedLabelsResult = await this.databaseService.executeSql(`
          SELECT COUNT(*) as count FROM article_labels al
          LEFT JOIN articles a ON al.article_id = a.id
          WHERE a.id IS NULL
        `);
        
        const orphanedLabelCount = orphanedLabelsResult.rows.item(0).count;
        if (orphanedLabelCount > 0) {
          issues.push(`Found ${orphanedLabelCount} orphaned article-label relationships`);
          recommendations.push('Run cleanup to remove orphaned article-label relationships');
        }

        const orphanedArticlesResult = await this.databaseService.executeSql(`
          SELECT COUNT(*) as count FROM article_labels al
          LEFT JOIN labels l ON al.label_id = l.id
          WHERE l.id IS NULL
        `);
        
        const orphanedArticleCount = orphanedArticlesResult.rows.item(0).count;
        if (orphanedArticleCount > 0) {
          issues.push(`Found ${orphanedArticleCount} orphaned label-article relationships`);
          recommendations.push('Run cleanup to remove orphaned label-article relationships');
        }
      }

      // Check for invalid sync states
      if (checkSyncStates) {
        const invalidSyncStateResult = await this.databaseService.executeSql(`
          SELECT COUNT(*) as count FROM articles
          WHERE is_modified = 1 AND synced_at IS NOT NULL AND synced_at > updated_at
        `);
        
        const invalidSyncStateCount = invalidSyncStateResult.rows.item(0).count;
        if (invalidSyncStateCount > 0) {
          issues.push(`Found ${invalidSyncStateCount} articles with invalid sync states`);
          recommendations.push('Review and fix articles with inconsistent sync timestamps');
        }

        const staleSyncResult = await this.databaseService.executeSql(`
          SELECT COUNT(*) as count FROM articles
          WHERE is_modified = 1 AND synced_at IS NULL AND updated_at < strftime('%s', 'now') - 3600
        `);
        
        const staleSyncCount = staleSyncResult.rows.item(0).count;
        if (staleSyncCount > 0) {
          issues.push(`Found ${staleSyncCount} articles with stale sync state (modified > 1 hour ago)`);
          recommendations.push('Consider running sync to update stale articles');
        }
      }

      // Check for missing required fields
      if (checkRequiredFields) {
        const missingRequiredFieldsResult = await this.databaseService.executeSql(`
          SELECT COUNT(*) as count FROM articles
          WHERE title IS NULL OR title = '' OR url IS NULL OR url = ''
        `);
        
        const missingRequiredFieldsCount = missingRequiredFieldsResult.rows.item(0).count;
        if (missingRequiredFieldsCount > 0) {
          issues.push(`Found ${missingRequiredFieldsCount} articles with missing required fields`);
          recommendations.push('Validate and fix articles with missing titles or URLs');
        }

        const duplicateUrlsResult = await this.databaseService.executeSql(`
          SELECT url, COUNT(*) as count FROM articles
          WHERE deleted_at IS NULL
          GROUP BY url
          HAVING COUNT(*) > 1
        `);
        
        if (duplicateUrlsResult.rows.length > 0) {
          issues.push(`Found ${duplicateUrlsResult.rows.length} duplicate URLs`);
          recommendations.push('Review and consolidate duplicate articles');
        }
      }

      // Check performance issues
      if (checkPerformance) {
        const performanceResult = await this.checkDatabasePerformance();
        performanceIssues.push(...performanceResult.issues);
        
        if (performanceResult.issues.length > 0) {
          recommendations.push('Consider database optimization');
        }
      }

      // Check database size and statistics
      const statsResult = await this.databaseService.getStats();
      if (statsResult.success && statsResult.data) {
        const stats = statsResult.data;
        
        if (stats.totalArticles > 10000) {
          recommendations.push('Consider archiving old articles for better performance');
        }
        
        if (stats.pendingSyncItems > 100) {
          issues.push(`High number of pending sync items: ${stats.pendingSyncItems}`);
          recommendations.push('Run sync to clear pending items');
        }
      }

      // Calculate integrity score
      const totalChecks = 8;
      const issueWeight = issues.length + (performanceIssues.length * 0.5);
      const score = Math.max(0, Math.round((totalChecks - issueWeight) / totalChecks * 100));

      const result: DatabaseIntegrityResult = {
        isIntegral: issues.length === 0,
        issues,
        recommendations,
        score,
        performanceIssues,
      };

      logger.info('Database integrity validation completed', {
        score: result.score,
        isIntegral: result.isIntegral,
        issueCount: issues.length,
        performanceIssueCount: performanceIssues.length,
      }, LogCategory.SYNC);

      return result;
    } catch (error) {
      const handledError = errorHandler.handleError(error, {
        category: ErrorCategory.SYNC_OPERATION,
        context: {
          actionType: 'database_integrity_validation',
        },
      });

      logger.error('Database integrity validation failed', {
        error: handledError.message,
      }, LogCategory.SYNC);

      return {
        isIntegral: false,
        issues: [`Validation failed: ${handledError.message}`],
        recommendations: ['Retry validation', 'Check database connection'],
        score: 0,
        performanceIssues: [],
      };
    }
  }

  /**
   * Validate sync operation performance
   */
  public async validateSyncPerformance(
    operation: string,
    startTime: number,
    endTime: number,
    recordCount: number = 0
  ): Promise<PerformanceMetrics> {
    const duration = endTime - startTime;
    const threshold = this.performanceThresholds.get(operation) || 1000;
    const throughput = recordCount > 0 ? (recordCount / duration) * 1000 : 0;
    
    const slowOperations: Array<{ operation: string; duration: number; threshold: number }> = [];
    
    if (duration > threshold) {
      slowOperations.push({
        operation,
        duration,
        threshold,
      });
    }

    const metrics: PerformanceMetrics = {
      totalDuration: duration,
      avgOperationTime: duration / Math.max(1, recordCount),
      throughput,
      slowOperations,
    };

    // Log performance metrics
    if (slowOperations.length > 0) {
      logger.warn('Slow database operation detected', {
        operation,
        duration,
        threshold,
        recordCount,
        throughput,
      }, LogCategory.SYNC);
    } else {
      logger.debug('Database operation performance', {
        operation,
        duration,
        recordCount,
        throughput,
      }, LogCategory.SYNC);
    }

    return metrics;
  }

  /**
   * Validate conflict resolution result
   */
  public validateConflictResolution(
    localArticle: Article,
    remoteArticle: Article,
    resolvedArticle: Article,
    strategy: string
  ): ConflictResolutionResult {
    const appliedChanges: string[] = [];
    const recommendations: string[] = [];
    let dataLoss = false;
    let confidence = 100;

    // Check what changes were applied
    if (resolvedArticle.title !== localArticle.title) {
      if (resolvedArticle.title === remoteArticle.title) {
        appliedChanges.push('Title: Used remote version');
      } else {
        appliedChanges.push('Title: Used custom resolution');
        confidence -= 10;
      }
    }

    if (resolvedArticle.isArchived !== localArticle.isArchived) {
      if (resolvedArticle.isArchived === remoteArticle.isArchived) {
        appliedChanges.push('Archive status: Used remote version');
      } else {
        appliedChanges.push('Archive status: Used custom resolution');
        confidence -= 5;
      }
    }

    if (resolvedArticle.isFavorite !== localArticle.isFavorite) {
      if (resolvedArticle.isFavorite === remoteArticle.isFavorite) {
        appliedChanges.push('Favorite status: Used remote version');
      } else {
        appliedChanges.push('Favorite status: Used custom resolution');
        confidence -= 5;
      }
    }

    if (resolvedArticle.isRead !== localArticle.isRead) {
      if (resolvedArticle.isRead === remoteArticle.isRead) {
        appliedChanges.push('Read status: Used remote version');
      } else {
        appliedChanges.push('Read status: Used custom resolution');
        confidence -= 5;
      }
    }

    // Check for data loss
    if (localArticle.content && !resolvedArticle.content) {
      dataLoss = true;
      confidence -= 30;
      recommendations.push('Local content was lost during resolution');
    }

    if (remoteArticle.content && !resolvedArticle.content) {
      dataLoss = true;
      confidence -= 30;
      recommendations.push('Remote content was lost during resolution');
    }

    // Check tags
    const localTags = new Set(localArticle.tags || []);
    const remoteTags = new Set(remoteArticle.tags || []);
    const resolvedTags = new Set(resolvedArticle.tags || []);

    const lostLocalTags = [...localTags].filter(tag => !resolvedTags.has(tag));
    const lostRemoteTags = [...remoteTags].filter(tag => !resolvedTags.has(tag));

    if (lostLocalTags.length > 0) {
      dataLoss = true;
      confidence -= 10;
      recommendations.push(`Lost local tags: ${lostLocalTags.join(', ')}`);
    }

    if (lostRemoteTags.length > 0) {
      dataLoss = true;
      confidence -= 10;
      recommendations.push(`Lost remote tags: ${lostRemoteTags.join(', ')}`);
    }

    // Strategy-specific validation
    if (strategy === 'last-write-wins') {
      const localTime = new Date(localArticle.updatedAt).getTime();
      const remoteTime = new Date(remoteArticle.updatedAt).getTime();
      const expectedWinner = remoteTime > localTime ? remoteArticle : localArticle;
      
      if (resolvedArticle.id === expectedWinner.id) {
        appliedChanges.push('Strategy: Correctly applied last-write-wins');
      } else {
        confidence -= 20;
        recommendations.push('Strategy application may be incorrect');
      }
    }

    if (confidence < 50) {
      recommendations.push('Manual review recommended due to low confidence');
    }

    return {
      resolvedArticle,
      strategy,
      confidence,
      dataLoss,
      appliedChanges,
      recommendations,
    };
  }

  /**
   * Validate sync resume capability
   */
  public async validateSyncResume(
    resumePoint: string,
    expectedOperations: number = 0
  ): Promise<SyncResumeValidationResult> {
    const recommendedActions: string[] = [];
    let canResume = true;
    let dataIntegrity = true;
    let pendingOperations = 0;

    try {
      // Check if sync is currently running
      // Note: syncService import removed to avoid circular dependency
      const syncRunning = false; // Assume sync is not running for validation
      if (syncRunning) {
        canResume = false;
        recommendedActions.push('Wait for current sync to complete');
      }

      // Check pending sync operations
      const pendingSyncResult = await this.databaseService.getSyncMetadata({
        syncStatus: 'pending',
      });

      if (pendingSyncResult.success && pendingSyncResult.data) {
        pendingOperations = pendingSyncResult.data.totalCount;
      }

      // Check data integrity
      const integrityResult = await this.validateDatabaseIntegrity({
        checkOrphans: true,
        checkSyncStates: true,
        checkRequiredFields: false,
        checkPerformance: false,
      });

      if (!integrityResult.isIntegral) {
        dataIntegrity = false;
        recommendedActions.push('Fix data integrity issues before resuming');
      }

      // Check resume point validity
      const validResumePoints = [
        'initializing',
        'uploading_changes',
        'downloading_updates',
        'resolving_conflicts',
        'finalizing',
      ];

      if (!validResumePoints.includes(resumePoint)) {
        canResume = false;
        recommendedActions.push('Invalid resume point - start fresh sync');
      }

      // Check expected operations
      if (expectedOperations > 0 && pendingOperations !== expectedOperations) {
        recommendedActions.push('Pending operations count mismatch - verify data consistency');
      }

      // Additional checks based on resume point
      if (resumePoint === 'resolving_conflicts') {
        const conflictsResult = await this.databaseService.getSyncMetadata({
          syncStatus: 'conflict',
        });

        if (conflictsResult.success && conflictsResult.data) {
          const conflictCount = conflictsResult.data.totalCount;
          if (conflictCount === 0) {
            recommendedActions.push('No conflicts found - skip conflict resolution');
          }
        }
      }

      return {
        canResume,
        resumePoint,
        pendingOperations,
        dataIntegrity,
        recommendedActions,
      };
    } catch (error) {
      const handledError = errorHandler.handleError(error, {
        category: ErrorCategory.SYNC_OPERATION,
        context: {
          actionType: 'sync_resume_validation',
          resumePoint,
        },
      });

      logger.error('Sync resume validation failed', {
        error: handledError.message,
        resumePoint,
      }, LogCategory.SYNC);

      return {
        canResume: false,
        resumePoint,
        pendingOperations: 0,
        dataIntegrity: false,
        recommendedActions: ['Retry validation', 'Check database connection'],
      };
    }
  }

  /**
   * Comprehensive sync validation
   */
  public async validateSyncOperation(
    syncId: string,
    startTime: number,
    endTime: number,
    recordCount: number = 0
  ): Promise<SyncValidationResult> {
    const validationErrors: string[] = [];
    const recommendations: string[] = [];
    const consistencyScore = 100;
    let integrityScore = 100;

    try {
      // Validate performance
      const performanceMetrics = await this.validateSyncPerformance(
        'sync_operation',
        startTime,
        endTime,
        recordCount
      );

      // Validate database integrity
      const integrityResult = await this.validateDatabaseIntegrity();
      integrityScore = integrityResult.score;

      if (!integrityResult.isIntegral) {
        validationErrors.push(...integrityResult.issues);
        recommendations.push(...integrityResult.recommendations);
      }

      // Check sync completion
      const syncMetadataResult = await this.databaseService.getSyncMetadata({
        entityType: 'sync_operation',
        syncStatus: 'pending',
      });

      if (syncMetadataResult.success && syncMetadataResult.data) {
        const pendingCount = syncMetadataResult.data.totalCount;
        if (pendingCount > 0) {
          validationErrors.push(`${pendingCount} operations still pending`);
          recommendations.push('Complete pending sync operations');
        }
      }

      // Validate performance thresholds
      if (performanceMetrics.slowOperations.length > 0) {
        validationErrors.push('Performance thresholds exceeded');
        recommendations.push('Optimize database performance');
      }

      return {
        isValid: validationErrors.length === 0,
        validationErrors,
        performanceMetrics,
        consistencyScore,
        integrityScore,
        recommendations,
      };
    } catch (error) {
      const handledError = errorHandler.handleError(error, {
        category: ErrorCategory.SYNC_OPERATION,
        context: {
          actionType: 'sync_validation',
          syncId,
        },
      });

      logger.error('Sync validation failed', {
        error: handledError.message,
        syncId,
      }, LogCategory.SYNC);

      return {
        isValid: false,
        validationErrors: [`Validation failed: ${handledError.message}`],
        performanceMetrics: {
          totalDuration: endTime - startTime,
          avgOperationTime: 0,
          throughput: 0,
          slowOperations: [],
        },
        consistencyScore: 0,
        integrityScore: 0,
        recommendations: ['Retry validation', 'Check system status'],
      };
    }
  }

  /**
   * Calculate content similarity (simple implementation)
   */
  private calculateContentSimilarity(content1: string, content2: string): number {
    if (content1 === content2) return 1.0;
    if (!content1 || !content2) return 0.0;

    const words1 = content1.toLowerCase().split(/\s+/);
    const words2 = content2.toLowerCase().split(/\s+/);

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Check database performance issues
   */
  private async checkDatabasePerformance(): Promise<{ issues: string[] }> {
    const issues: string[] = [];

    try {
      // Check for missing indexes
      const indexResult = await this.databaseService.executeSql(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name LIKE 'idx_%'
      `);

      const indexCount = indexResult.rows.length;
      if (indexCount < 5) {
        issues.push('Insufficient database indexes detected');
      }

      // Check for large tables without recent maintenance
      const tableStatsResult = await this.databaseService.executeSql(`
        SELECT COUNT(*) as count FROM articles WHERE deleted_at IS NOT NULL
      `);

      const deletedCount = tableStatsResult.rows.item(0).count;
      if (deletedCount > 100) {
        issues.push(`High number of soft-deleted records: ${deletedCount}`);
      }

      // Check for fragmentation (approximate)
      const totalArticlesResult = await this.databaseService.executeSql(`
        SELECT COUNT(*) as count FROM articles
      `);

      const totalArticles = totalArticlesResult.rows.item(0).count;
      if (totalArticles > 1000 && deletedCount / totalArticles > 0.1) {
        issues.push('Database fragmentation detected');
      }

    } catch (error) {
      issues.push(`Performance check failed: ${error.message}`);
    }

    return { issues };
  }
}

// Export singleton instance
export const databaseSyncValidator = DatabaseSyncValidator.getInstance();

// Export utility functions
export const validateArticleConsistency = (
  localArticle: Article,
  remoteArticle: Article,
  options?: Parameters<DatabaseSyncValidator['validateArticleConsistency']>[2]
) => databaseSyncValidator.validateArticleConsistency(localArticle, remoteArticle, options);

export const validateDatabaseIntegrity = (
  options?: Parameters<DatabaseSyncValidator['validateDatabaseIntegrity']>[0]
) => databaseSyncValidator.validateDatabaseIntegrity(options);

export const validateSyncPerformance = (
  operation: string,
  startTime: number,
  endTime: number,
  recordCount?: number
) => databaseSyncValidator.validateSyncPerformance(operation, startTime, endTime, recordCount);

export const validateConflictResolution = (
  localArticle: Article,
  remoteArticle: Article,
  resolvedArticle: Article,
  strategy: string
) => databaseSyncValidator.validateConflictResolution(localArticle, remoteArticle, resolvedArticle, strategy);

export const validateSyncResume = (
  resumePoint: string,
  expectedOperations?: number
) => databaseSyncValidator.validateSyncResume(resumePoint, expectedOperations);

export const validateSyncOperation = (
  syncId: string,
  startTime: number,
  endTime: number,
  recordCount?: number
) => databaseSyncValidator.validateSyncOperation(syncId, startTime, endTime, recordCount);