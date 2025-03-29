import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    const { domain } = await req.json();

    if (!domain) {
      return new Response(
        JSON.stringify({ error: 'Domain is required' }),
        { 
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    const checkUrl = async (url: string): Promise<boolean> => {
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        return response.ok;
      } catch {
        return false;
      }
    };

    const [hasSSL, hasWWW, hasRobotsTxt, hasSitemap] = await Promise.all([
      checkUrl(`https://${domain}`),
      checkUrl(`https://www.${domain}`),
      checkUrl(`https://${domain}/robots.txt`),
      checkUrl(`https://${domain}/sitemap.xml`)
    ]);

    return new Response(
      JSON.stringify({ hasSSL, hasWWW, hasRobotsTxt, hasSitemap }),
      { 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Error in domain-features-proxy function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        hasSSL: false,
        hasWWW: false,
        hasRobotsTxt: false,
        hasSitemap: false
      }),
      { 
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});