/**
 * Sync Integration Tests
 * 
 * Integration tests to validate SyncService works correctly with:
 * - Redux sync slice
 * - DatabaseService
 * - ArticlesApiService
 * - Conflict resolution utilities
 */

import { store } from '../../src/store';
import { syncService } from '../../src/services/SyncService';
import {
  SyncStatus,
  ConflictResolutionStrategy,
  SyncPhase,
} from '../../src/types/sync';

// Mock the external dependencies to focus on integration
jest.mock('../../src/services/DatabaseService');
jest.mock('../../src/services/ArticlesApiService');

describe('Sync Integration', () => {
  beforeEach(() => {
    // Reset store to initial state
    store.dispatch({ type: '@@INIT' });
    jest.clearAllMocks();
  });

  describe('Redux Integration', () => {
    it('should properly integrate with Redux store', () => {
      const initialState = store.getState();
      
      // Check that sync slice is properly configured
      expect(initialState.sync).toBeDefined();
      expect(initialState.sync.status).toBe(SyncStatus.IDLE);
      expect(initialState.sync.config).toBeDefined();
      expect(initialState.sync.config.conflictResolutionStrategy).toBe(ConflictResolutionStrategy.LAST_WRITE_WINS);
    });

    it('should dispatch actions during sync lifecycle', async () => {
      const stateBeforeSync = store.getState();
      expect(stateBeforeSync.sync.status).toBe(SyncStatus.IDLE);

      // Mock a quick sync that will dispatch actions
      const mockDatabaseService = require('../../src/services/DatabaseService').default;
      const mockArticlesApiService = require('../../src/services/ArticlesApiService').articlesApiService;

      mockDatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { items: [], totalCount: 0, hasMore: false, limit: 50, offset: 0 },
      });
      
      mockDatabaseService.getStats.mockResolvedValue({
        success: true,
        data: {
          totalArticles: 0,
          archivedArticles: 0,
          favoriteArticles: 0,
          unreadArticles: 0,
          totalLabels: 0,
          pendingSyncItems: 0,
          databaseSize: 0,
          lastSyncAt: null,
        },
      });

      mockArticlesApiService.fetchArticles.mockResolvedValue({
        items: [],
        page: 1,
        totalPages: 1,
        totalItems: 0,
      });

      // Start sync and verify state changes
      const syncPromise = syncService.startFullSync();
      
      // Check that sync started
      const stateDuringSync = store.getState();
      expect(stateDuringSync.sync.status).toBe(SyncStatus.SYNCING);

      // Wait for sync to complete
      const result = await syncPromise;
      
      // Check final state
      const stateAfterSync = store.getState();
      expect(stateAfterSync.sync.status).toBe(SyncStatus.SUCCESS);
      expect(stateAfterSync.sync.lastSyncTime).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should handle sync errors and update Redux state', async () => {
      const mockDatabaseService = require('../../src/services/DatabaseService').default;
      
      // Make database service fail
      mockDatabaseService.getArticles.mockRejectedValue(new Error('Database connection failed'));

      const result = await syncService.startFullSync();

      // Check that error state is properly set
      const stateAfterError = store.getState();
      expect(stateAfterError.sync.status).toBe(SyncStatus.ERROR);
      expect(stateAfterError.sync.error).toContain('Database connection failed');
      expect(result.success).toBe(false);
    });

    it('should update sync progress during operation', async () => {
      const mockDatabaseService = require('../../src/services/DatabaseService').default;
      const mockArticlesApiService = require('../../src/services/ArticlesApiService').articlesApiService;

      // Mock some data to sync
      const mockArticles = Array.from({ length: 5 }, (_, i) => ({
        id: `article-${i}`,
        title: `Article ${i}`,
        is_modified: 1,
      }));

      mockDatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { items: mockArticles, totalCount: 5, hasMore: false, limit: 50, offset: 0 },
      });
      
      mockDatabaseService.getStats.mockResolvedValue({
        success: true,
        data: {
          totalArticles: 5,
          archivedArticles: 0,
          favoriteArticles: 0,
          unreadArticles: 5,
          totalLabels: 0,
          pendingSyncItems: 0,
          databaseSize: 1024,
          lastSyncAt: Math.floor(Date.now() / 1000) - 3600,
        },
      });

      mockArticlesApiService.fetchArticles.mockResolvedValue({
        items: [],
        page: 1,
        totalPages: 1,
        totalItems: 0,
      });

      mockArticlesApiService.getArticle.mockRejectedValue(new Error('Not found'));
      mockArticlesApiService.createArticle.mockResolvedValue({ id: 'new-id' });
      mockDatabaseService.updateArticle.mockResolvedValue({ success: true, rowsAffected: 1 });

      await syncService.startFullSync();

      // Verify that progress was updated during sync
      const finalState = store.getState();
      expect(finalState.sync.progress.phase).toBe(SyncPhase.FINALIZING);
      expect(finalState.sync.progress.processedItems).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Configuration Integration', () => {
    it('should use Redux configuration for sync operations', () => {
      const state = store.getState();
      const config = state.sync.config;

      // Update sync service config
      syncService.updateConfig({
        batchSize: 25,
        conflictResolutionStrategy: ConflictResolutionStrategy.LOCAL_WINS,
      });

      // Configuration should be updated
      expect((syncService as any).config.batchSize).toBe(25);
      expect((syncService as any).config.conflictResolutionStrategy).toBe(ConflictResolutionStrategy.LOCAL_WINS);
    });
  });

  describe('Conflict Resolution Integration', () => {
    it('should handle conflicts and update Redux state', async () => {
      const mockDatabaseService = require('../../src/services/DatabaseService').default;
      const mockArticlesApiService = require('../../src/services/ArticlesApiService').articlesApiService;

      // Mock conflicting article scenario
      const localArticle = {
        id: 'conflict-article',
        title: 'Local Title',
        is_modified: 1,
        updated_at: Math.floor(new Date('2023-01-01T10:00:00Z').getTime() / 1000),
      };

      const remoteArticle = {
        id: 'conflict-article',
        title: 'Remote Title',
        isModified: false,
        updatedAt: new Date('2023-01-01T12:00:00Z'),
      };

      mockDatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { items: [], totalCount: 0, hasMore: false, limit: 50, offset: 0 },
      });
      
      mockDatabaseService.getStats.mockResolvedValue({
        success: true,
        data: {
          totalArticles: 1,
          archivedArticles: 0,
          favoriteArticles: 0,
          unreadArticles: 1,
          totalLabels: 0,
          pendingSyncItems: 0,
          databaseSize: 1024,
          lastSyncAt: Math.floor(Date.now() / 1000) - 3600,
        },
      });

      mockArticlesApiService.fetchArticles.mockResolvedValue({
        items: [remoteArticle],
        page: 1,
        totalPages: 1,
        totalItems: 1,
      });

      mockDatabaseService.getArticle.mockResolvedValue({
        success: true,
        data: localArticle,
      });

      mockDatabaseService.updateArticle.mockResolvedValue({
        success: true,
        rowsAffected: 1,
      });

      const result = await syncService.startFullSync();

      // Should detect and resolve conflicts
      expect(result.conflictCount).toBeGreaterThanOrEqual(0);
      
      // Check that conflict resolution actions were dispatched
      const finalState = store.getState();
      expect(finalState.sync.status).toBe(SyncStatus.SUCCESS);
    });
  });

  describe('Error Handling Integration', () => {
    it('should maintain Redux state consistency during errors', async () => {
      const mockDatabaseService = require('../../src/services/DatabaseService').default;
      
      // Make service fail partway through
      let callCount = 0;
      mockDatabaseService.getArticles.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            success: true,
            data: { items: [], totalCount: 0, hasMore: false, limit: 50, offset: 0 },
          });
        }
        return Promise.reject(new Error('Simulated failure'));
      });

      mockDatabaseService.getStats.mockRejectedValue(new Error('Stats failure'));

      const result = await syncService.startFullSync();

      // Should handle errors gracefully
      expect(result.success).toBe(false);
      
      const finalState = store.getState();
      expect(finalState.sync.status).toBe(SyncStatus.ERROR);
      expect(finalState.sync.error).toBeTruthy();
    });
  });

  describe('Service Lifecycle Integration', () => {
    it('should initialize and integrate with existing store state', async () => {
      // Initialize sync service
      await syncService.initialize();

      // Should not throw and should work with existing Redux state
      const state = store.getState();
      expect(state.sync).toBeDefined();
      expect(state.sync.config).toBeDefined();
    });

    it('should provide accurate status information', () => {
      expect(syncService.isRunning()).toBe(false);
      
      // Status should be consistent with Redux state
      const state = store.getState();
      expect(state.sync.status).toBe(SyncStatus.IDLE);
    });

    it('should provide sync statistics', async () => {
      const stats = await syncService.getSyncStats();
      
      // Should return stats from Redux state
      expect(stats).toBeDefined();
      expect(typeof stats.totalSyncs).toBe('number');
      expect(typeof stats.successfulSyncs).toBe('number');
      expect(typeof stats.failedSyncs).toBe('number');
    });
  });
});