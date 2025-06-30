/**
 * Labels API type definitions
 * Comprehensive typing for Readeck labels/tags management operations
 */

import { PaginatedResponse } from './index';

// Core label entity types
export interface Label {
  id: string;
  name: string;
  color?: string;
  description?: string;
  articleCount: number;
  createdAt: string;
  updatedAt: string;
}

// Readeck API label types (snake_case from server)
export interface ReadeckLabel {
  id: string;
  name: string;
  color?: string;
  description?: string;
  article_count: number;
  created_at: string;
  updated_at: string;
}

export interface ReadeckLabelList {
  labels: ReadeckLabel[];
  pagination: {
    page: number;
    per_page: number;
    total_pages: number;
    total_count: number;
  };
}

// Label operations request types
export interface CreateLabelRequest {
  name: string;
  color?: string;
  description?: string;
}

export interface UpdateLabelRequest {
  name?: string;
  color?: string;
  description?: string;
}

export interface LabelFilters {
  page?: number;
  per_page?: number;
  search?: string;
  sort_by?: 'name' | 'created_at' | 'updated_at' | 'article_count';
  sort_order?: 'asc' | 'desc';
  include_empty?: boolean; // Include labels with no articles
}

// Label assignment operations
export interface AssignLabelRequest {
  article_id: string;
  label_id: string;
}

export interface RemoveLabelRequest {
  article_id: string;
  label_id: string;
}

export interface BatchLabelAssignmentRequest {
  article_ids: string[];
  label_ids: string[];
  operation: 'assign' | 'remove';
}

export interface BatchLabelAssignmentResult {
  successful: Array<{
    article_id: string;
    label_id: string;
  }>;
  failed: Array<{
    article_id: string;
    label_id: string;
    error: LabelApiError;
  }>;
  totalProcessed: number;
}

// API Service interface
export interface ILabelsApiService {
  fetchLabels(params: FetchLabelsParams): Promise<PaginatedResponse<Label>>;
  createLabel(params: CreateLabelParams): Promise<Label>;
  updateLabel(params: UpdateLabelParams): Promise<Label>;
  deleteLabel(params: DeleteLabelParams): Promise<void>;
  assignToArticle(params: AssignLabelToArticleParams): Promise<void>;
  removeFromArticle(params: RemoveLabelFromArticleParams): Promise<void>;
  getLabel(id: string): Promise<Label>;
  batchAssignLabels(params: BatchAssignLabelsParams): Promise<BatchLabelAssignmentResult>;
  getLabelStats(): Promise<LabelStats>;
}

// Service operation parameters
export interface FetchLabelsParams {
  page?: number;
  limit?: number;
  searchQuery?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'articleCount';
  sortOrder?: 'asc' | 'desc';
  includeEmpty?: boolean;
  forceRefresh?: boolean;
}

export interface CreateLabelParams {
  name: string;
  color?: string;
  description?: string;
}

export interface UpdateLabelParams {
  id: string;
  updates: Partial<Omit<Label, 'id' | 'createdAt' | 'updatedAt' | 'articleCount'>>;
}

export interface DeleteLabelParams {
  id: string;
  transferToLabel?: string; // Optional: transfer articles to another label before deletion
}

export interface AssignLabelToArticleParams {
  labelId: string;
  articleId: string;
}

export interface RemoveLabelFromArticleParams {
  labelId: string;
  articleId: string;
}

export interface BatchAssignLabelsParams {
  operation: 'assign' | 'remove';
  labelIds: string[];
  articleIds: string[];
}

// Response and statistics types
export interface LabelStats {
  totalLabels: number;
  totalAssignments: number;
  mostUsedLabels: Array<{
    label: Label;
    articleCount: number;
  }>;
  unusedLabels: number;
  averageLabelsPerArticle: number;
}

export interface LabelUsageStats {
  labelId: string;
  labelName: string;
  articleCount: number;
  recentlyUsed: boolean;
  lastUsed?: string;
  createdAt: string;
}

// Error types specific to label operations
export interface LabelApiError {
  code: LabelErrorCode;
  message: string;
  labelId?: string;
  articleId?: string;
  statusCode?: number;
  details?: any;
  retryable: boolean;
  timestamp: string;
}

export enum LabelErrorCode {
  LABEL_NOT_FOUND = 'LABEL_NOT_FOUND',
  LABEL_ALREADY_EXISTS = 'LABEL_ALREADY_EXISTS',
  INVALID_LABEL_NAME = 'INVALID_LABEL_NAME',
  LABEL_IN_USE = 'LABEL_IN_USE',
  ASSIGNMENT_FAILED = 'ASSIGNMENT_FAILED',
  REMOVAL_FAILED = 'REMOVAL_FAILED',
  DUPLICATE_ASSIGNMENT = 'DUPLICATE_ASSIGNMENT',
  ASSIGNMENT_NOT_FOUND = 'ASSIGNMENT_NOT_FOUND',
  BATCH_OPERATION_FAILED = 'BATCH_OPERATION_FAILED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  UNKNOWN_LABEL_ERROR = 'UNKNOWN_LABEL_ERROR'
}

