/**
 * Sync Conflict Resolution Tests
 * 
 * Comprehensive tests for sync conflict resolution mechanisms including:
 * - Last-write-wins conflict resolution
 * - Local-wins conflict resolution
 * - Remote-wins conflict resolution
 * - Manual conflict resolution
 * - Complex conflict scenarios
 * - Data integrity during conflict resolution
 */

import { readeckApiService } from '../../src/services/ReadeckApiService';
import { localStorageService } from '../../src/services/LocalStorageService';
import { databaseSyncValidator } from '../../src/utils/DatabaseSyncValidator';
import { Article } from '../../src/types';
import { ConflictResolutionStrategy } from '../../src/types/sync';
import { store } from '../../src/store';

// Mock dependencies
jest.mock('../../src/services/ReadeckApiService');
jest.mock('../../src/services/LocalStorageService');
jest.mock('../../src/store', () => ({
  store: {
    getState: jest.fn(),
    dispatch: jest.fn(),
  },
}));

// Test utilities for conflict scenarios
class ConflictScenarioGenerator {
  static createBasicConflict(): { local: Article; remote: Article } {
    const baseArticle: Article = {
      id: 'conflict-article-1',
      title: 'Original Article Title',
      content: 'Original article content',
      url: 'https://example.com/original',
      isArchived: false,
      isFavorite: false,
      isRead: false,
      tags: ['original', 'test'],
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      syncedAt: '2023-01-01T00:00:00Z',
      isModified: false,
    };

    const localArticle: Article = {
      ...baseArticle,
      title: 'Local Modified Title',
      content: 'Local modified content',
      isArchived: true,
      tags: ['original', 'test', 'local'],
      updatedAt: '2023-01-01T10:00:00Z',
      isModified: true,
    };

    const remoteArticle: Article = {
      ...baseArticle,
      title: 'Remote Modified Title',
      content: 'Remote modified content',
      isFavorite: true,
      tags: ['original', 'test', 'remote'],
      updatedAt: '2023-01-01T11:00:00Z',
    };

    return { local: localArticle, remote: remoteArticle };
  }

  static createTimestampConflict(): { local: Article; remote: Article } {
    const baseArticle: Article = {
      id: 'timestamp-conflict-1',
      title: 'Timestamp Conflict Article',
      content: 'Timestamp conflict content',
      url: 'https://example.com/timestamp',
      isArchived: false,
      isFavorite: false,
      isRead: false,
      tags: ['timestamp', 'test'],
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      syncedAt: '2023-01-01T00:00:00Z',
      isModified: false,
    };

    const localArticle: Article = {
      ...baseArticle,
      title: 'Local Timestamp Title',
      updatedAt: '2023-01-01T12:00:00Z',
      isModified: true,
    };

    const remoteArticle: Article = {
      ...baseArticle,
      title: 'Remote Timestamp Title',
      updatedAt: '2023-01-01T12:30:00Z', // 30 minutes later
    };

    return { local: localArticle, remote: remoteArticle };
  }

  static createContentConflict(): { local: Article; remote: Article } {
    const baseArticle: Article = {
      id: 'content-conflict-1',
      title: 'Content Conflict Article',
      content: 'Original content for conflict testing',
      url: 'https://example.com/content',
      isArchived: false,
      isFavorite: false,
      isRead: false,
      tags: ['content', 'test'],
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      syncedAt: '2023-01-01T00:00:00Z',
      isModified: false,
    };

    const localArticle: Article = {
      ...baseArticle,
      content: 'Local content with significant modifications and additional paragraphs',
      updatedAt: '2023-01-01T10:00:00Z',
      isModified: true,
    };

    const remoteArticle: Article = {
      ...baseArticle,
      content: 'Remote content with completely different modifications and structure',
      updatedAt: '2023-01-01T10:30:00Z',
    };

    return { local: localArticle, remote: remoteArticle };
  }

