/**
 * Conflict Resolution Utilities
 *
 * Provides conflict resolution strategies for synchronization between local and remote data.
 * Implements various strategies including Last-Write-Wins, Local-Wins, Remote-Wins, and Manual resolution.
 */

import { Article } from '../types';
import { ConflictResolutionStrategy, ConflictType } from '../types/sync';

/**
 * Result of a conflict resolution operation
 */
export interface ConflictResolutionResult<T = any> {
  resolved: boolean;
  resolvedData?: T;
  strategy: ConflictResolutionStrategy;
  conflictType: ConflictType;
  metadata: {
    localTimestamp: Date;
    remoteTimestamp: Date;
    resolutionTimestamp: Date;
    changes: string[];
  };
}

/**
 * Configuration for conflict resolution
 */
export interface ConflictResolutionConfig {
  strategy: ConflictResolutionStrategy;
  autoResolve: boolean;
  preserveLocalChanges: boolean;
  preserveRemoteChanges: boolean;
  logConflicts: boolean;
}

/**
 * Details about detected conflicts between local and remote data
 */
export interface ConflictDetails {
  field: string;
  localValue: any;
  remoteValue: any;
  conflictType: ConflictType;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Resolve conflicts between local and remote articles using the specified strategy
 */
export function resolveConflict(
  localArticle: Article,
  remoteArticle: Article,
  strategy: ConflictResolutionStrategy,
  config?: Partial<ConflictResolutionConfig>
): Article {
  const resolverConfig: ConflictResolutionConfig = {
    strategy,
    autoResolve: true,
    preserveLocalChanges: false,
    preserveRemoteChanges: false,
    logConflicts: true,
    ...config,
  };

  if (resolverConfig.logConflicts) {
    console.log(
      `[ConflictResolution] Resolving conflict for article: ${localArticle.id} using strategy: ${strategy}`
    );
  }

  switch (strategy) {
    case ConflictResolutionStrategy.LAST_WRITE_WINS:
      return resolveLastWriteWins(localArticle, remoteArticle, resolverConfig);

    case ConflictResolutionStrategy.LOCAL_WINS:
      return resolveLocalWins(localArticle, remoteArticle, resolverConfig);

    case ConflictResolutionStrategy.REMOTE_WINS:
      return resolveRemoteWins(localArticle, remoteArticle, resolverConfig);

    case ConflictResolutionStrategy.MANUAL:
      throw new Error('Manual conflict resolution requires user intervention');

    default:
      throw new Error(`Unknown conflict resolution strategy: ${strategy}`);
  }
}

/**
 * Resolve conflict using Last-Write-Wins strategy
 * The version with the most recent updatedAt timestamp wins
 */
function resolveLastWriteWins(
  localArticle: Article,
  remoteArticle: Article,
  config: ConflictResolutionConfig
): Article {
  const localTimestamp = new Date(localArticle.updatedAt);
  const remoteTimestamp = new Date(remoteArticle.updatedAt);

  if (config.logConflicts) {
    console.log(`[ConflictResolution] Last-Write-Wins comparison:`, {
      localTimestamp: localTimestamp.toISOString(),
      remoteTimestamp: remoteTimestamp.toISOString(),
      winner: localTimestamp > remoteTimestamp ? 'local' : 'remote',
    });
  }

  // Return the version with the latest timestamp
  const winningArticle =
    localTimestamp > remoteTimestamp ? localArticle : remoteArticle;

  // Preserve certain metadata from both versions
  return {
    ...winningArticle,
    // Always use the most recent sync timestamp
    syncedAt: new Date().toISOString(),
    // Mark as no longer modified since we're resolving the conflict
    isModified: false,
  };
}

/**
 * Resolve conflict using Local-Wins strategy
 * Always prefer the local version
 */
function resolveLocalWins(
  localArticle: Article,
  remoteArticle: Article,
  config: ConflictResolutionConfig
): Article {
  if (config.logConflicts) {
    console.log(
      `[ConflictResolution] Local-Wins resolution for article: ${localArticle.id}`
    );
  }

  return {
    ...localArticle,
    // Update sync timestamp but keep as modified to upload later
    syncedAt: new Date().toISOString(),
    isModified: true,
  };
}

/**
 * Resolve conflict using Remote-Wins strategy
 * Always prefer the remote version
 */
function resolveRemoteWins(
  localArticle: Article,
  remoteArticle: Article,
  config: ConflictResolutionConfig
): Article {
  if (config.logConflicts) {
    console.log(
      `[ConflictResolution] Remote-Wins resolution for article: ${localArticle.id}`
    );
  }

  return {
    ...remoteArticle,
    // Update sync timestamp and mark as not modified
    syncedAt: new Date().toISOString(),
    isModified: false,
  };
}

/**
 * Detect conflicts between local and remote articles
 */
export function detectConflicts(
  localArticle: Article,
  remoteArticle: Article
): ConflictDetails[] {
  const conflicts: ConflictDetails[] = [];

  // Check for field-level conflicts
  const fieldsToCheck: Array<keyof Article> = [
    'title',
    'summary',
    'content',
    'isArchived',
    'isFavorite',
    'isRead',
    'tags',
  ];

  for (const field of fieldsToCheck) {
    const localValue = localArticle[field];
    const remoteValue = remoteArticle[field];

    if (!deepEqual(localValue, remoteValue)) {
      conflicts.push({
        field: field as string,
        localValue,
        remoteValue,
        conflictType: getConflictType(field, localValue, remoteValue),
        severity: getConflictSeverity(field, localValue, remoteValue),
      });
    }
  }

  return conflicts;
}

/**
 * Determine the type of conflict based on the field and values
 */
function getConflictType(
  field: keyof Article,
  localValue: any,
  remoteValue: any
): ConflictType {
  switch (field) {
    case 'title':
    case 'summary':
    case 'content':
      return ConflictType.CONTENT_MODIFIED;

    case 'isArchived':
    case 'isFavorite':
    case 'isRead':
      return ConflictType.STATUS_CHANGED;

    case 'tags':
      return ConflictType.TAGS_UPDATED;

    default:
      return ConflictType.CONTENT_MODIFIED;
  }
}

/**
 * Determine the severity of a conflict
 */
function getConflictSeverity(
  field: keyof Article,
  localValue: any,
  remoteValue: any
): 'low' | 'medium' | 'high' {
  switch (field) {
    case 'content':
      return 'high'; // Content changes are high severity

    case 'title':
      return 'medium'; // Title changes are medium severity

    case 'summary':
      return 'medium';

    case 'isArchived':
    case 'isFavorite':
    case 'isRead':
      return 'low'; // Status changes are low severity

    case 'tags':
      return 'low'; // Tag changes are low severity

    default:
      return 'medium';
  }
}

/**
 * Check if two values are deeply equal
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;

  if (a == null || b == null) return a === b;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  return false;
}

/**
 * Create a detailed conflict resolution result
 */
export function createConflictResolutionResult<T>(
  localData: T,
  remoteData: T,
  resolvedData: T,
  strategy: ConflictResolutionStrategy,
  conflictType: ConflictType,
  changes: string[]
): ConflictResolutionResult<T> {
  return {
    resolved: true,
    resolvedData,
    strategy,
    conflictType,
    metadata: {
      localTimestamp: new Date(),
      remoteTimestamp: new Date(),
      resolutionTimestamp: new Date(),
      changes,
    },
  };
}

/**
 * Merge articles intelligently, combining non-conflicting changes
 */
export function mergeArticles(
  localArticle: Article,
  remoteArticle: Article,
  baseArticle?: Article
): Article {
  // If we have a base article (common ancestor), perform three-way merge
  if (baseArticle) {
    return performThreeWayMerge(baseArticle, localArticle, remoteArticle);
  }

  // Otherwise, perform two-way merge using Last-Write-Wins as default
  return resolveLastWriteWins(localArticle, remoteArticle, {
    strategy: ConflictResolutionStrategy.LAST_WRITE_WINS,
    autoResolve: true,
    preserveLocalChanges: false,
    preserveRemoteChanges: false,
    logConflicts: true,
  });
}

/**
 * Perform three-way merge when base article is available
 */
function performThreeWayMerge(
  baseArticle: Article,
  localArticle: Article,
  remoteArticle: Article
): Article {
  const merged: Article = { ...baseArticle };

  // Fields to merge
  const fieldsToMerge: Array<keyof Article> = [
    'title',
    'summary',
    'content',
    'isArchived',
    'isFavorite',
    'isRead',
    'tags',
  ];

  for (const field of fieldsToMerge) {
    const baseValue = baseArticle[field];
    const localValue = localArticle[field];
    const remoteValue = remoteArticle[field];

    // If local and remote are the same, use that value
    if (deepEqual(localValue, remoteValue)) {
      (merged as any)[field] = localValue;
    }
    // If local changed but remote didn't, use local
    else if (deepEqual(remoteValue, baseValue)) {
      (merged as any)[field] = localValue;
    }
    // If remote changed but local didn't, use remote
    else if (deepEqual(localValue, baseValue)) {
      (merged as any)[field] = remoteValue;
    }
    // Both changed differently - use Last-Write-Wins
    else {
      const localTimestamp = new Date(localArticle.updatedAt);
      const remoteTimestamp = new Date(remoteArticle.updatedAt);
      (merged as any)[field] =
        localTimestamp > remoteTimestamp ? localValue : remoteValue;
    }
  }

  // Always use the latest timestamps
  merged.updatedAt = new Date(
    Math.max(
      new Date(localArticle.updatedAt).getTime(),
      new Date(remoteArticle.updatedAt).getTime()
    )
  );
  merged.syncedAt = new Date().toISOString();
  merged.isModified = false;

  return merged;
}

/**
 * Validate that a conflict resolution is safe to apply
 */
export function validateResolution(
  localArticle: Article,
  remoteArticle: Article,
  resolvedArticle: Article
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Ensure essential fields are preserved
  if (!resolvedArticle.id) {
    errors.push('Resolved article must have an ID');
  }

  if (!resolvedArticle.title || resolvedArticle.title.trim().length === 0) {
    errors.push('Resolved article must have a title');
  }

  if (!resolvedArticle.url) {
    errors.push('Resolved article must have a URL');
  }

  // Ensure timestamps are reasonable
  if (resolvedArticle.createdAt > new Date()) {
    errors.push('Resolved article creation date cannot be in the future');
  }

  if (resolvedArticle.updatedAt > new Date()) {
    errors.push('Resolved article update date cannot be in the future');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate a human-readable description of the conflicts
 */
export function describeConflicts(conflicts: ConflictDetails[]): string[] {
  return conflicts.map(conflict => {
    switch (conflict.conflictType) {
      case ConflictType.CONTENT_MODIFIED:
        return `Content in field "${conflict.field}" was modified in both local and remote versions`;

      case ConflictType.STATUS_CHANGED:
        return `Status "${conflict.field}" was changed: local=${conflict.localValue}, remote=${conflict.remoteValue}`;

      case ConflictType.TAGS_UPDATED:
        return `Tags were updated: local=[${conflict.localValue?.join(', ') || ''}], remote=[${conflict.remoteValue?.join(', ') || ''}]`;

      default:
        return `Field "${conflict.field}" has conflicting values`;
    }
  });
}

/**
 * Export utility functions for external use
 */
export const ConflictResolutionUtils = {
  resolveConflict,
  detectConflicts,
  mergeArticles,
  validateResolution,
  describeConflicts,
  createConflictResolutionResult,
};
