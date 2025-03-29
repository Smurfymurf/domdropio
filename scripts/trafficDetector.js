import axios from 'axios';
import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);

export class AdvancedTrafficDetector {
  constructor() {
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
    ];
  }

  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  async checkArchiveFrequency(domain) {
    try {
      const response = await axios.get(
        `https://web.archive.org/cdx/search/cdx?url=${domain}&output=json&fl=timestamp`
      );

      if (response.status === 200) {
        const data = response.data;
        
        if (!data || data.length <= 1) return [0, 0];
        
        // Remove header row
        const snapshots = data.slice(1);
        
        // Convert timestamps to dates
        const timestamps = snapshots.map(snap => {
          const year = snap[0].substring(0, 4);
          const month = snap[0].substring(4, 6);
          const day = snap[0].substring(6, 8);
          return new Date(year, month - 1, day);
        });
        
        // Count snapshots in the last year
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        
        const recentSnapshots = timestamps.filter(ts => ts > oneYearAgo).length;
        const frequency = recentSnapshots / 12;
        
        return [recentSnapshots, frequency];
      }
      
      return [0, 0];
    } catch (error) {
      console.error(`Error checking archive frequency for ${domain}:`, error);
      return [0, 0];
    }
  }

  async checkIndexingStatus(domain) {
    try {
      const response = await axios.get(
        `https://www.google.com/search?q=site:${domain}`,
        {
          headers: { 'User-Agent': this.getRandomUserAgent() }
        }
      );

      if (response.status === 200) {
        const content = response.data;
        
        if (content.includes('did not match any documents')) {
          return 0;
        }
        
        const match = content.match(/About ([0-9,]+) results/);
        if (match) {
          return parseInt(match[1].replace(/,/g, ''), 10);
        }
        
        // Rough estimation if exact count not found
        return content.includes('result') ? 1 : 0;
      }
      
      return 0;
    } catch (error) {
      console.error(`Error checking indexing status for ${domain}:`, error);
      return 0;
    }
  }

  async checkDnsMailConfiguration(domain) {
    try {
      let mailScore = 0;
      
      // Check MX records
      try {
        const mxRecords = await resolveMx(domain);
        mailScore += mxRecords.length * 2;
      } catch (e) {}
      
      // Check SPF and DMARC
      try {
        const txtRecords = await resolveTxt(domain);
        const spfRecords = txtRecords.filter(record => 
          record.some(txt => txt.toLowerCase().includes('spf'))
        );
        mailScore += spfRecords.length * 1.5;
        
        const dmarcRecords = await resolveTxt(`_dmarc.${domain}`);
        mailScore += dmarcRecords.length * 1.5;
      } catch (e) {}
      
      return mailScore;
    } catch (error) {
      console.error(`Error checking mail configuration for ${domain}:`, error);
      return 0;
    }
  }

  async checkForActiveRedirects(domain) {
    try {
      const response = await axios.get(`http://${domain}`, {
        headers: { 'User-Agent': this.getRandomUserAgent() },
        maxRedirects: 5,
        timeout: 5000
      });
      
      const redirects = response.request._redirectable._redirectCount;
      const finalUrl = response.request.res.responseUrl;
      
      if (redirects > 0 && !finalUrl.includes(domain)) {
        return [true, finalUrl];
      }
      
      return [false, null];
    } catch (error) {
      return [false, null];
    }
  }

  async checkForParkedDomainSigns(domain) {
    try {
      const response = await axios.get(`http://${domain}`, {
        headers: { 'User-Agent': this.getRandomUserAgent() },
        timeout: 5000
      });
      
      if (response.status === 200) {
        const content = response.data.toLowerCase();
        
        const parkingSigns = [
          'domain is for sale',
          'buy this domain',
          'domain parking',
          'domain registered',
          'domain owner',
          'domain expired',
          'parkingcrew',
          'sedoparking',
          'hugedomains',
          'undeveloped.com'
        ];
        
        return parkingSigns.some(sign => content.includes(sign));
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  async calculate_comprehensive_traffic_score(domain) {
    const results = {};
    
    // Run all checks in parallel
    const [
      [archiveSnapshots, archiveFrequency],
      indexedPages,
      mailScore,
      [hasRedirect, redirectUrl],
      isParked
    ] = await Promise.all([
      this.checkArchiveFrequency(domain),
      this.checkIndexingStatus(domain),
      this.checkDnsMailConfiguration(domain),
      this.checkForActiveRedirects(domain),
      this.checkForParkedDomainSigns(domain)
    ]);
    
    // Store results
    results.archive_snapshots = archiveSnapshots;
    results.archive_frequency = archiveFrequency;
    results.indexed_pages = indexedPages;
    results.mail_score = mailScore;
    results.has_redirect = hasRedirect;
    results.redirect_url = redirectUrl;
    results.is_parked = isParked;
    
    // Calculate scores
    let finalScore = 0;
    
    // Archive signals (max 25 points)
    const archiveScore = Math.min(archiveSnapshots * 1.5, 15) + 
                        Math.min(archiveFrequency * 5, 10);
    finalScore += archiveScore;
    
    // Indexing signals (max 30 points)
    const indexingScore = Math.min(indexedPages * 0.5, 30);
    finalScore += indexingScore;
    
    // Mail configuration signals (max 25 points)
    const mailConfigScore = Math.min(mailScore * 2, 25);
    finalScore += mailConfigScore;
    
    // Redirect signals (max 10 points)
    const redirectScore = hasRedirect ? 10 : 0;
    finalScore += redirectScore;
    
    // Parked domain signals (max 10 points)
    const parkedScore = isParked ? 10 : 0;
    finalScore += parkedScore;
    
    // Normalize to 0-100
    finalScore = Math.min(finalScore, 100);
    results.traffic_score = finalScore;
    
    // Estimate traffic based on score
    let estimatedTraffic;
    if (finalScore > 80) {
      estimatedTraffic = Math.floor(Math.random() * 15000) + 5000;
    } else if (finalScore > 60) {
      estimatedTraffic = Math.floor(Math.random() * 4000) + 1000;
    } else if (finalScore > 40) {
      estimatedTraffic = Math.floor(Math.random() * 900) + 100;
    } else if (finalScore > 20) {
      estimatedTraffic = Math.floor(Math.random() * 90) + 10;
    } else {
      estimatedTraffic = Math.floor(Math.random() * 10);
    }
    
    results.estimated_traffic = estimatedTraffic;
    results.has_traffic = finalScore > 10;
    
    return results;
  }
}