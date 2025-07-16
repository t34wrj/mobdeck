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
  const remoteTime = new Date(remoteArticle.updatedAt || remoteArticle.createdAt);
  
  if (localTime > remoteTime) {
    return {
      resolved: localArticle,
      strategy: 'local'
    };
  } else {
    return {
      resolved: remoteArticle,
      strategy: 'remote'
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