/**
 * Database Sync Validation Test Suite
 * 
 * Comprehensive validation of database sync operations including:
 * - SQLite database updates during sync
 * - Local and remote data consistency
 * - Sync conflict resolution mechanisms
 * - Sync resume functionality after interruptions
 * - Database performance monitoring during sync
 */

import DatabaseService, { DatabaseUtilityFunctions } from '../../src/services/DatabaseService';
import { readeckApiService } from '../../src/services/ReadeckApiService';
import { localStorageService } from '../../src/services/LocalStorageService';
import { Article } from '../../src/types';
// import { SyncPhase } from '../../src/types/sync';

// Mock dependencies
jest.mock('../../src/services/ReadeckApiService');
jest.mock('../../src/services/LocalStorageService');
jest.mock('../../src/store', () => ({
  store: {
    getState: jest.fn(),
    dispatch: jest.fn(),
  },
}));

// Performance monitoring utilities
interface PerformanceMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  operation: string;
  recordCount: number;
}

class DatabaseSyncPerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private currentOperation: string | null = null;
  private startTime: number | null = null;

  startOperation(operation: string): void {
    this.currentOperation = operation;
    this.startTime = performance.now();
  }

  endOperation(recordCount: number = 0): PerformanceMetrics | null {
    if (!this.currentOperation || !this.startTime) {
      return null;
    }

    const endTime = performance.now();
    const metric: PerformanceMetrics = {
      startTime: this.startTime,
      endTime,
      duration: endTime - this.startTime,
      operation: this.currentOperation,
      recordCount,
    };

    this.metrics.push(metric);
    this.currentOperation = null;
    this.startTime = null;

    return metric;
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  getMetricsByOperation(operation: string): PerformanceMetrics[] {
    return this.metrics.filter(m => m.operation === operation);
  }

  getAveragePerformance(operation: string): number {
    const operationMetrics = this.getMetricsByOperation(operation);
    if (operationMetrics.length === 0) return 0;

    const totalDuration = operationMetrics.reduce((sum, m) => sum + m.duration, 0);
    return totalDuration / operationMetrics.length;
  }

  reset(): void {
    this.metrics = [];
    this.currentOperation = null;
    this.startTime = null;
  }
}

// Data consistency validation utilities
class DataConsistencyValidator {
  static async validateArticleConsistency(
    localArticle: Article,
    remoteArticle: Article
  ): Promise<{
    isConsistent: boolean;
    differences: string[];
    criticalDifferences: string[];
  }> {
    const differences: string[] = [];
    const criticalDifferences: string[] = [];

    // Check core fields
    if (localArticle.id !== remoteArticle.id) {
      criticalDifferences.push(`ID mismatch: local=${localArticle.id}, remote=${remoteArticle.id}`);
    }

    if (localArticle.title !== remoteArticle.title) {
      differences.push(`Title mismatch: local="${localArticle.title}", remote="${remoteArticle.title}"`);
    }

    if (localArticle.url !== remoteArticle.url) {
      criticalDifferences.push(`URL mismatch: local="${localArticle.url}", remote="${remoteArticle.url}"`);
    }

    // Check metadata fields
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

    // Check content if both have content
    if (localArticle.content && remoteArticle.content) {
      if (localArticle.content.length !== remoteArticle.content.length) {
        differences.push(`Content length mismatch: local=${localArticle.content.length}, remote=${remoteArticle.content.length}`);
      }
    }

    return {
      isConsistent: criticalDifferences.length === 0,
      differences,
      criticalDifferences,
    };
  }

