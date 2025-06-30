/**
 * Conflict Resolution Unit Tests
 * 
 * Tests for the conflict resolution utilities including:
 * - Last-Write-Wins strategy
 * - Local-Wins and Remote-Wins strategies
 * - Conflict detection
 * - Three-way merging
 * - Validation
 */

import {
  resolveConflict,
  detectConflicts,
  mergeArticles,
  validateResolution,
  describeConflicts,
  ConflictResolutionUtils,
} from '../../src/utils/conflictResolution';
import { ConflictResolutionStrategy, ConflictType } from '../../src/types/sync';
import { Article } from '../../src/types';

describe('ConflictResolution', () => {
  // Mock articles for testing
  const baseArticle: Article = {
    id: 'test-article-1',
    title: 'Base Article Title',
    summary: 'Base summary',
    content: 'Base content',
    url: 'https://example.com/base',
    imageUrl: undefined,
    readTime: 5,
    isArchived: false,
    isFavorite: false,
    isRead: false,
    tags: ['base', 'test'],
    sourceUrl: 'https://example.com',
    createdAt: new Date('2023-01-01T10:00:00Z'),
    updatedAt: new Date('2023-01-01T12:00:00Z'),
    syncedAt: new Date('2023-01-01T11:00:00Z'),
    isModified: false,
  };

  const localArticle: Article = {
    ...baseArticle,
    title: 'Local Modified Title',
    isRead: true,
    tags: ['local', 'modified'],
    updatedAt: new Date('2023-01-02T10:00:00Z'), // Earlier than remote
    isModified: true,
  };

  const remoteArticle: Article = {
    ...baseArticle,
    title: 'Remote Modified Title',
    isFavorite: true,
    tags: ['remote', 'updated'],
    updatedAt: new Date('2023-01-02T14:00:00Z'), // Later than local
    isModified: false,
  };

  const olderLocalArticle: Article = {
    ...localArticle,
    updatedAt: new Date('2023-01-02T08:00:00Z'), // Earlier than remote
  };

  const newerLocalArticle: Article = {
    ...localArticle,
    updatedAt: new Date('2023-01-02T16:00:00Z'), // Later than remote
  };

  describe('resolveConflict', () => {
    describe('Last-Write-Wins Strategy', () => {
      it('should choose remote version when remote is newer', () => {
        const resolved = resolveConflict(
          olderLocalArticle,
          remoteArticle,
          ConflictResolutionStrategy.LAST_WRITE_WINS
        );

        expect(resolved.title).toBe(remoteArticle.title);
        expect(resolved.isFavorite).toBe(remoteArticle.isFavorite);
        expect(resolved.tags).toEqual(remoteArticle.tags);
        expect(resolved.isModified).toBe(false);
        expect(resolved.syncedAt).toBeDefined();
      });

      it('should choose local version when local is newer', () => {
        const resolved = resolveConflict(
          newerLocalArticle,
          remoteArticle,
          ConflictResolutionStrategy.LAST_WRITE_WINS
        );

        expect(resolved.title).toBe(newerLocalArticle.title);
        expect(resolved.isRead).toBe(newerLocalArticle.isRead);
        expect(resolved.tags).toEqual(newerLocalArticle.tags);
        expect(resolved.isModified).toBe(false);
        expect(resolved.syncedAt).toBeDefined();
      });

      it('should handle identical timestamps', () => {
        const sameTimeRemote = {
          ...remoteArticle,
          updatedAt: localArticle.updatedAt,
        };

        const resolved = resolveConflict(
          localArticle,
          sameTimeRemote,
          ConflictResolutionStrategy.LAST_WRITE_WINS
        );

        // Should pick either one consistently (implementation detail)
        expect(resolved).toBeDefined();
        expect(resolved.syncedAt).toBeDefined();
      });
    });

    describe('Local-Wins Strategy', () => {
      it('should always choose local version', () => {
        const resolved = resolveConflict(
          localArticle,
          remoteArticle,
          ConflictResolutionStrategy.LOCAL_WINS
        );

        expect(resolved.title).toBe(localArticle.title);
        expect(resolved.isRead).toBe(localArticle.isRead);
        expect(resolved.tags).toEqual(localArticle.tags);
        expect(resolved.isModified).toBe(true); // Should remain modified for upload
        expect(resolved.syncedAt).toBeDefined();
      });
    });

    describe('Remote-Wins Strategy', () => {
      it('should always choose remote version', () => {
        const resolved = resolveConflict(
          localArticle,
          remoteArticle,
          ConflictResolutionStrategy.REMOTE_WINS
        );

        expect(resolved.title).toBe(remoteArticle.title);
        expect(resolved.isFavorite).toBe(remoteArticle.isFavorite);
        expect(resolved.tags).toEqual(remoteArticle.tags);
        expect(resolved.isModified).toBe(false);
        expect(resolved.syncedAt).toBeDefined();
      });
    });

    describe('Manual Strategy', () => {
      it('should throw error for manual resolution', () => {
        expect(() => {
          resolveConflict(
            localArticle,
            remoteArticle,
            ConflictResolutionStrategy.MANUAL
          );
        }).toThrow('Manual conflict resolution requires user intervention');
      });
    });

    describe('Unknown Strategy', () => {
      it('should throw error for unknown strategy', () => {
        expect(() => {
          resolveConflict(
            localArticle,
            remoteArticle,
            'UNKNOWN_STRATEGY' as ConflictResolutionStrategy
          );
        }).toThrow('Unknown conflict resolution strategy');
      });
    });

    describe('Configuration Options', () => {
      it('should respect logConflicts option', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        resolveConflict(
          localArticle,
          remoteArticle,
          ConflictResolutionStrategy.LAST_WRITE_WINS,
          { logConflicts: false }
        );

        expect(consoleSpy).not.toHaveBeenCalled();

        resolveConflict(
          localArticle,
          remoteArticle,
          ConflictResolutionStrategy.LAST_WRITE_WINS,
          { logConflicts: true }
        );

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });
  });

  describe('detectConflicts', () => {
    it('should detect title conflicts', () => {
      const conflicts = detectConflicts(localArticle, remoteArticle);
      
      const titleConflict = conflicts.find(c => c.field === 'title');
      expect(titleConflict).toBeDefined();
      expect(titleConflict!.conflictType).toBe(ConflictType.CONTENT_MODIFIED);
      expect(titleConflict!.severity).toBe('medium');
      expect(titleConflict!.localValue).toBe(localArticle.title);
      expect(titleConflict!.remoteValue).toBe(remoteArticle.title);
    });

    it('should detect status conflicts', () => {
      const conflicts = detectConflicts(localArticle, remoteArticle);
      
      const readConflict = conflicts.find(c => c.field === 'isRead');
      const favoriteConflict = conflicts.find(c => c.field === 'isFavorite');
      
      expect(readConflict).toBeDefined();
      expect(readConflict!.conflictType).toBe(ConflictType.STATUS_CHANGED);
      expect(readConflict!.severity).toBe('low');
      
      expect(favoriteConflict).toBeDefined();
      expect(favoriteConflict!.conflictType).toBe(ConflictType.STATUS_CHANGED);
    });

    it('should detect tag conflicts', () => {
      const conflicts = detectConflicts(localArticle, remoteArticle);
      
      const tagConflict = conflicts.find(c => c.field === 'tags');
      expect(tagConflict).toBeDefined();
      expect(tagConflict!.conflictType).toBe(ConflictType.TAGS_UPDATED);
      expect(tagConflict!.severity).toBe('low');
    });

    it('should not detect conflicts for identical articles', () => {
      const conflicts = detectConflicts(localArticle, localArticle);
      expect(conflicts).toHaveLength(0);
    });

    it('should handle null and undefined values', () => {
      const articleWithNulls = {
        ...localArticle,
        summary: null,
        content: undefined,
        tags: undefined,
      };

      const conflicts = detectConflicts(articleWithNulls as any, remoteArticle);
      
      // Should detect conflicts for fields with different null/undefined vs actual values
      expect(conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('mergeArticles', () => {
    it('should perform two-way merge using Last-Write-Wins when no base article', () => {
      const merged = mergeArticles(olderLocalArticle, remoteArticle);
      
      // Remote should win due to later timestamp
      expect(merged.title).toBe(remoteArticle.title);
      expect(merged.isFavorite).toBe(remoteArticle.isFavorite);
      expect(merged.syncedAt).toBeDefined();
    });

    it('should perform three-way merge when base article is provided', () => {
      // Local changed title, remote changed favorite status
      const localWithTitleChange = {
        ...baseArticle,
        title: 'New Local Title',
        updatedAt: new Date('2023-01-02T10:00:00Z'),
      };
      
      const remoteWithFavoriteChange = {
        ...baseArticle,
        isFavorite: true,
        updatedAt: new Date('2023-01-02T11:00:00Z'),
      };

      const merged = mergeArticles(localWithTitleChange, remoteWithFavoriteChange, baseArticle);
      
      // Should combine both changes
      expect(merged.title).toBe('New Local Title'); // From local
      expect(merged.isFavorite).toBe(true); // From remote
      expect(merged.isArchived).toBe(baseArticle.isArchived); // Unchanged from base
    });

    it('should handle conflicting changes in three-way merge using Last-Write-Wins', () => {
      // Both local and remote changed the same field
      const localWithTitleChange = {
        ...baseArticle,
        title: 'Local Title Change',
        updatedAt: new Date('2023-01-02T10:00:00Z'), // Earlier
      };
      
      const remoteWithTitleChange = {
        ...baseArticle,
        title: 'Remote Title Change',
        updatedAt: new Date('2023-01-02T11:00:00Z'), // Later
      };

      const merged = mergeArticles(localWithTitleChange, remoteWithTitleChange, baseArticle);
      
      // Remote should win due to later timestamp
      expect(merged.title).toBe('Remote Title Change');
    });
  });

  describe('validateResolution', () => {
    it('should validate correct resolutions', () => {
      const validResolution = {
        ...localArticle,
        syncedAt: new Date(),
        isModified: false,
      };

      const validation = validateResolution(localArticle, remoteArticle, validResolution);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidResolution = {
        ...localArticle,
        id: '', // Empty ID
        title: '', // Empty title
        url: '', // Empty URL
      };

      const validation = validateResolution(localArticle, remoteArticle, invalidResolution);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.some(e => e.includes('ID'))).toBe(true);
      expect(validation.errors.some(e => e.includes('title'))).toBe(true);
      expect(validation.errors.some(e => e.includes('URL'))).toBe(true);
    });

    it('should detect future timestamps', () => {
      const futureDate = new Date(Date.now() + 86400000); // Tomorrow
      const invalidResolution = {
        ...localArticle,
        createdAt: futureDate,
        updatedAt: futureDate,
      };

      const validation = validateResolution(localArticle, remoteArticle, invalidResolution);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('future'))).toBe(true);
    });
  });

  describe('describeConflicts', () => {
    it('should generate human-readable conflict descriptions', () => {
      const conflicts = detectConflicts(localArticle, remoteArticle);
      const descriptions = describeConflicts(conflicts);
      
      expect(descriptions).toBeInstanceOf(Array);
      expect(descriptions.length).toBeGreaterThan(0);
      
      // Check that descriptions are readable
      descriptions.forEach(description => {
        expect(typeof description).toBe('string');
        expect(description.length).toBeGreaterThan(0);
      });
    });

    it('should handle different conflict types', () => {
      const testConflicts = [
        {
          field: 'title',
          localValue: 'Local Title',
          remoteValue: 'Remote Title',
          conflictType: ConflictType.CONTENT_MODIFIED,
          severity: 'medium' as const,
        },
        {
          field: 'isRead',
          localValue: true,
          remoteValue: false,
          conflictType: ConflictType.STATUS_CHANGED,
          severity: 'low' as const,
        },
        {
          field: 'tags',
          localValue: ['local'],
          remoteValue: ['remote'],
          conflictType: ConflictType.TAGS_UPDATED,
          severity: 'low' as const,
        },
      ];

      const descriptions = describeConflicts(testConflicts);
      
      expect(descriptions).toHaveLength(3);
      expect(descriptions[0]).toContain('Content in field "title"');
      expect(descriptions[1]).toContain('Status "isRead"');
      expect(descriptions[2]).toContain('Tags were updated');
    });
  });

  describe('ConflictResolutionUtils', () => {
    it('should export all utility functions', () => {
      expect(ConflictResolutionUtils.resolveConflict).toBe(resolveConflict);
      expect(ConflictResolutionUtils.detectConflicts).toBe(detectConflicts);
      expect(ConflictResolutionUtils.mergeArticles).toBe(mergeArticles);
      expect(ConflictResolutionUtils.validateResolution).toBe(validateResolution);
      expect(ConflictResolutionUtils.describeConflicts).toBe(describeConflicts);
      expect(ConflictResolutionUtils.createConflictResolutionResult).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle articles with minimal data', () => {
      const minimalLocal: Article = {
        id: 'minimal-1',
        title: 'Minimal Title',
        url: 'https://example.com',
        createdAt: new Date('2023-01-01T10:00:00Z'),
        updatedAt: new Date('2023-01-01T12:00:00Z'),
      } as Article;

      const minimalRemote: Article = {
        id: 'minimal-1',
        title: 'Different Title',
        url: 'https://example.com',
        createdAt: new Date('2023-01-01T10:00:00Z'),
        updatedAt: new Date('2023-01-01T14:00:00Z'),
      } as Article;

      const resolved = resolveConflict(
        minimalLocal,
        minimalRemote,
        ConflictResolutionStrategy.LAST_WRITE_WINS
      );

      expect(resolved.title).toBe(minimalRemote.title);
      expect(resolved.url).toBe(minimalRemote.url);
    });

    it('should handle empty and null tag arrays', () => {
      const localWithEmptyTags = { ...localArticle, tags: [] };
      const remoteWithNullTags = { ...remoteArticle, tags: undefined };

      const conflicts = detectConflicts(localWithEmptyTags, remoteWithNullTags as any);
      const tagConflict = conflicts.find(c => c.field === 'tags');
      
      expect(tagConflict).toBeDefined();
    });

    it('should handle very long titles and content', () => {
      const longText = 'a'.repeat(10000);
      const localWithLongText = { ...localArticle, title: longText, content: longText };
      const remoteWithDifferentText = { ...remoteArticle, title: 'short', content: 'short' };

      const resolved = resolveConflict(
        localWithLongText,
        remoteWithDifferentText,
        ConflictResolutionStrategy.LAST_WRITE_WINS
      );

      expect(typeof resolved.title).toBe('string');
      expect(typeof resolved.content).toBe('string');
    });
  });
});