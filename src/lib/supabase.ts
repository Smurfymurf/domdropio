import { createClient } from '@supabase/supabase-js';
import { HybridAnalyzer } from './quickAnalyzer';
import type { Database } from '../types/supabase';
import type { AnalysisProgress } from '../types/analyzer';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
    },
  },
  db: {
    schema: 'public',
  }
});

export const checkConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('domains')
      .select('id')
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error('Database connection error:', error.message);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Failed to connect to Supabase:', err);
    return false;
  }
};

const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (error.message?.includes('timeout') || error.message?.includes('57014')) {
        throw new Error('Operation timed out. Please try again.');
      }
      
      if (attempt === maxRetries) break;
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw lastError;
};

export const analyzeDomain = async (domain: string, onProgress?: (progress: AnalysisProgress) => void) => {
  console.log(`[analyzeDomain] Starting analysis for ${domain}`);
  try {
    if (onProgress) {
      onProgress({ step: 'start', message: 'Checking domain status...', progress: 25 });
    }

    // First check if domain exists and get its ID
    const { data: domains, error: checkError } = await retryOperation(async () => {
      console.log(`[analyzeDomain] Checking if domain exists: ${domain}`);
      const result = await supabase
        .from('domains')
        .select('id, domain, status')
        .eq('domain', domain)
        .limit(1);
      
      if (result.error) throw result.error;
      return result;
    });

    if (checkError) {
      console.error('[analyzeDomain] Failed to check domain:', checkError);
      throw new Error(`Failed to check domain: ${checkError.message}`);
    }

    if (!domains || domains.length === 0) {
      console.error(`[analyzeDomain] Domain ${domain} not found in database`);
      throw new Error(`Domain ${domain} not found in database`);
    }

    const existingDomain = domains[0];
    console.log(`[analyzeDomain] Found existing domain:`, existingDomain);

    if (onProgress) {
      onProgress({ step: 'analyze', message: 'Analyzing domain...', progress: 50 });
    }

    // Run the hybrid analysis
    console.log(`[analyzeDomain] Starting hybrid analysis for ${domain}`);
    const analyzer = new HybridAnalyzer();
    const analysis = await analyzer.analyze(domain);
    console.log(`[analyzeDomain] Hybrid analysis complete:`, analysis);

    if (onProgress) {
      onProgress({ step: 'update', message: 'Updating database...', progress: 75 });
    }

    // Update domain with analysis results
    const { data: updatedDomain, error: updateError } = await retryOperation(async () => {
      console.log(`[analyzeDomain] Updating domain in database:`, analysis);
      
      // First update the domain
      const { error: updateError } = await supabase
        .from('domains')
        .update({
          status: analysis.status,
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
        })
        .eq('id', existingDomain.id);

      if (updateError) throw updateError;

      // Then fetch the updated domain
      const { data, error: fetchError } = await supabase
        .from('domains')
        .select('*')
        .eq('id', existingDomain.id)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error('Failed to fetch updated domain');

      return { data, error: null };
    });

    if (updateError || !updatedDomain) {
      console.error('[analyzeDomain] Failed to update domain with analysis:', updateError);
      throw new Error('Failed to update domain with analysis results');
    }

    if (onProgress) {
      onProgress({ step: 'complete', message: 'Analysis complete', progress: 100 });
    }

    console.log(`[analyzeDomain] Analysis complete for ${domain}:`, updatedDomain);
    return updatedDomain;
  } catch (error) {
    console.error('[analyzeDomain] Analysis request failed:', error);
    throw error instanceof Error ? error : new Error('Failed to analyze domain');
  }
};