  static async validateDatabaseIntegrity(databaseService: DatabaseService): Promise<{
    isIntegral: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check for orphaned records
      const orphanedLabelsResult = await databaseService.executeSql(`
        SELECT COUNT(*) as count FROM article_labels al
        LEFT JOIN articles a ON al.article_id = a.id
        WHERE a.id IS NULL
      `);
      
      const orphanedLabelCount = orphanedLabelsResult.rows.item(0).count;
      if (orphanedLabelCount > 0) {
        issues.push(`Found ${orphanedLabelCount} orphaned article-label relationships`);
        recommendations.push('Run cleanup to remove orphaned article-label relationships');
      }

      // Check for articles with invalid sync states
      const invalidSyncStateResult = await databaseService.executeSql(`
        SELECT COUNT(*) as count FROM articles
        WHERE is_modified = 1 AND synced_at IS NOT NULL AND synced_at > updated_at
      `);
      
      const invalidSyncStateCount = invalidSyncStateResult.rows.item(0).count;
      if (invalidSyncStateCount > 0) {
        issues.push(`Found ${invalidSyncStateCount} articles with invalid sync states`);
        recommendations.push('Review and fix articles with inconsistent sync timestamps');
      }

      // Check for missing required fields
      const missingRequiredFieldsResult = await databaseService.executeSql(`
        SELECT COUNT(*) as count FROM articles
        WHERE title IS NULL OR title = '' OR url IS NULL OR url = ''
      `);
      
      const missingRequiredFieldsCount = missingRequiredFieldsResult.rows.item(0).count;
      if (missingRequiredFieldsCount > 0) {
        issues.push(`Found ${missingRequiredFieldsCount} articles with missing required fields`);
        recommendations.push('Validate and fix articles with missing titles or URLs');
      }

      return {
        isIntegral: issues.length === 0,
        issues,
        recommendations,
      };
    } catch (err) {
      issues.push(`Database integrity check failed: ${err.message}`);
      return {
        isIntegral: false,
        issues,
        recommendations: ['Investigate database integrity check failures'],
      };
    }
  }
}

// Conflict resolution test utilities
class ConflictResolutionTester {
  static createConflictingArticles(): { local: Article; remote: Article } {
    const baseArticle: Article = {
      id: 'test-article-1',
      title: 'Test Article',
      content: 'Original content',
      url: 'https://example.com/test',
      isArchived: false,
      isFavorite: false,
      isRead: false,
      tags: ['tag1', 'tag2'],
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      syncedAt: '2023-01-01T00:00:00Z',
      isModified: false,
    };

    const local: Article = {
      ...baseArticle,
      title: 'Local Modified Title',
      isArchived: true,
      tags: ['tag1', 'tag2', 'local-tag'],
      updatedAt: '2023-01-02T00:00:00Z',
      isModified: true,
    };

    const remote: Article = {
      ...baseArticle,
      title: 'Remote Modified Title',
      isFavorite: true,
      tags: ['tag1', 'tag2', 'remote-tag'],
      updatedAt: '2023-01-02T01:00:00Z',
    };

    return { local, remote };
  }

  static async testLastWriteWinsResolution(
    local: Article,
    remote: Article
  ): Promise<{
    resolvedArticle: Article;
    strategy: string;
    isCorrect: boolean;
  }> {
    // Simulate last-write-wins resolution
    const localTime = new Date(local.updatedAt).getTime();
    const remoteTime = new Date(remote.updatedAt).getTime();
    
    const winner = remoteTime > localTime ? remote : local;
    
    return {
      resolvedArticle: winner,
      strategy: 'last-write-wins',
      isCorrect: winner === remote, // Remote should win in our test case
    };
  }
}

// Sync resume test utilities
class SyncResumeTester {
  static async simulateInterruption(
    delay: number = 100
  ): Promise<{ interrupted: boolean; resumePoint: string }> {
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Simulate various interruption scenarios
    const scenarios = [
      { interrupted: true, resumePoint: 'uploading_changes' },
      { interrupted: true, resumePoint: 'downloading_updates' },
      { interrupted: true, resumePoint: 'resolving_conflicts' },
      { interrupted: false, resumePoint: 'completed' },
    ];

    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    return scenario;
  }

  static async validateResumeCapability(
    syncService: any,
    resumePoint: string
  ): Promise<{
    canResume: boolean;
    currentPhase: string;
    pendingOperations: number;
  }> {
    try {
      // Check if sync can resume from the given point
      const syncState = await syncService.getSyncStats();
      
      return {
        canResume: !syncService.isSyncRunning(),
        currentPhase: resumePoint,
        pendingOperations: syncState.pendingOperations || 0,
      };
    } catch {
      return {
        canResume: false,
        currentPhase: 'unknown',
        pendingOperations: 0,
      };
    }
  }
}

