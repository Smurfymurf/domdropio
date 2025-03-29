/*
  # Performance Optimization Migration

  1. Changes
    - Create covering index for domain search with traffic metrics
    - Add specialized index for high-traffic domains
    - Optimize trigram index for domain search
    - Set session parameters for query optimization
    
  2. Notes
    - Uses session-level settings instead of database-level
    - Includes covering indexes for common queries
    - Optimizes for high-traffic domain searches
*/

-- Set session-level statement timeout
SET statement_timeout = '30000';

-- Set session-level work memory
SET work_mem = '16MB';

-- Create covering index for domain search with traffic score
CREATE INDEX IF NOT EXISTS domains_search_covering_idx 
ON domains (domain, traffic_score DESC NULLS LAST, estimated_traffic DESC NULLS LAST)
INCLUDE (id, status, archive_snapshots, indexed_pages, social_mentions, web_presence, mail_score, last_checked)
WHERE status = 'available';

-- Create partial index for high traffic domains
CREATE INDEX IF NOT EXISTS domains_high_traffic_idx 
ON domains (estimated_traffic DESC NULLS LAST, traffic_score DESC NULLS LAST)
WHERE estimated_traffic > 1000 AND status = 'available';

-- Optimize existing trigram index with partial condition
DROP INDEX IF EXISTS domains_domain_trgm_idx;
CREATE INDEX domains_domain_trgm_idx 
ON domains USING gin (domain gin_trgm_ops)
WHERE status = 'available';