import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import cron from 'node-cron';
import { AdvancedTrafficDetector } from './trafficDetector.js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const DOMAINS_MONITOR_TOKEN = process.env.DOMAINS_MONITOR_TOKEN;

async function fetchRemovedDomains() {
  try {
    const response = await axios.get(
      `https://domains-monitor.com/api/v1/${DOMAINS_MONITOR_TOKEN}/dailyremove/json/`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching removed domains:', error);
    return [];
  }
}

async function analyzeDomain(domain) {
  const detector = new AdvancedTrafficDetector();
  return detector.calculate_comprehensive_traffic_score(domain);
}

async function updateDatabase() {
  console.log('Starting database update...', new Date().toISOString());
  
  // Fetch new removed domains
  const removedDomains = await fetchRemovedDomains();
  
  for (const domain of removedDomains) {
    try {
      // Check if domain already exists
      const { data: existing } = await supabase
        .from('domains')
        .select('id')
        .eq('domain', domain)
        .single();
      
      if (existing) {
        console.log(`Domain ${domain} already exists, skipping...`);
        continue;
      }
      
      // Analyze domain
      const analysis = await analyzeDomain(domain);
      
      // Insert into database
      const { error } = await supabase.from('domains').insert({
        domain,
        status: 'available',
        traffic_score: analysis.traffic_score,
        estimated_traffic: analysis.estimated_traffic,
        archive_snapshots: analysis.archive_snapshots,
        indexed_pages: analysis.indexed_pages,
        social_mentions: analysis.social_mentions,
        web_presence: analysis.web_presence,
        mail_score: analysis.mail_score,
        has_redirect: analysis.has_redirect,
        redirect_url: analysis.redirect_url,
        is_parked: analysis.is_parked,
        last_checked: new Date().toISOString()
      });
      
      if (error) {
        console.error(`Error inserting domain ${domain}:`, error);
      } else {
        console.log(`Successfully added domain: ${domain}`);
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error processing domain ${domain}:`, error);
    }
  }
  
  console.log('Database update completed', new Date().toISOString());
}

// Run every 13 hours
cron.schedule('0 */13 * * *', updateDatabase);

// Run immediately on start
updateDatabase();