/*
  # Domain Analyzer Database Schema

  1. New Tables
    - `domains`
      - `id` (uuid, primary key)
      - `domain` (text, unique)
      - `status` (text) - Domain status (available, registered, etc.)
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
      - `last_checked` (timestamptz) - When domain was last analyzed
      - `created_at` (timestamptz) - When record was created
      - `updated_at` (timestamptz) - When record was last updated

  2. Functions
    - `update_updated_at()` - Trigger function to automatically update updated_at timestamp

  3. Security
    - Enable RLS on domains table
    - Add policy for public read access to domains
*/

-- Create trigger function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
  last_checked timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index on domain for faster lookups
CREATE INDEX IF NOT EXISTS domains_domain_idx ON domains (domain);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS domains_status_idx ON domains (status);

-- Create index on traffic_score for sorting
CREATE INDEX IF NOT EXISTS domains_traffic_score_idx ON domains (traffic_score DESC);

-- Enable Row Level Security
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'domains' 
    AND policyname = 'Allow public read access'
  ) THEN
    CREATE POLICY "Allow public read access"
      ON domains
      FOR SELECT
      TO public
      USING (true);
  END IF;
END $$;

-- Create trigger for updating updated_at
DROP TRIGGER IF EXISTS update_domains_updated_at ON domains;
CREATE TRIGGER update_domains_updated_at
  BEFORE UPDATE ON domains
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();