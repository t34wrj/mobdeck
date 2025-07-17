-- Migration 002: Add content_url column to articles table
-- This migration adds support for storing article content URLs from the Readeck API

-- Add content_url column to articles table
ALTER TABLE articles ADD COLUMN content_url TEXT;

-- Update schema version
INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (2, datetime('now'));