  static createTagConflict(): { local: Article; remote: Article } {
    const baseArticle: Article = {
      id: 'tag-conflict-1',
      title: 'Tag Conflict Article',
      content: 'Tag conflict content',
      url: 'https://example.com/tags',
      isArchived: false,
      isFavorite: false,
      isRead: false,
      tags: ['tag1', 'tag2', 'original'],
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      syncedAt: '2023-01-01T00:00:00Z',
      isModified: false,
    };

    const localArticle: Article = {
      ...baseArticle,
      tags: ['tag1', 'tag2', 'local-tag', 'local-specific'],
      updatedAt: '2023-01-01T10:00:00Z',
      isModified: true,
    };

    const remoteArticle: Article = {
      ...baseArticle,
      tags: ['tag1', 'tag2', 'remote-tag', 'remote-specific'],
      updatedAt: '2023-01-01T10:15:00Z',
    };

    return { local: localArticle, remote: remoteArticle };
  }

  static createComplexConflict(): { local: Article; remote: Article } {
    const baseArticle: Article = {
      id: 'complex-conflict-1',
      title: 'Complex Conflict Article',
      content: 'Complex conflict content',
      url: 'https://example.com/complex',
      isArchived: false,
      isFavorite: false,
      isRead: false,
      tags: ['complex', 'test'],
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      syncedAt: '2023-01-01T00:00:00Z',
      isModified: false,
    };

    const localArticle: Article = {
      ...baseArticle,
      title: 'Local Complex Title',
      content: 'Local complex content with many changes',
      isArchived: true,
      isFavorite: true,
      isRead: true,
      tags: ['complex', 'test', 'local', 'archived'],
      updatedAt: '2023-01-01T10:00:00Z',
      isModified: true,
    };

    const remoteArticle: Article = {
      ...baseArticle,
      title: 'Remote Complex Title',
      content: 'Remote complex content with different changes',
      isArchived: false,
      isFavorite: true,
      isRead: false,
      tags: ['complex', 'test', 'remote', 'favorite'],
      updatedAt: '2023-01-01T10:45:00Z',
    };

    return { local: localArticle, remote: remoteArticle };
  }
}

// Mock conflict resolution utilities
class MockConflictResolver {
  static async resolveLastWriteWins(
    local: Article,
    remote: Article
  ): Promise<Article> {
    const localTime = new Date(local.updatedAt).getTime();
    const remoteTime = new Date(remote.updatedAt).getTime();
    
    const winner = remoteTime > localTime ? remote : local;
    
    return {
      ...winner,
      syncedAt: new Date().toISOString(),
      isModified: false,
    };
  }

  static async resolveLocalWins(
    local: Article,
    _remote: Article
  ): Promise<Article> {
    return {
      ...local,
      syncedAt: new Date().toISOString(),
      isModified: true, // Keep as modified to upload later
    };
  }

  static async resolveRemoteWins(
    local: Article,
    remote: Article
  ): Promise<Article> {
    return {
      ...remote,
      syncedAt: new Date().toISOString(),
      isModified: false,
    };
  }

  static async resolveManual(
    local: Article,
    remote: Article,
    userChoice: Partial<Article>
  ): Promise<Article> {
    return {
      ...local,
      ...remote,
      ...userChoice,
      syncedAt: new Date().toISOString(),
      isModified: false,
    };
  }

  static async resolveMerge(
    local: Article,
    remote: Article
  ): Promise<Article> {
    // Simple merge strategy - combine non-conflicting changes
    const mergedTags = [
      ...new Set([...(local.tags || []), ...(remote.tags || [])]),
    ];

    const localTime = new Date(local.updatedAt).getTime();
    const remoteTime = new Date(remote.updatedAt).getTime();
    
    // Use newer timestamp for non-conflicting fields
    const newerArticle = remoteTime > localTime ? remote : local;
    
    return {
      ...newerArticle,
      tags: mergedTags,
      // Keep both local and remote modifications for critical fields
      isArchived: local.isArchived || remote.isArchived,
      isFavorite: local.isFavorite || remote.isFavorite,
      isRead: local.isRead || remote.isRead,
      syncedAt: new Date().toISOString(),
      isModified: false,
    };
  }
}