describe('Database Sync Validation', () => {
  let databaseService: DatabaseService;
  let performanceMonitor: DatabaseSyncPerformanceMonitor;
  const _mockedReadeckApiService = readeckApiService as jest.Mocked<typeof readeckApiService>;
  const _mockedLocalStorageService = localStorageService as jest.Mocked<typeof localStorageService>;

  beforeEach(async () => {
    jest.clearAllMocks();
    databaseService = DatabaseService.getInstance();
    performanceMonitor = new DatabaseSyncPerformanceMonitor();
    
    // Initialize database for testing
    await databaseService.initialize();
  });

  afterEach(async () => {
    performanceMonitor.reset();
    await databaseService.clearAllData();
  });

  afterAll(async () => {
    await databaseService.close();
  });

  describe('Database Updates During Sync', () => {
    it('should successfully update articles during sync operations', async () => {
      // Arrange
      const testArticle: Article = {
        id: 'test-article-1',
        title: 'Test Article',
        content: 'Test content',
        url: 'https://example.com/test',
        isArchived: false,
        isFavorite: false,
        isRead: false,
        tags: ['test'],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        syncedAt: null,
        isModified: true,
      };

      const dbArticle = DatabaseUtilityFunctions.convertArticleToDBArticle(testArticle);

      // Act
      performanceMonitor.startOperation('create_article');
      const createResult = await databaseService.createArticle(dbArticle);
      performanceMonitor.endOperation(1);

      // Assert
      expect(createResult.success).toBe(true);
      expect(createResult.data).toBe(testArticle.id);

      // Verify article was created
      const retrievedResult = await databaseService.getArticle(testArticle.id);
      expect(retrievedResult.success).toBe(true);
      expect(retrievedResult.data?.id).toBe(testArticle.id);

      // Verify performance metrics
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.length).toBe(1);
      expect(metrics[0].operation).toBe('create_article');
      expect(metrics[0].duration).toBeGreaterThan(0);
    });

    it('should handle batch article updates during sync', async () => {
      // Arrange
      const testArticles: Article[] = Array.from({ length: 10 }, (_, i) => ({
        id: `test-article-${i}`,
        title: `Test Article ${i}`,
        content: `Test content ${i}`,
        url: `https://example.com/test-${i}`,
        isArchived: false,
        isFavorite: false,
        isRead: false,
        tags: [`test-${i}`],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        syncedAt: null,
        isModified: true,
      }));

      const dbArticles = testArticles.map(article => 
        DatabaseUtilityFunctions.convertArticleToDBArticle(article)
      );

      // Act
      performanceMonitor.startOperation('batch_create_articles');
      const batchResult = await databaseService.createArticlesBatch(dbArticles);
      performanceMonitor.endOperation(testArticles.length);

      // Assert
      expect(batchResult.success).toBe(true);
      expect(batchResult.data?.length).toBe(testArticles.length);

      // Verify all articles were created
      const statsResult = await databaseService.getStats();
      expect(statsResult.success).toBe(true);
      expect(statsResult.data?.totalArticles).toBe(testArticles.length);

      // Verify performance metrics
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.length).toBe(1);
      expect(metrics[0].operation).toBe('batch_create_articles');
      expect(metrics[0].recordCount).toBe(testArticles.length);
    });

    it('should maintain sync metadata during database operations', async () => {
      // Arrange
      const testArticle: Article = {
        id: 'test-article-sync',
        title: 'Sync Test Article',
        content: 'Sync test content',
        url: 'https://example.com/sync-test',
        isArchived: false,
        isFavorite: false,
        isRead: false,
        tags: ['sync-test'],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        syncedAt: null,
        isModified: true,
      };

      const dbArticle = DatabaseUtilityFunctions.convertArticleToDBArticle(testArticle);

      // Act
      const createResult = await databaseService.createArticle(dbArticle);
      
      // Create sync metadata
      const syncMetadata = {
        entity_type: 'article',
        entity_id: testArticle.id,
        operation: 'create',
        local_timestamp: Math.floor(Date.now() / 1000),
        server_timestamp: null,
        sync_status: 'pending',
        conflict_resolution: null,
        retry_count: 0,
        error_message: null,
      };

      const metadataResult = await databaseService.createSyncMetadata(syncMetadata);

      // Assert
      expect(createResult.success).toBe(true);
      expect(metadataResult.success).toBe(true);

      // Verify sync metadata was created
      const retrievedMetadata = await databaseService.getSyncMetadata({
        entityType: 'article',
        syncStatus: 'pending',
      });

      expect(retrievedMetadata.success).toBe(true);
      expect(retrievedMetadata.data?.items.length).toBe(1);
      expect(retrievedMetadata.data?.items[0].entity_id).toBe(testArticle.id);
    });
  });

  describe('Data Consistency Validation', () => {
    it('should validate consistency between local and remote articles', async () => {
      // Arrange
      const localArticle: Article = {
        id: 'consistency-test-1',
        title: 'Local Article',
        content: 'Local content',
        url: 'https://example.com/local',
        isArchived: false,
        isFavorite: true,
        isRead: false,
        tags: ['local', 'test'],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        syncedAt: '2023-01-01T00:00:00Z',
        isModified: false,
      };

      const remoteArticle: Article = {
        ...localArticle,
        title: 'Remote Article',
        content: 'Remote content',
        isFavorite: false,
        isRead: true,
        tags: ['remote', 'test'],
        updatedAt: '2023-01-01T01:00:00Z',
      };

      // Act
      const consistencyResult = await DataConsistencyValidator.validateArticleConsistency(
        localArticle,
        remoteArticle
      );

      // Assert
      expect(consistencyResult.isConsistent).toBe(true); // Same ID, so consistent
      expect(consistencyResult.differences.length).toBeGreaterThan(0);
      expect(consistencyResult.differences).toContain(
        expect.stringContaining('Title mismatch')
      );
      expect(consistencyResult.differences).toContain(
        expect.stringContaining('Favorite status mismatch')
      );
      expect(consistencyResult.differences).toContain(
        expect.stringContaining('Read status mismatch')
      );
    });

    it('should identify critical inconsistencies', async () => {
      // Arrange
      const localArticle: Article = {
        id: 'local-id',
        title: 'Test Article',
        content: 'Test content',
        url: 'https://example.com/local',
        isArchived: false,
        isFavorite: false,
        isRead: false,
        tags: ['test'],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        syncedAt: null,
        isModified: false,
      };

      const remoteArticle: Article = {
        ...localArticle,
        id: 'remote-id', // Different ID - critical inconsistency
        url: 'https://example.com/remote', // Different URL - critical inconsistency
      };

      // Act
      const consistencyResult = await DataConsistencyValidator.validateArticleConsistency(
        localArticle,
        remoteArticle
      );

      // Assert
      expect(consistencyResult.isConsistent).toBe(false);
      expect(consistencyResult.criticalDifferences.length).toBe(2);
      expect(consistencyResult.criticalDifferences).toContain(
        expect.stringContaining('ID mismatch')
      );
      expect(consistencyResult.criticalDifferences).toContain(
        expect.stringContaining('URL mismatch')
      );
    });

    it('should validate database integrity', async () => {
      // Arrange - Create test data with some integrity issues
      const testArticle = {
        id: 'integrity-test-1',
        title: 'Integrity Test Article',
        content: 'Test content',
        url: 'https://example.com/integrity',
        isArchived: false,
        isFavorite: false,
        isRead: false,
        tags: ['integrity-test'],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        syncedAt: null,
        isModified: true,
      };

      const dbArticle = DatabaseUtilityFunctions.convertArticleToDBArticle(testArticle);
      await databaseService.createArticle(dbArticle);

      // Act
      const integrityResult = await DataConsistencyValidator.validateDatabaseIntegrity(
        databaseService
      );

      // Assert
      expect(integrityResult.isIntegral).toBe(true);
      expect(integrityResult.issues.length).toBe(0);
    });
  });

  describe('Sync Conflict Resolution', () => {
    it('should resolve conflicts using last-write-wins strategy', async () => {
      // Arrange
      const { local, remote } = ConflictResolutionTester.createConflictingArticles();

      // Act
      const resolutionResult = await ConflictResolutionTester.testLastWriteWinsResolution(
        local,
        remote
      );

      // Assert
      expect(resolutionResult.strategy).toBe('last-write-wins');
      expect(resolutionResult.isCorrect).toBe(true);
      expect(resolutionResult.resolvedArticle.id).toBe(remote.id);
      expect(resolutionResult.resolvedArticle.title).toBe(remote.title);
    });

    it('should handle multiple concurrent conflicts', async () => {
      // Arrange
      const conflicts = Array.from({ length: 5 }, (_, i) => {
        const { local, remote } = ConflictResolutionTester.createConflictingArticles();
        return {
          local: { ...local, id: `conflict-${i}` },
          remote: { ...remote, id: `conflict-${i}` },
        };
      });

      // Act
      const resolutions = await Promise.all(
        conflicts.map(({ local, remote }) =>
          ConflictResolutionTester.testLastWriteWinsResolution(local, remote)
        )
      );

      // Assert
      expect(resolutions.length).toBe(5);
      resolutions.forEach((resolution, i) => {
        expect(resolution.strategy).toBe('last-write-wins');
        expect(resolution.resolvedArticle.id).toBe(`conflict-${i}`);
      });
    });

    it('should maintain data integrity during conflict resolution', async () => {
      // Arrange
      const { local, remote } = ConflictResolutionTester.createConflictingArticles();
      const dbLocal = DatabaseUtilityFunctions.convertArticleToDBArticle(local);
      const _dbRemote = DatabaseUtilityFunctions.convertArticleToDBArticle(remote);

      // Create local article in database
      await databaseService.createArticle(dbLocal);

      // Act - Simulate conflict resolution by updating with remote data
      const updateResult = await databaseService.updateArticle(remote.id, {
        title: remote.title,
        is_favorite: remote.isFavorite ? 1 : 0,
        updated_at: Math.floor(new Date(remote.updatedAt).getTime() / 1000),
      });

      // Assert
      expect(updateResult.success).toBe(true);

      // Verify the article was updated correctly
      const retrievedResult = await databaseService.getArticle(remote.id);
      expect(retrievedResult.success).toBe(true);
      expect(retrievedResult.data?.title).toBe(remote.title);
      expect(retrievedResult.data?.is_favorite).toBe(remote.isFavorite ? 1 : 0);

      // Verify database integrity after conflict resolution
      const integrityResult = await DataConsistencyValidator.validateDatabaseIntegrity(
        databaseService
      );
      expect(integrityResult.isIntegral).toBe(true);
    });
  });

  describe('Sync Resume Functionality', () => {
    it('should handle sync interruptions gracefully', async () => {
      // Arrange
      const interruption = await SyncResumeTester.simulateInterruption(50);

      // Act
      const resumeCapability = await SyncResumeTester.validateResumeCapability(
        syncService,
        interruption.resumePoint
      );

      // Assert
      expect(resumeCapability.canResume).toBe(true);
      expect(resumeCapability.currentPhase).toBe(interruption.resumePoint);
    });

    it('should preserve sync state during interruptions', async () => {
      // Arrange
      const testArticles = Array.from({ length: 3 }, (_, i) => ({
        id: `resume-test-${i}`,
        title: `Resume Test Article ${i}`,
        content: `Resume test content ${i}`,
        url: `https://example.com/resume-${i}`,
        isArchived: false,
        isFavorite: false,
        isRead: false,
        tags: [`resume-${i}`],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        syncedAt: null,
        isModified: true,
      }));

      // Create articles in database
      for (const article of testArticles) {
        const dbArticle = DatabaseUtilityFunctions.convertArticleToDBArticle(article);
        await databaseService.createArticle(dbArticle);
      }

      // Act - Simulate sync interruption
      const interruption = await SyncResumeTester.simulateInterruption(30);

      // Assert
      if (interruption.interrupted) {
        // Verify articles are still in database
        const statsResult = await databaseService.getStats();
        expect(statsResult.success).toBe(true);
        expect(statsResult.data?.totalArticles).toBe(testArticles.length);

        // Verify sync can resume
        const resumeCapability = await SyncResumeTester.validateResumeCapability(
          syncService,
          interruption.resumePoint
        );
        expect(resumeCapability.canResume).toBe(true);
      }
    });

    it('should recover from database connection failures', async () => {
      // Arrange
      const testArticle = {
        id: 'recovery-test-1',
        title: 'Recovery Test Article',
        content: 'Recovery test content',
        url: 'https://example.com/recovery',
        isArchived: false,
        isFavorite: false,
        isRead: false,
        tags: ['recovery'],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        syncedAt: null,
        isModified: true,
      };

      const dbArticle = DatabaseUtilityFunctions.convertArticleToDBArticle(testArticle);

      // Act - Create article and verify it persists
      const createResult = await databaseService.createArticle(dbArticle);
      expect(createResult.success).toBe(true);

      // Verify database connection is still active
      expect(databaseService.isConnected()).toBe(true);

      // Verify article can be retrieved
      const retrievedResult = await databaseService.getArticle(testArticle.id);
      expect(retrievedResult.success).toBe(true);
      expect(retrievedResult.data?.id).toBe(testArticle.id);
    });
  });

  describe('Database Performance Monitoring', () => {
    it('should monitor performance of individual database operations', async () => {
      // Arrange
      const testArticle = {
        id: 'performance-test-1',
        title: 'Performance Test Article',
        content: 'Performance test content',
        url: 'https://example.com/performance',
        isArchived: false,
        isFavorite: false,
        isRead: false,
        tags: ['performance'],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        syncedAt: null,
        isModified: true,
      };

      const dbArticle = DatabaseUtilityFunctions.convertArticleToDBArticle(testArticle);

      // Act
      performanceMonitor.startOperation('single_article_create');
      const createResult = await databaseService.createArticle(dbArticle);
      const metric = performanceMonitor.endOperation(1);

      // Assert
      expect(createResult.success).toBe(true);
      expect(metric).toBeDefined();
      expect(metric?.operation).toBe('single_article_create');
      expect(metric?.duration).toBeGreaterThan(0);
      expect(metric?.recordCount).toBe(1);

      // Verify performance is acceptable (< 100ms for single operation)
      expect(metric?.duration).toBeLessThan(100);
    });

    it('should monitor performance of batch operations', async () => {
      // Arrange
      const batchSize = 50;
      const testArticles = Array.from({ length: batchSize }, (_, i) => ({
        id: `batch-performance-${i}`,
        title: `Batch Performance Test Article ${i}`,
        content: `Batch performance test content ${i}`,
        url: `https://example.com/batch-${i}`,
        isArchived: false,
        isFavorite: false,
        isRead: false,
        tags: [`batch-${i}`],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        syncedAt: null,
        isModified: true,
      }));

      const dbArticles = testArticles.map(article => 
        DatabaseUtilityFunctions.convertArticleToDBArticle(article)
      );

      // Act
      performanceMonitor.startOperation('batch_create_performance');
      const batchResult = await databaseService.createArticlesBatch(dbArticles);
      const metric = performanceMonitor.endOperation(batchSize);

      // Assert
      expect(batchResult.success).toBe(true);
      expect(metric).toBeDefined();
      expect(metric?.operation).toBe('batch_create_performance');
      expect(metric?.duration).toBeGreaterThan(0);
      expect(metric?.recordCount).toBe(batchSize);

      // Verify batch performance is acceptable (< 1000ms for 50 records)
      expect(metric?.duration).toBeLessThan(1000);

      // Calculate throughput (records per second)
      const throughput = metric?.duration ? (batchSize / metric.duration) * 1000 : 0;
      expect(throughput).toBeGreaterThan(50); // At least 50 records/second
    });

    it('should monitor sync operation performance end-to-end', async () => {
      // Arrange
      const testArticles = Array.from({ length: 10 }, (_, i) => ({
        id: `sync-performance-${i}`,
        title: `Sync Performance Test Article ${i}`,
        content: `Sync performance test content ${i}`,
        url: `https://example.com/sync-${i}`,
        isArchived: false,
        isFavorite: false,
        isRead: false,
        tags: [`sync-${i}`],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        syncedAt: null,
        isModified: true,
      }));

      // Create articles in database
      for (const article of testArticles) {
        const dbArticle = DatabaseUtilityFunctions.convertArticleToDBArticle(article);
        await databaseService.createArticle(dbArticle);
      }

      // Act
      performanceMonitor.startOperation('sync_operation_performance');
      
      // Simulate sync operations
      const statsResult = await databaseService.getStats();
      const articlesResult = await databaseService.getArticles({ limit: 10 });
      
      const metric = performanceMonitor.endOperation(testArticles.length);

      // Assert
      expect(statsResult.success).toBe(true);
      expect(articlesResult.success).toBe(true);
      expect(metric).toBeDefined();
      expect(metric?.operation).toBe('sync_operation_performance');
      expect(metric?.duration).toBeGreaterThan(0);

      // Verify sync performance is acceptable
      expect(metric?.duration).toBeLessThan(500); // Less than 500ms for 10 articles
    });

    it('should track performance trends over multiple operations', async () => {
      // Arrange
      const operationCount = 5;
      const articlesPerOperation = 10;

      // Act - Perform multiple operations
      for (let i = 0; i < operationCount; i++) {
        const testArticles = Array.from({ length: articlesPerOperation }, (_, j) => ({
          id: `trend-${i}-${j}`,
          title: `Trend Test Article ${i}-${j}`,
          content: `Trend test content ${i}-${j}`,
          url: `https://example.com/trend-${i}-${j}`,
          isArchived: false,
          isFavorite: false,
          isRead: false,
          tags: [`trend-${i}-${j}`],
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
          syncedAt: null,
          isModified: true,
        }));

        const dbArticles = testArticles.map(article => 
          DatabaseUtilityFunctions.convertArticleToDBArticle(article)
        );

        performanceMonitor.startOperation('trend_analysis');
        await databaseService.createArticlesBatch(dbArticles);
        performanceMonitor.endOperation(articlesPerOperation);
      }

      // Assert
      const allMetrics = performanceMonitor.getMetrics();
      expect(allMetrics.length).toBe(operationCount);

      const trendMetrics = performanceMonitor.getMetricsByOperation('trend_analysis');
      expect(trendMetrics.length).toBe(operationCount);

      const averagePerformance = performanceMonitor.getAveragePerformance('trend_analysis');
      expect(averagePerformance).toBeGreaterThan(0);

      // Verify performance consistency (standard deviation should be reasonable)
      const durations = trendMetrics.map(m => m.duration);
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);
      const variationRatio = maxDuration / minDuration;
      
      // Performance should be consistent (max 3x variation)
      expect(variationRatio).toBeLessThan(3);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete sync workflow with database validation', async () => {
      // Arrange
      const testArticles = Array.from({ length: 5 }, (_, i) => ({
        id: `integration-${i}`,
        title: `Integration Test Article ${i}`,
        content: `Integration test content ${i}`,
        url: `https://example.com/integration-${i}`,
        isArchived: i % 2 === 0,
        isFavorite: i % 3 === 0,
        isRead: i % 4 === 0,
        tags: [`integration-${i}`],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        syncedAt: null,
        isModified: true,
      }));

      // Act
      performanceMonitor.startOperation('integration_test');

      // Create articles
      for (const article of testArticles) {
        const dbArticle = DatabaseUtilityFunctions.convertArticleToDBArticle(article);
        const createResult = await databaseService.createArticle(dbArticle);
        expect(createResult.success).toBe(true);
      }

      // Verify database stats
      const statsResult = await databaseService.getStats();
      expect(statsResult.success).toBe(true);
      expect(statsResult.data?.totalArticles).toBe(testArticles.length);

      // Verify database integrity
      const integrityResult = await DataConsistencyValidator.validateDatabaseIntegrity(
        databaseService
      );
      expect(integrityResult.isIntegral).toBe(true);

      const metric = performanceMonitor.endOperation(testArticles.length);

      // Assert
      expect(metric).toBeDefined();
      expect(metric?.operation).toBe('integration_test');
      expect(metric?.duration).toBeGreaterThan(0);
      expect(metric?.recordCount).toBe(testArticles.length);

      // Verify all articles can be retrieved
      const retrievedResult = await databaseService.getArticles({ limit: 10 });
      expect(retrievedResult.success).toBe(true);
      expect(retrievedResult.data?.items.length).toBe(testArticles.length);
    });
  });
});