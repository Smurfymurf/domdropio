/*
  # Domain Analysis Database Schema

  1. New Tables
    - `domains`
      - `id` (uuid, primary key)
      - `domain` (text, unique) - The domain name
      - `status` (text) - Current status (available, registered, etc.)
      - `last_checked` (timestamptz) - When the domain was last checked
      - `traffic_score` (integer) - 0-100 score based on traffic analysis
      - `estimated_traffic` (integer) - Estimated monthly visitors
      - `archive_snapshots` (integer) - Number of archive.org snapshots
      - `indexed_pages` (integer) - Number of pages indexed in search engines
      - `social_mentions` (integer) - Number of social media mentions
      - `web_presence` (integer) - Number of backlinks
      - `mail_score` (float) - Score based on mail server configuration
      - `has_redirect` (boolean) - Whether domain redirects
      - `redirect_url` (text) - URL domain redirects to (if any)
      - `is_parked` (boolean) - Whether domain is parked
      - `created_at` (timestamptz) - When record was created
      - `updated_at` (timestamptz) - When record was last updated

  2. Security
    - Enable RLS on domains table
    - Add policies for public read access
*/

CREATE TABLE domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  last_checked timestamptz,
  traffic_score integer,
  estimated_traffic integer,
  archive_snapshots integer,
  indexed_pages integer,
  social_mentions integer,
  web_presence integer,
  mail_score float,
  has_redirect boolean,
  redirect_url text,
  is_parked boolean,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access"
  ON domains
  FOR SELECT
  TO public
  USING (true);

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