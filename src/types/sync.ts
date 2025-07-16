// Sync Types - Simple Mobile Sync Operations
export interface SyncState {
  status: SyncStatus;
  isSyncing?: boolean;
  lastSyncTime: string | null;
  syncError?: string | null;
  error: string | null;
  progress: SyncProgress;
  isOnline: boolean;
  networkType: NetworkType | null;
  config: SyncConfiguration;
  conflicts: SyncConflict[];
  stats: SyncStats;
}

export interface SyncOptions {
  fullSync?: boolean;
  force?: boolean;
}

export interface SyncResult {
  success: boolean;
  articlesUpdated: number;
  error?: string;
}

export enum SyncStatus {
  IDLE = 'idle',
  SYNCING = 'syncing',
  SUCCESS = 'success',
  ERROR = 'error',
}

export interface SyncConfig {
  backgroundSyncEnabled: boolean;
  syncInterval: number; // minutes
  syncOnWifiOnly: boolean;
}

export enum NetworkType {
  WIFI = 'wifi',
  CELLULAR = 'cellular',
  NONE = 'none',
}

export enum SyncPhase {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  SYNC_UP = 'sync_up',
  SYNC_DOWN = 'sync_down',
  RESOLVING_CONFLICTS = 'resolving_conflicts',
  COMPLETED = 'completed',
  ERROR = 'error',
}

export enum ConflictType {
  CONTENT_MODIFIED = 'content_modified',
  STATUS_CHANGED = 'status_changed',
  METADATA_CONFLICT = 'metadata_conflict',
  DELETION_CONFLICT = 'deletion_conflict',
}

export enum ConflictResolutionStrategy {
  LAST_WRITE_WINS = 'last_write_wins',
  MANUAL = 'manual',
}

export interface SyncConfiguration {
  backgroundSyncEnabled: boolean;
  syncInterval: number;
  syncOnWifiOnly: boolean;
  syncOnCellular: boolean;
  downloadImages: boolean;
  fullTextSync: boolean;
  conflictResolutionStrategy: ConflictResolutionStrategy;
  batchSize: number;
}

export interface SyncProgress {
  phase: SyncPhase;
  totalItems: number;
  processedItems: number;
  currentItem: string;
  estimatedTimeRemaining: number;
}

export interface SyncConflict {
  id: string;
  articleId: string;
  type: ConflictType;
  localVersion: any;
  remoteVersion: any;
  createdAt: string;
  resolvedAt: string | null;
  resolution: any;
}

export interface SyncStats {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  lastSyncDuration: number;
  averageSyncDuration: number;
  itemsSynced: {
    articlesCreated: number;
    articlesUpdated: number;
    articlesDeleted: number;
    conflictsResolved: number;
  };
  dataTransfer: {
    bytesUploaded: number;
    bytesDownloaded: number;
    requestCount: number;
    cacheHits: number;
  };
}