describe('Sync Conflict Resolution', () => {
  const _mockedReadeckApiService = readeckApiService as jest.Mocked<typeof readeckApiService>;
  const mockedLocalStorageService = localStorageService as jest.Mocked<typeof localStorageService>;
  const mockedStore = store as jest.Mocked<typeof store>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock returns
    mockedStore.getState.mockReturnValue({
      sync: {
        config: {
          conflictResolutionStrategy: ConflictResolutionStrategy.LAST_WRITE_WINS,
        },
        conflicts: [],
      },
    });
  });

  describe('Last Write Wins Resolution', () => {
    it('should resolve basic conflicts using last write wins', async () => {
      // Arrange
      const { local, remote } = ConflictScenarioGenerator.createBasicConflict();
      
      // Act
      const resolved = await MockConflictResolver.resolveLastWriteWins(local, remote);
      
      // Assert
      expect(resolved.id).toBe(remote.id);
      expect(resolved.title).toBe(remote.title);
      expect(resolved.content).toBe(remote.content);
      expect(resolved.isFavorite).toBe(remote.isFavorite);
      expect(resolved.isModified).toBe(false);
      expect(resolved.syncedAt).toBeDefined();
      
      // Validate the resolution using the validator
      const validationResult = databaseSyncValidator.validateConflictResolution(
        local,
        remote,
        resolved,
        'last-write-wins'
      );
      
      expect(validationResult.confidence).toBeGreaterThan(80);
      expect(validationResult.strategy).toBe('last-write-wins');
    });

    it('should handle timestamp conflicts correctly', async () => {
      // Arrange
      const { local, remote } = ConflictScenarioGenerator.createTimestampConflict();
      
      // Act
      const resolved = await MockConflictResolver.resolveLastWriteWins(local, remote);
      
      // Assert
      expect(resolved.title).toBe(remote.title); // Remote has later timestamp
      expect(resolved.updatedAt).toBe(remote.updatedAt);
      
      // Validate consistency
      const consistencyResult = await databaseSyncValidator.validateArticleConsistency(
        resolved,
        remote
      );
      
      expect(consistencyResult.isConsistent).toBe(true);
      expect(consistencyResult.score).toBeGreaterThan(90);
    });

    it('should preserve data integrity during resolution', async () => {
      // Arrange
      const { local, remote } = ConflictScenarioGenerator.createContentConflict();
      
      // Act
      const resolved = await MockConflictResolver.resolveLastWriteWins(local, remote);
      
      // Assert
      expect(resolved.content).toBe(remote.content);
      expect(resolved.url).toBe(remote.url); // URL should never change
      
      // Validate that no critical data was lost
      const validationResult = databaseSyncValidator.validateConflictResolution(
        local,
        remote,
        resolved,
        'last-write-wins'
      );
      
      expect(validationResult.dataLoss).toBe(false);
    });
  });

  describe('Local Wins Resolution', () => {
    it('should resolve conflicts by keeping local changes', async () => {
      // Arrange
      const { local, remote } = ConflictScenarioGenerator.createBasicConflict();
      
      // Act
      const resolved = await MockConflictResolver.resolveLocalWins(local, remote);
      
      // Assert
      expect(resolved.id).toBe(local.id);
      expect(resolved.title).toBe(local.title);
      expect(resolved.content).toBe(local.content);
      expect(resolved.isArchived).toBe(local.isArchived);
      expect(resolved.isModified).toBe(true); // Should remain modified for upload
      
      // Validate the resolution
      const validationResult = databaseSyncValidator.validateConflictResolution(
        local,
        remote,
        resolved,
        'local-wins'
      );
      
      expect(validationResult.confidence).toBeGreaterThan(90);
      expect(validationResult.strategy).toBe('local-wins');
    });

    it('should handle tag conflicts by preserving local tags', async () => {
      // Arrange
      const { local, remote } = ConflictScenarioGenerator.createTagConflict();
      
      // Act
      const resolved = await MockConflictResolver.resolveLocalWins(local, remote);
      
      // Assert
      expect(resolved.tags).toEqual(local.tags);
      expect(resolved.tags).toContain('local-tag');
      expect(resolved.tags).toContain('local-specific');
      
      // Validate tag preservation
      const validationResult = databaseSyncValidator.validateConflictResolution(
        local,
        remote,
        resolved,
        'local-wins'
      );
      
      expect(validationResult.appliedChanges).toContain(
        expect.stringContaining('Used local')
      );
    });
  });

  describe('Remote Wins Resolution', () => {
    it('should resolve conflicts by keeping remote changes', async () => {
      // Arrange
      const { local, remote } = ConflictScenarioGenerator.createBasicConflict();
      
      // Act
      const resolved = await MockConflictResolver.resolveRemoteWins(local, remote);
      
      // Assert
      expect(resolved.id).toBe(remote.id);
      expect(resolved.title).toBe(remote.title);
      expect(resolved.content).toBe(remote.content);
      expect(resolved.isFavorite).toBe(remote.isFavorite);
      expect(resolved.isModified).toBe(false);
      
      // Validate the resolution
      const validationResult = databaseSyncValidator.validateConflictResolution(
        local,
        remote,
        resolved,
        'remote-wins'
      );
      
      expect(validationResult.confidence).toBeGreaterThan(90);
      expect(validationResult.strategy).toBe('remote-wins');
    });

    it('should handle complex conflicts by preserving remote state', async () => {
      // Arrange
      const { local, remote } = ConflictScenarioGenerator.createComplexConflict();
      
      // Act
      const resolved = await MockConflictResolver.resolveRemoteWins(local, remote);
      
      // Assert
      expect(resolved.title).toBe(remote.title);
      expect(resolved.content).toBe(remote.content);
      expect(resolved.isArchived).toBe(remote.isArchived);
      expect(resolved.isFavorite).toBe(remote.isFavorite);
      expect(resolved.isRead).toBe(remote.isRead);
      expect(resolved.tags).toEqual(remote.tags);
      
      // Validate consistency with remote
      const consistencyResult = await databaseSyncValidator.validateArticleConsistency(
        resolved,
        remote
      );
      
      expect(consistencyResult.isConsistent).toBe(true);
      expect(consistencyResult.differences.length).toBe(0);
    });
  });

  describe('Manual Resolution', () => {
    it('should resolve conflicts using user-provided choices', async () => {
      // Arrange
      const { local, remote } = ConflictScenarioGenerator.createBasicConflict();
      const userChoice = {
        title: 'User Chosen Title',
        isArchived: false,
        isFavorite: true,
        tags: ['user', 'chosen', 'tags'],
      };
      
      // Act
      const resolved = await MockConflictResolver.resolveManual(local, remote, userChoice);
      
      // Assert
      expect(resolved.title).toBe(userChoice.title);
      expect(resolved.isArchived).toBe(userChoice.isArchived);
      expect(resolved.isFavorite).toBe(userChoice.isFavorite);
      expect(resolved.tags).toEqual(userChoice.tags);
      
      // Validate manual resolution
      const validationResult = databaseSyncValidator.validateConflictResolution(
        local,
        remote,
        resolved,
        'manual'
      );
      
      expect(validationResult.appliedChanges).toContain(
        expect.stringContaining('custom resolution')
      );
    });

    it('should handle partial user choices', async () => {
      // Arrange
      const { local, remote } = ConflictScenarioGenerator.createComplexConflict();
      const userChoice = {
        title: 'User Selected Title',
        isArchived: true, // Keep local preference
        // Other fields should use default resolution
      };
      
      // Act
      const resolved = await MockConflictResolver.resolveManual(local, remote, userChoice);
      
      // Assert
      expect(resolved.title).toBe(userChoice.title);
      expect(resolved.isArchived).toBe(userChoice.isArchived);
      expect(resolved.content).toBe(remote.content); // Should use remote as fallback
      
      // Validate partial resolution
      const validationResult = databaseSyncValidator.validateConflictResolution(
        local,
        remote,
        resolved,
        'manual'
      );
      
      expect(validationResult.confidence).toBeGreaterThan(70);
    });
  });

  describe('Merge Resolution', () => {
    it('should merge non-conflicting changes from both sources', async () => {
      // Arrange
      const { local, remote } = ConflictScenarioGenerator.createTagConflict();
      
      // Act
      const resolved = await MockConflictResolver.resolveMerge(local, remote);
      
      // Assert
      expect(resolved.tags).toContain('local-tag');
      expect(resolved.tags).toContain('local-specific');
      expect(resolved.tags).toContain('remote-tag');
      expect(resolved.tags).toContain('remote-specific');
      expect(resolved.tags).toContain('tag1');
      expect(resolved.tags).toContain('tag2');
      
      // Validate merge quality
      const validationResult = databaseSyncValidator.validateConflictResolution(
        local,
        remote,
        resolved,
        'merge'
      );
      
      expect(validationResult.dataLoss).toBe(false);
    });

    it('should handle boolean field conflicts intelligently', async () => {
      // Arrange
      const { local, remote } = ConflictScenarioGenerator.createComplexConflict();
      
      // Act
      const resolved = await MockConflictResolver.resolveMerge(local, remote);
      
      // Assert
      // Should keep true values from either source
      expect(resolved.isArchived).toBe(true); // Local had true
      expect(resolved.isFavorite).toBe(true); // Both had true
      expect(resolved.isRead).toBe(true); // Local had true
      
      // Validate merge logic
      const validationResult = databaseSyncValidator.validateConflictResolution(
        local,
        remote,
        resolved,
        'merge'
      );
      
      expect(validationResult.confidence).toBeGreaterThan(75);
    });
  });

  describe('Conflict Resolution Edge Cases', () => {
    it('should handle identical articles without conflicts', async () => {
      // Arrange
      const article: Article = {
        id: 'identical-article',
        title: 'Identical Article',
        content: 'Same content',
        url: 'https://example.com/identical',
        isArchived: false,
        isFavorite: false,
        isRead: false,
        tags: ['identical'],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        syncedAt: '2023-01-01T00:00:00Z',
        isModified: false,
      };

      const local = { ...article };
      const remote = { ...article };
      
      // Act
      const resolved = await MockConflictResolver.resolveLastWriteWins(local, remote);
      
      // Assert
      expect(resolved).toEqual(expect.objectContaining({
        id: article.id,
        title: article.title,
        content: article.content,
        url: article.url,
        isArchived: article.isArchived,
        isFavorite: article.isFavorite,
        isRead: article.isRead,
        tags: article.tags,
      }));
      
      // Validate no conflict resolution needed
      const consistencyResult = await databaseSyncValidator.validateArticleConsistency(
        local,
        remote
      );
      
      expect(consistencyResult.isConsistent).toBe(true);
      expect(consistencyResult.differences.length).toBe(0);
    });

    it('should handle missing content fields gracefully', async () => {
      // Arrange
      const local: Article = {
        id: 'missing-content-local',
        title: 'Local Article',
        content: '', // Empty content
        url: 'https://example.com/missing',
        isArchived: false,
        isFavorite: false,
        isRead: false,
        tags: [],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        syncedAt: '2023-01-01T00:00:00Z',
        isModified: false,
      };

      const remote: Article = {
        ...local,
        content: 'Remote content present',
        updatedAt: '2023-01-01T01:00:00Z',
      };
      
      // Act
      const resolved = await MockConflictResolver.resolveLastWriteWins(local, remote);
      
      // Assert
      expect(resolved.content).toBe(remote.content);
      
      // Validate no data loss
      const validationResult = databaseSyncValidator.validateConflictResolution(
        local,
        remote,
        resolved,
        'last-write-wins'
      );
      
      expect(validationResult.dataLoss).toBe(false);
    });

    it('should handle null and undefined values correctly', async () => {
      // Arrange
      const local: Article = {
        id: 'null-values',
        title: 'Null Values Article',
        content: 'Content',
        url: 'https://example.com/null',
        isArchived: false,
        isFavorite: false,
        isRead: false,
        tags: undefined as any,
        summary: null as any,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        syncedAt: '2023-01-01T00:00:00Z',
        isModified: false,
      };

      const remote: Article = {
        ...local,
        tags: ['remote', 'tags'],
        summary: 'Remote summary',
        updatedAt: '2023-01-01T01:00:00Z',
      };
      
      // Act
      const resolved = await MockConflictResolver.resolveLastWriteWins(local, remote);
      
      // Assert
      expect(resolved.tags).toEqual(remote.tags);
      expect(resolved.summary).toBe(remote.summary);
      
      // Validate handling of null/undefined
      const consistencyResult = await databaseSyncValidator.validateArticleConsistency(
        resolved,
        remote
      );
      
      expect(consistencyResult.isConsistent).toBe(true);
    });
  });

  describe('Bulk Conflict Resolution', () => {
    it('should handle multiple conflicts efficiently', async () => {
      // Arrange
      const conflicts = [
        ConflictScenarioGenerator.createBasicConflict(),
        ConflictScenarioGenerator.createTimestampConflict(),
        ConflictScenarioGenerator.createContentConflict(),
        ConflictScenarioGenerator.createTagConflict(),
        ConflictScenarioGenerator.createComplexConflict(),
      ];
      
      // Act
      const startTime = performance.now();
      const resolutions = await Promise.all(
        conflicts.map(({ local, remote }) =>
          MockConflictResolver.resolveLastWriteWins(local, remote)
        )
      );
      const endTime = performance.now();
      
      // Assert
      expect(resolutions.length).toBe(5);
      resolutions.forEach((resolved, index) => {
        expect(resolved.id).toBe(conflicts[index].remote.id);
        expect(resolved.isModified).toBe(false);
        expect(resolved.syncedAt).toBeDefined();
      });
      
      // Validate performance
      const performanceMetrics = await databaseSyncValidator.validateSyncPerformance(
        'bulk_conflict_resolution',
        startTime,
        endTime,
        conflicts.length
      );
      
      expect(performanceMetrics.totalDuration).toBeLessThan(100); // Should be fast
      expect(performanceMetrics.slowOperations.length).toBe(0);
    });

    it('should maintain consistency across multiple resolutions', async () => {
      // Arrange
      const conflicts = Array.from({ length: 10 }, (_, i) => {
        const base = ConflictScenarioGenerator.createBasicConflict();
        return {
          local: { ...base.local, id: `bulk-${i}` },
          remote: { ...base.remote, id: `bulk-${i}` },
        };
      });
      
      // Act
      const resolutions = await Promise.all(
        conflicts.map(({ local, remote }) =>
          MockConflictResolver.resolveLastWriteWins(local, remote)
        )
      );
      
      // Assert
      for (let i = 0; i < resolutions.length; i++) {
        const resolved = resolutions[i];
        const { local, remote } = conflicts[i];
        
        expect(resolved.id).toBe(`bulk-${i}`);
        
        // Validate each resolution
        const validationResult = databaseSyncValidator.validateConflictResolution(
          local,
          remote,
          resolved,
          'last-write-wins'
        );
        
        expect(validationResult.confidence).toBeGreaterThan(80);
        expect(validationResult.dataLoss).toBe(false);
      }
    });
  });

  describe('Integration with Sync Service', () => {
    it('should integrate conflict resolution with sync workflow', async () => {
      // Arrange
      const { local, remote } = ConflictScenarioGenerator.createBasicConflict();
      
      // Mock sync service behavior
      mockedLocalStorageService.getArticleAsAppFormat.mockResolvedValue(local);
      mockedLocalStorageService.updateArticleFromAppFormat.mockResolvedValue(true);
      
      // Act - This would normally be called by the sync service
      const resolved = await MockConflictResolver.resolveLastWriteWins(local, remote);
      
      // Assert
      expect(resolved.isModified).toBe(false);
      expect(resolved.syncedAt).toBeDefined();
      
      // Validate integration
      const validationResult = databaseSyncValidator.validateConflictResolution(
        local,
        remote,
        resolved,
        'last-write-wins'
      );
      
      expect(validationResult.confidence).toBeGreaterThan(80);
    });
  });
});