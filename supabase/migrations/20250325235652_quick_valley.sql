/*
  # Performance Optimization Migration

  1. Changes
    - Add trigram extension for text search
    - Create optimized indexes for domain search
    - Add status validation constraint
    
  2. Notes
    - Removes CONCURRENTLY to work within transaction
    - Adds partial indexes for better performance
    - Includes status validation
*/

-- Enable trigram extension for better text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create trigram index for domain search
CREATE INDEX IF NOT EXISTS domains_domain_trgm_idx 
ON domains USING gin (domain gin_trgm_ops)
WHERE status = 'available';

-- Create traffic score index
CREATE INDEX IF NOT EXISTS domains_traffic_idx 
ON domains (traffic_score DESC NULLS LAST)
WHERE status = 'available';

-- Create estimated traffic index
CREATE INDEX IF NOT EXISTS domains_traffic_est_idx 
ON domains (estimated_traffic DESC NULLS LAST)
WHERE status = 'available' AND estimated_traffic IS NOT NULL;

-- Add status validation
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