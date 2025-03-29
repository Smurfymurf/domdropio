/*
  # Roll back to stable state

  1. Changes
    - Drop all existing indexes to avoid conflicts
    - Recreate essential indexes with proper conditions
    - Add performance optimizations
    - Enable trigram extension for text search

  2. Indexes
    - Main search index with covering columns
    - Traffic-based indexes for performance
    - Trigram index for text search
*/

-- Enable trigram extension if not exists
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Drop existing indexes to avoid conflicts
DROP INDEX IF EXISTS domains_search_covering_idx;
DROP INDEX IF EXISTS domains_search_optimized_idx;
DROP INDEX IF EXISTS domains_high_value_idx;
DROP INDEX IF EXISTS domains_high_traffic_idx;
DROP INDEX IF EXISTS domains_traffic_idx;
DROP INDEX IF EXISTS domains_traffic_est_idx;
DROP INDEX IF EXISTS domains_domain_trgm_idx;
DROP INDEX IF EXISTS domains_traffic_composite_idx;
DROP INDEX IF EXISTS domains_search_composite_idx;

-- Set reasonable session parameters
SET statement_timeout = '30000';
SET work_mem = '16MB';

-- Create main search index with covering columns
CREATE INDEX domains_search_covering_idx ON domains 
USING btree (domain text_pattern_ops, traffic_score DESC NULLS LAST, estimated_traffic DESC NULLS LAST)
INCLUDE (id, status, archive_snapshots, indexed_pages, social_mentions, web_presence, mail_score)
WHERE status = 'available';

-- Create index for high-traffic domains
CREATE INDEX domains_traffic_idx ON domains 
USING btree (estimated_traffic DESC NULLS LAST, traffic_score DESC NULLS LAST)
WHERE status = 'available' AND estimated_traffic > 1000;

-- Create trigram index for text search
CREATE INDEX domains_domain_trgm_idx ON domains 
USING gin (domain gin_trgm_ops)
WHERE status = 'available' AND length(domain) >= 3;

-- Add status validation if not exists
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'domains_status_check'
  ) THEN
    ALTER TABLE domains 
    ADD CONSTRAINT domains_status_check 
    CHECK (status IN ('available', 'pending', 'registered', 'expired'));
  END IF;
END $$;