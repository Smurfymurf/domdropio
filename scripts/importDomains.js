import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import { parse } from 'csv-parse';
import { AdvancedTrafficDetector } from './trafficDetector.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const detector = new AdvancedTrafficDetector();

async function importDomains(csvPath) {
  const parser = fs.createReadStream(csvPath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true
    })
  );

  for await (const record of parser) {
    try {
      const domain = record.domain;
      console.log(`Processing domain: ${domain}`);

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
      const analysis = await detector.calculate_comprehensive_traffic_score(domain);

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
        console.log(`Successfully imported domain: ${domain}`);
      }

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error processing record:`, error);
    }
  }
}

// Sample CSV file path
const csvPath = './domains.csv';

// Run the import
importDomains(csvPath).then(() => {
  console.log('Import completed');
  process.exit(0);
}).catch(error => {
  console.error('Import failed:', error);
  process.exit(1);
});