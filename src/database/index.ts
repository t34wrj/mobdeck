// Database module exports
export { DatabaseManager, databaseManager } from './init';
export { validator } from './validate';
export * from './types';

// Re-export common types for convenience
export type {
  Article,
  DatabaseArticle,
  DBArticle,
  DBLabel,
  DBSyncMetadata,
  ArticleFilters,
  DatabaseStats
} from '../types';