// Cache and optimization types
export interface LabelCacheEntry {
  label: Label;
  cachedAt: string;
  expiresAt?: string;
  accessCount: number;
  lastAccessed: string;
}

export interface LabelSearchResult {
  labels: Label[];
  totalCount: number;
  searchQuery: string;
  executionTime: number;
  suggestions?: string[];
}

// Validation types
export interface LabelValidationRules {
  name: {
    required: boolean;
    minLength: number;
    maxLength: number;
    allowedCharacters: RegExp;
    forbiddenNames: string[];
  };
  color: {
    format: 'hex' | 'rgb' | 'hsl';
    allowedColors?: string[];
  };
  description: {
    maxLength: number;
  };
}

export interface LabelValidationResult {
  valid: boolean;
  errors: Array<{
    field: keyof Label;
    message: string;
    code: string;
  }>;
  warnings?: Array<{
    field: keyof Label;
    message: string;
    code: string;
  }>;
}

// Bulk operations
export interface BulkLabelOperation {
  type: 'create' | 'update' | 'delete' | 'merge';
  labels: Label[];
  options?: {
    skipValidation?: boolean;
    allowDuplicates?: boolean;
    mergeTarget?: string; // For merge operations
  };
}

export interface BulkLabelOperationResult {
  successful: Label[];
  failed: Array<{
    label: Partial<Label>;
    error: LabelApiError;
  }>;
  totalProcessed: number;
  skipped: number;
}

// Import/Export types
export interface LabelExportOptions {
  format: 'json' | 'csv' | 'xml';
  includeStats: boolean;
  includeAssignments: boolean;
  filters?: LabelFilters;
}

export interface LabelExportResult {
  success: boolean;
  filePath?: string;
  downloadUrl?: string;
  fileSize?: number;
  labelCount: number;
  error?: string;
}

export interface LabelImportOptions {
  source: 'json' | 'csv' | 'xml' | 'tags';
  filePath?: string;
  data?: any;
  options?: {
    skipDuplicates?: boolean;
    updateExisting?: boolean;
    preserveColors?: boolean;
    mergeStrategy?: 'replace' | 'merge' | 'skip';
  };
}

export interface LabelImportResult {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  errors?: Array<{
    item: any;
    error: string;
  }>;
}

// React hooks integration types
export interface UseLabelsOptions {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'name' | 'createdAt' | 'articleCount';
  sortOrder?: 'asc' | 'desc';
  includeEmpty?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseLabelsResult {
  labels: Label[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    totalPages: number;
    totalItems: number;
    hasMore: boolean;
  };
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export interface UseLabelResult {
  label: Label | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  update: (updates: Partial<Label>) => Promise<void>;
  delete: (transferTo?: string) => Promise<void>;
  assignToArticle: (articleId: string) => Promise<void>;
  removeFromArticle: (articleId: string) => Promise<void>;
}

// Advanced search and filtering
export interface LabelSearchFilters {
  query?: string;
  colorFilter?: string[];
  articleCountRange?: {
    min?: number;
    max?: number;
  };
  dateRange?: {
    from?: string;
    to?: string;
  };
  includeUnused?: boolean;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'articleCount' | 'relevance';
  sortOrder?: 'asc' | 'desc';
}

// Real-time updates
export interface LabelUpdateEvent {
  type: 'created' | 'updated' | 'deleted' | 'assigned' | 'removed';
  labelId: string;
  label?: Label;
  articleId?: string;
  changes?: Partial<Label>;
  timestamp: string;
  userId: string;
}

// Service configuration
export interface LabelsServiceConfig {
  maxConcurrentRequests: number;
  requestTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  cacheSize: number;
  cacheTTL: number;
  batchSize: number;
  validationRules: LabelValidationRules;
}

// Type guards and utility types
export type LabelField = keyof Label;
export type RequiredLabelFields = 'id' | 'name' | 'createdAt' | 'updatedAt';
export type OptionalLabelFields = Exclude<LabelField, RequiredLabelFields>;

export interface CreateLabelDTO extends Pick<Label, 'name'> {
  color?: string;
  description?: string;
}

export interface UpdateLabelDTO extends Partial<Omit<Label, RequiredLabelFields>> {}

// Re-export commonly used types
export type { PaginatedResponse } from './index';