export type AnalysisProgress = {
  step: string;
  message: string;
  progress: number;
};

export type DomainAnalysis = {
  domain: string;
  status: string;
  traffic_score: number;
  estimated_traffic: number;
  archive_snapshots: number;
  indexed_pages: number;
  social_mentions: number;
  web_presence: number;
  mail_score: number;
  has_redirect: boolean;
  redirect_url: string | null;
  is_parked: boolean;
  last_checked: string;
};