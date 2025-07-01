export interface SyncState {
  // Sync status tracking
  status: SyncStatus;
  lastSyncTime: string | null;

  // Progress tracking
  progress: SyncProgress;

  // Network and connectivity
  isOnline: boolean;
  networkType: NetworkType | null;

  // Configuration
  config: SyncConfiguration;

  // Conflict resolution
  conflicts: ConflictResolution[];

  // Error handling
  error: string | null;

  // Statistics
  stats: SyncStatistics;
}

export enum SyncStatus {
  IDLE = 'idle',
  SYNCING = 'syncing',
  SUCCESS = 'success',
  ERROR = 'error',
  PAUSED = 'paused',
}

export enum NetworkType {
  WIFI = 'wifi',
  CELLULAR = 'cellular',
  ETHERNET = 'ethernet',
  UNKNOWN = 'unknown',
}

export interface SyncProgress {
  phase: SyncPhase;
  totalItems: number;
  processedItems: number;
  currentItem: string | null;
  estimatedTimeRemaining: number | null;
}

export enum SyncPhase {
  INITIALIZING = 'initializing',
  UPLOADING_CHANGES = 'uploading_changes',
  DOWNLOADING_UPDATES = 'downloading_updates',
  RESOLVING_CONFLICTS = 'resolving_conflicts',
  FINALIZING = 'finalizing',
}

export interface SyncConfiguration {
  // Background sync settings
  backgroundSyncEnabled: boolean;
  syncInterval: number; // minutes

  // Network preferences
  syncOnWifiOnly: boolean;
  syncOnCellular: boolean;

  // Data preferences
  downloadImages: boolean;
  fullTextSync: boolean;

  // Conflict resolution strategy
  conflictResolutionStrategy: ConflictResolutionStrategy;

  // Batch size
  batchSize: number;
}

export enum ConflictResolutionStrategy {
  LAST_WRITE_WINS = 'last_write_wins',
  MANUAL = 'manual',
  LOCAL_WINS = 'local_wins',
  REMOTE_WINS = 'remote_wins',
}

export interface ConflictResolution {
  id: string;
  articleId: string;
  type: ConflictType;
  localVersion: any;
  remoteVersion: any;
  createdAt: string;
  resolvedAt: string | null;
  resolution: ConflictResolutionStrategy | null;
}

export enum ConflictType {
  CONTENT_MODIFIED = 'content_modified',
  STATUS_CHANGED = 'status_changed',
  TAGS_UPDATED = 'tags_updated',
  DELETED_LOCALLY = 'deleted_locally',
  DELETED_REMOTELY = 'deleted_remotely',
}

export interface SyncStatistics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  lastSyncDuration: number | null; // milliseconds
  averageSyncDuration: number | null; // milliseconds
  itemsSynced: SyncItemStats;
  dataTransfer: DataTransferStats;
}

export interface SyncItemStats {
  articlesCreated: number;
  articlesUpdated: number;
  articlesDeleted: number;
  conflictsResolved: number;
}

export interface DataTransferStats {
  bytesUploaded: number;
  bytesDownloaded: number;
  requestCount: number;
  cacheHits: number;
}

// Action payload types
export interface StartSyncPayload {
  fullSync?: boolean;
  forceSync?: boolean;
  syncOptions?: Partial<SyncConfiguration>;
}

export interface SyncProgressPayload {
  phase: SyncPhase;
  totalItems: number;
  processedItems: number;
  currentItem?: string;
  estimatedTimeRemaining?: number;
}

export interface SyncSuccessPayload {
  syncDuration: number;
  itemsProcessed: number;
  conflictsDetected: number;
  syncTime: string;
}

export interface SyncErrorPayload {
  error: string;
  errorCode?: string;
  phase?: SyncPhase;
  retryable?: boolean;
}

export interface AddConflictPayload {
  articleId: string;
  type: ConflictType;
  localVersion: any;
  remoteVersion: any;
}

export interface ResolveConflictPayload {
  conflictId: string;
  resolution: ConflictResolutionStrategy;
  resolvedVersion?: any;
}

export interface UpdateSyncConfigPayload {
  config: Partial<SyncConfiguration>;
}

export interface NetworkStatusPayload {
  isOnline: boolean;
  networkType: NetworkType | null;
}
