import type { AnalysisProgress } from '../types/analyzer';

export class TrafficAnalyzer {
  private onProgress?: (progress: AnalysisProgress) => void;
  private readonly ARCHIVE_API_BASE = 'https://archive.org/wayback/available';

  constructor(onProgress?: (progress: AnalysisProgress) => void) {
    this.onProgress = onProgress;
  }

  private emitProgress(step: string, message: string, progress: number) {
    if (this.onProgress) {
      this.onProgress({ step, message, progress });
    }
  }

  private async checkArchiveHistory(domain: string): Promise<{
    snapshots: number;
    recentSnapshots: number;
    lastSeen: Date | null;
  }> {
    try {
      // Use the Wayback Availability API which supports CORS
      const response = await fetch(`${this.ARCHIVE_API_BASE}?url=${domain}&timestamp=*`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; DomainAnalyzer/1.0)'
        }
      });

      if (!response.ok) {
        throw new Error(`Archive API returned ${response.status}`);
      }

      const data = await response.json();
      
      if (!data || !data.archived_snapshots) {
        return { snapshots: 0, recentSnapshots: 0, lastSeen: null };
      }

      // Get the closest snapshot timestamp
      const timestamp = data.archived_snapshots.closest?.timestamp;
      if (!timestamp) {
        return { snapshots: 0, recentSnapshots: 0, lastSeen: null };
      }

      // Parse the timestamp (format: YYYYMMDDhhmmss)
      const year = parseInt(timestamp.substring(0, 4));
      const month = parseInt(timestamp.substring(4, 6)) - 1;
      const day = parseInt(timestamp.substring(6, 8));
      const lastSeen = new Date(year, month, day);

      // Estimate snapshots based on availability
      const snapshots = data.archived_snapshots.closest?.available ? 1 : 0;
      
      // Consider it recent if within last 3 months
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const recentSnapshots = lastSeen > threeMonthsAgo ? 1 : 0;

      return {
        snapshots,
        recentSnapshots,
        lastSeen: lastSeen || null
      };
    } catch (error) {
      console.warn('Archive check failed:', error);
      return { snapshots: 0, recentSnapshots: 0, lastSeen: null };
    }
  }

  private async checkDNS(domain: string): Promise<{
    hasNameservers: boolean;
    hasWebsite: boolean;
  }> {
    try {
      // Use Google's DNS-over-HTTPS API which has CORS enabled
      const response = await fetch(
        `https://dns.google/resolve?name=${domain}&type=A`,
        { 
          headers: { 
            'Accept': 'application/dns-json',
            'User-Agent': 'Mozilla/5.0 (compatible; DomainAnalyzer/1.0)'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`DNS API returned ${response.status}`);
      }

      const data = await response.json();
      return {
        hasNameservers: data.Answer?.length > 0 || false,
        hasWebsite: data.Answer?.some((record: any) => record.type === 1) || false
      };
    } catch (error) {
      console.warn('DNS check failed:', error);
      return { hasNameservers: false, hasWebsite: false };
    }
  }

  private calculateTrafficScore(metrics: {
    recentSnapshots: number;
    totalSnapshots: number;
    hasWebsite: boolean;
    lastSeen: Date | null;
  }): number {
    let score = 0;

    // Recent activity (max 40 points)
    score += Math.min(metrics.recentSnapshots * 40, 40);

    // Historical presence (max 40 points)
    score += Math.min(metrics.totalSnapshots * 40, 40);

    // Current status (max 20 points)
    if (metrics.hasWebsite) score += 10;
    if (metrics.lastSeen) {
      const monthsAgo = (new Date().getTime() - metrics.lastSeen.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsAgo <= 1) score += 10;
      else if (monthsAgo <= 3) score += 5;
      else if (monthsAgo <= 6) score += 2;
    }

    return Math.min(Math.round(score), 100);
  }

  private estimateTraffic(score: number): number {
    // Base traffic estimate on domain score
    if (score >= 90) return 15000 + Math.floor(Math.random() * 5000);
    if (score >= 80) return 10000 + Math.floor(Math.random() * 5000);
    if (score >= 70) return 5000 + Math.floor(Math.random() * 5000);
    if (score >= 60) return 2000 + Math.floor(Math.random() * 3000);
    if (score >= 50) return 1000 + Math.floor(Math.random() * 1000);
    if (score >= 40) return 500 + Math.floor(Math.random() * 500);
    if (score >= 30) return 200 + Math.floor(Math.random() * 300);
    if (score >= 20) return 50 + Math.floor(Math.random() * 150);
    if (score >= 10) return Math.floor(Math.random() * 50);
    return 0;
  }

  async analyzeDomain(domain: string): Promise<{
    traffic_score: number;
    estimated_traffic: number;
    archive_snapshots: number;
    last_checked: string;
    status: string;
  }> {
    try {
      this.emitProgress('start', 'Starting domain analysis...', 0);

      // Check DNS status
      this.emitProgress('dns', 'Checking domain status...', 25);
      const dnsStatus = await this.checkDNS(domain);
      
      // Check archive history
      this.emitProgress('archive', 'Checking archive history...', 50);
      const archiveData = await this.checkArchiveHistory(domain);

      this.emitProgress('scoring', 'Calculating traffic potential...', 75);

      // Calculate traffic score
      const trafficScore = this.calculateTrafficScore({
        recentSnapshots: archiveData.recentSnapshots,
        totalSnapshots: archiveData.snapshots,
        hasWebsite: dnsStatus.hasWebsite,
        lastSeen: archiveData.lastSeen
      });

      // Estimate traffic
      const estimatedTraffic = this.estimateTraffic(trafficScore);

      this.emitProgress('complete', 'Analysis complete', 100);

      return {
        traffic_score: trafficScore,
        estimated_traffic: estimatedTraffic,
        archive_snapshots: archiveData.snapshots,
        last_checked: new Date().toISOString(),
        status: dnsStatus.hasNameservers ? 'registered' : 'available'
      };
    } catch (error) {
      console.error('Domain analysis failed:', error);
      this.emitProgress('error', 'Analysis failed', 100);

      return {
        traffic_score: 0,
        estimated_traffic: 0,
        archive_snapshots: 0,
        last_checked: new Date().toISOString(),
        status: 'error'
      };
    }
  }
}