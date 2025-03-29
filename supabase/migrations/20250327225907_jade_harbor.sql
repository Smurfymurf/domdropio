/*
  # Create domains table and indexes

  1. New Tables
    - `domains`
      - `id` (uuid, primary key)
      - `domain` (text, unique)
      - `status` (text) - Domain status (available, pending, registered, expired)
      - `traffic_score` (integer) - Overall traffic score from analysis
      - `estimated_traffic` (integer) - Estimated monthly visits
      - `archive_snapshots` (integer) - Number of archive.org snapshots
      - `indexed_pages` (integer) - Number of pages indexed in search engines
      - `social_mentions` (integer) - Number of social media mentions
      - `web_presence` (integer) - Score based on backlinks and mentions
      - `mail_score` (double precision) - Score based on mail server configuration
      - `has_redirect` (boolean) - Whether domain redirects to another site
      - `redirect_url` (text) - URL domain redirects to, if any
      - `is_parked` (boolean) - Whether domain is parked
      - `has_ssl` (boolean) - Whether domain has SSL
      - `has_www` (boolean) - Whether domain has www subdomain
      - `has_robots_txt` (boolean) - Whether domain has robots.txt
      - `has_sitemap` (boolean) - Whether domain has sitemap.xml
      - `last_checked` (timestamptz) - When domain was last analyzed
      - `created_at` (timestamptz) - When record was created
      - `updated_at` (timestamptz) - When record was last updated

  2. Indexes
    - Primary key on id
    - Unique index on domain
    - Composite index for search and sorting
    - Trigram index for domain search
    - Status index for filtering

  3. Security
    - Enable RLS
    - Add policy for public read access
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create domains table
CREATE TABLE IF NOT EXISTS domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  traffic_score integer,
  estimated_traffic integer,
  archive_snapshots integer,
  indexed_pages integer,
  social_mentions integer,
  web_presence integer,
  mail_score double precision,
  has_redirect boolean,
  redirect_url text,
  is_parked boolean,
  has_ssl boolean,
  has_www boolean,
  has_robots_txt boolean,
  has_sitemap boolean,
  last_checked timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT domains_status_check CHECK (status IN ('available', 'pending', 'registered', 'expired'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS domains_domain_idx ON domains (domain);
CREATE INDEX IF NOT EXISTS domains_status_idx ON domains (status);
CREATE INDEX IF NOT EXISTS domains_traffic_score_idx ON domains (traffic_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS domains_domain_gin_idx ON domains USING gin (domain gin_trgm_ops);

-- Create covering index for search
CREATE INDEX IF NOT EXISTS domains_search_covering_idx ON domains 
USING btree (domain text_pattern_ops, traffic_score DESC NULLS LAST, estimated_traffic DESC NULLS LAST)
INCLUDE (id, status, archive_snapshots, indexed_pages, social_mentions, web_presence, mail_score)
WHERE status = 'available';

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_domains_updated_at
  BEFORE UPDATE ON domains
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for public read access
CREATE POLICY "Allow public read access"
  ON domains
  FOR SELECT
  TO public
  USING (true);