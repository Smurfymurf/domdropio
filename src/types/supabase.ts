export interface Domain {
  id: string;
  domain: string;
  status: string;
  traffic_score: number | null;
  estimated_traffic: number | null;
  archive_snapshots: number | null;
  indexed_pages: number | null;
  social_mentions: number | null;
  web_presence: number | null;
  mail_score: number | null;
  has_redirect: boolean | null;
  redirect_url: string | null;
  is_parked: boolean | null;
  has_ssl: boolean | null;
  has_www: boolean | null;
  has_robots_txt: boolean | null;
  has_sitemap: boolean | null;
  last_checked: string | null;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      domains: {
        Row: Domain;
        Insert: Omit<Domain, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Domain, 'id' | 'created_at' | 'updated_at'>>;
      };
    };
  };
}