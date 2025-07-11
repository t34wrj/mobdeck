-- Mobdeck SQLite Database Schema
-- Version: 1.0
-- Purpose: Offline-first article caching for Readeck mobile client

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Articles table: Core article storage
CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    url TEXT NOT NULL,
    image_url TEXT,
    read_time INTEGER,
    is_archived INTEGER NOT NULL DEFAULT 0,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    is_read INTEGER NOT NULL DEFAULT 0,
    source_url TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    synced_at INTEGER,
    -- Track local modifications for sync
    is_modified INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER
);

-- Labels table: Tag/label management
CREATE TABLE IF NOT EXISTS labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    synced_at INTEGER
);

-- Article-Label junction table: Many-to-many relationship
CREATE TABLE IF NOT EXISTS article_labels (
    article_id TEXT NOT NULL,
    label_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (article_id, label_id),
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
    FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
);

-- Sync metadata table: Track synchronization state
CREATE TABLE IF NOT EXISTS sync_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL, -- 'article', 'label', etc.
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL, -- 'create', 'update', 'delete'
    local_timestamp INTEGER NOT NULL,
    server_timestamp INTEGER,
    sync_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'syncing', 'completed', 'failed'
    conflict_resolution TEXT, -- 'local_wins', 'server_wins', 'merged'
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Database version tracking for migrations
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL,
    description TEXT
);

-- Performance indexes - optimized for common query patterns

-- Single column indexes for basic filtering
CREATE INDEX IF NOT EXISTS idx_articles_is_archived ON articles(is_archived);
CREATE INDEX IF NOT EXISTS idx_articles_is_favorite ON articles(is_favorite);
CREATE INDEX IF NOT EXISTS idx_articles_is_read ON articles(is_read);
CREATE INDEX IF NOT EXISTS idx_articles_is_modified ON articles(is_modified);
CREATE INDEX IF NOT EXISTS idx_articles_deleted_at ON articles(deleted_at);
CREATE INDEX IF NOT EXISTS idx_articles_synced_at ON articles(synced_at);

-- Composite indexes for common filtering combinations
CREATE INDEX IF NOT EXISTS idx_articles_deleted_archived ON articles(deleted_at, is_archived, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_deleted_favorite ON articles(deleted_at, is_favorite, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_deleted_read ON articles(deleted_at, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_archived_read ON articles(is_archived, is_read, created_at DESC);

-- Covering indexes for pagination queries (includes commonly selected columns)
CREATE INDEX IF NOT EXISTS idx_articles_list_covering ON articles(deleted_at, created_at DESC, id, title, summary, is_archived, is_favorite, is_read);
CREATE INDEX IF NOT EXISTS idx_articles_modified_covering ON articles(is_modified, updated_at DESC, id, synced_at);

-- Time-based indexes for sorting and sync operations
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_updated_at ON articles(updated_at DESC);

-- Label operations optimization
CREATE INDEX IF NOT EXISTS idx_article_labels_article ON article_labels(article_id, label_id);
CREATE INDEX IF NOT EXISTS idx_article_labels_label ON article_labels(label_id, article_id);

-- Sync metadata optimization
CREATE INDEX IF NOT EXISTS idx_sync_metadata_entity ON sync_metadata(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_status ON sync_metadata(sync_status);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_timestamp ON sync_metadata(local_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_status_time ON sync_metadata(sync_status, created_at DESC);

-- Full-text search support for article content
CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
    id UNINDEXED,
    title,
    summary,
    content,
    content=articles,
    content_rowid=rowid
);

-- Triggers to maintain FTS index
CREATE TRIGGER IF NOT EXISTS articles_fts_insert 
AFTER INSERT ON articles 
BEGIN
    INSERT INTO articles_fts(id, title, summary, content) 
    VALUES (new.id, new.title, new.summary, new.content);
END;

CREATE TRIGGER IF NOT EXISTS articles_fts_update 
AFTER UPDATE ON articles 
BEGIN
    UPDATE articles_fts 
    SET title = new.title, summary = new.summary, content = new.content 
    WHERE id = new.id;
END;

CREATE TRIGGER IF NOT EXISTS articles_fts_delete 
AFTER DELETE ON articles 
BEGIN
    DELETE FROM articles_fts WHERE id = old.id;
END;

-- Initial schema version
INSERT OR IGNORE INTO schema_version (version, applied_at, description) 
VALUES (1, strftime('%s', 'now'), 'Initial database schema with articles, labels, and sync metadata');