/*
  # Performance Optimization Migration

  1. Changes
    - Set session-level statement timeout and work memory settings
    - Create optimized covering index for domain search
    - Create partial index for high-traffic domains
    - Optimize trigram index with better conditions

  2. Notes
    - Uses session-level settings instead of database-level
    - Adds covering indexes to reduce table lookups
    - Includes partial indexes to improve query performance
*/

-- Set session-level statement timeout
SET statement_timeout = '10000';

-- Set session-level work memory
SET work_mem = '16MB';

-- Create optimized covering index for domain search
CREATE INDEX IF NOT EXISTS domains_search_optimized_idx 
ON domains (domain text_pattern_ops, traffic_score DESC NULLS LAST)
INCLUDE (id, status, estimated_traffic, archive_snapshots, indexed_pages)
WHERE status = 'available';

-- Create partial index for high-traffic domains
CREATE INDEX IF NOT EXISTS domains_high_value_idx 
ON domains (estimated_traffic DESC NULLS LAST)
INCLUDE (domain, traffic_score)
WHERE status = 'available' AND estimated_traffic > 1000;

-- Drop and recreate trigram index with better conditions
DROP INDEX IF EXISTS domains_domain_trgm_idx;
CREATE INDEX domains_domain_trgm_idx 
ON domains USING gin (domain gin_trgm_ops)
WHERE status = 'available' AND length(domain) >= 3;