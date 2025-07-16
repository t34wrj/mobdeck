/**
 * Simple Conflict Resolution for Mobile App
 * Basic sync conflict handling using timestamps
 */

import { Article } from '../types';

export interface ConflictResult<T> {
  resolved: T;
  strategy: 'local' | 'remote' | 'merged';
}

export function resolveArticleConflict(
  localArticle: Article,
  remoteArticle: Article
): ConflictResult<Article> {
  // Simple timestamp-based resolution
  const localTime = new Date(localArticle.updatedAt || localArticle.createdAt);
  const remoteTime = new Date(
    remoteArticle.updatedAt || remoteArticle.createdAt
  );

  if (localTime > remoteTime) {
    return {
      resolved: localArticle,
      strategy: 'local',
    };
  } else {
    return {
      resolved: remoteArticle,
      strategy: 'remote',
    };
  }
}

export function mergeNonConflictingFields<T extends Record<string, any>>(
  local: T,
  remote: T,
  conflictFields: (keyof T)[]
): T {
  const merged = { ...remote };

  // Keep local values for non-conflicting fields that have been modified locally
  Object.keys(local).forEach(key => {
    if (!conflictFields.includes(key) && local[key] !== remote[key]) {
      (merged as any)[key] = local[key];
    }
  });

  return merged;
}

export function resolveConflict<T>(
  localData: T,
  remoteData: T,
  strategy: 'local' | 'remote' | 'merge' = 'remote'
): ConflictResult<T> {
  switch (strategy) {
    case 'local':
      return {
        resolved: localData,
        strategy: 'local',
      };
    case 'remote':
      return {
        resolved: remoteData,
        strategy: 'remote',
      };
    case 'merge':
    default:
      // For articles, use the existing article conflict resolution
      if (localData && typeof localData === 'object' && 'updatedAt' in localData) {
        return resolveArticleConflict(localData as any, remoteData as any) as ConflictResult<T>;
      }
      // Default to remote for other types
      return {
        resolved: remoteData,
        strategy: 'remote',
      };
  }
}
