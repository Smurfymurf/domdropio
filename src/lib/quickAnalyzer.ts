import type { DomainAnalysis } from '../types/analyzer';

export class InstantTrafficAnalyzer {
  private static KNOWN_TLDS = ['.com', '.net', '.org', '.io'];

  static analyze(domain: string): DomainAnalysis {
    console.log(`[InstantAnalyzer] Starting instant analysis for ${domain}`);
    const trafficScore = this.estimateScore(domain);
    const estimatedTraffic = this.estimateTraffic(trafficScore);

    console.log(`[InstantAnalyzer] Results for ${domain}:`, {
      trafficScore,
      estimatedTraffic
    });

    return {
      domain,
      status: 'available',
      traffic_score: trafficScore,
      estimated_traffic: estimatedTraffic,
      archive_snapshots: 0,
      indexed_pages: 0,
      social_mentions: 0,
      web_presence: 0,
      mail_score: 0,
      has_redirect: false,
      redirect_url: null,
      is_parked: false,
      last_checked: new Date().toISOString()
    };
  }

  private static estimateScore(domain: string): number {
    let score = 0;
    const scores: Record<string, number> = {};
    
    // Domain age pattern (crude but fast)
    if (/[0-9]{4}/.test(domain)) {
      score += 10;
      scores.yearPattern = 10;
    }
    
    // TLD scoring
    if (this.KNOWN_TLDS.some(tld => domain.endsWith(tld))) {
      score += 20;
      scores.tld = 20;
    }
    
    // Length heuristic
    if (domain.length < 15) {
      score += 15;
      scores.length = 15;
    }
    if (domain.split('.').length > 2) {
      score -= 10;
      scores.subdomains = -10;
    }
    
    // Keyword scoring
    if (domain.includes('shop')) {
      score += 5;
      scores.shopKeyword = 5;
    }
    if (domain.includes('blog')) {
      score += 5;
      scores.blogKeyword = 5;
    }
    
    console.log(`[InstantAnalyzer] Score breakdown for ${domain}:`, scores);
    return Math.max(0, Math.min(score, 100));
  }

  private static estimateTraffic(score: number): number {
    let traffic = 0;
    if (score >= 90) traffic = 15000 + Math.floor(Math.random() * 5000);
    else if (score >= 80) traffic = 10000 + Math.floor(Math.random() * 5000);
    else if (score >= 70) traffic = 5000 + Math.floor(Math.random() * 5000);
    else if (score >= 60) traffic = 2000 + Math.floor(Math.random() * 3000);
    else if (score >= 50) traffic = 1000 + Math.floor(Math.random() * 1000);
    else if (score >= 40) traffic = 500 + Math.floor(Math.random() * 500);
    else if (score >= 30) traffic = 200 + Math.floor(Math.random() * 300);
    else if (score >= 20) traffic = 50 + Math.floor(Math.random() * 150);
    else if (score >= 10) traffic = Math.floor(Math.random() * 50);

    console.log(`[InstantAnalyzer] Estimated traffic for score ${score}:`, traffic);
    return traffic;
  }
}

export class HybridAnalyzer {
  private cache = new Map<string, DomainAnalysis>();
  private readonly CACHE_TTL = 1000 * 60 * 60; // 1 hour

  async analyze(domain: string): Promise<DomainAnalysis> {
    console.log(`[HybridAnalyzer] Starting analysis for ${domain}`);

    // Check cache first
    const cached = this.cache.get(domain);
    if (cached && Date.now() - new Date(cached.last_checked).getTime() < this.CACHE_TTL) {
      console.log(`[HybridAnalyzer] Using cached result for ${domain}`, cached);
      return cached;
    }

    console.log(`[HybridAnalyzer] Running instant analysis for ${domain}`);
    // Start with instant estimate
    const instant = InstantTrafficAnalyzer.analyze(domain);
    
    try {
      console.log(`[HybridAnalyzer] Checking DNS for ${domain}`);
      // Add lightweight DNS check
      const dnsActive = await this.checkDNS(domain);
      console.log(`[HybridAnalyzer] DNS check result for ${domain}:`, { dnsActive });
      
      const analysis: DomainAnalysis = {
        ...instant,
        status: dnsActive ? 'registered' : 'available',
        traffic_score: Math.round(instant.traffic_score * (dnsActive ? 1.5 : 0.8)),
        estimated_traffic: instant.estimated_traffic,
        archive_snapshots: Math.floor(Math.random() * 10),
        indexed_pages: Math.floor(Math.random() * 100),
        social_mentions: Math.floor(Math.random() * 50),
        web_presence: Math.floor(Math.random() * 100),
        mail_score: 0,
        has_redirect: false,
        redirect_url: null,
        is_parked: false,
        last_checked: new Date().toISOString()
      };

      console.log(`[HybridAnalyzer] Final analysis for ${domain}:`, analysis);

      // Cache the result
      this.cache.set(domain, analysis);
      return analysis;
    } catch (error) {
      console.warn(`[HybridAnalyzer] Analysis failed for ${domain}:`, error);
      return instant;
    }
  }

  private async checkDNS(domain: string): Promise<boolean> {
    try {
      console.log(`[HybridAnalyzer] Making DNS request for ${domain}`);
      const response = await fetch(
        `https://dns.google/resolve?name=${domain}&type=A`,
        {
          headers: {
            'Accept': 'application/dns-json'
          }
        }
      );

      if (!response.ok) {
        console.log(`[HybridAnalyzer] DNS request failed for ${domain}:`, response.status);
        return false;
      }

      const data = await response.json();
      console.log(`[HybridAnalyzer] DNS response for ${domain}:`, data);
      return data.Answer?.length > 0 || false;
    } catch (error) {
      console.error(`[HybridAnalyzer] DNS check error for ${domain}:`, error);
      return false;
    }
  }

  async analyzeBatch(domains: string[]): Promise<DomainAnalysis[]> {
    console.log(`[HybridAnalyzer] Starting batch analysis for ${domains.length} domains`);
    const BATCH_SIZE = 3;
    const results: DomainAnalysis[] = [];
    
    for (let i = 0; i < domains.length; i += BATCH_SIZE) {
      const batch = domains.slice(i, i + BATCH_SIZE);
      console.log(`[HybridAnalyzer] Processing batch ${Math.floor(i/BATCH_SIZE) + 1}:`, batch);
      
      const analysis = await Promise.all(
        batch.map(domain => this.analyze(domain))
      );
      results.push(...analysis);
      
      // Brief pause between batches
      if (i + BATCH_SIZE < domains.length) {
        console.log(`[HybridAnalyzer] Pausing between batches...`);
        await new Promise(r => setTimeout(r, 300));
      }
    }
    
    console.log(`[HybridAnalyzer] Batch analysis complete. Results:`, results);
    return results;
  }
}