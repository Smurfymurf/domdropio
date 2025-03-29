import { corsHeaders } from '../_shared/cors.ts';

async function checkSocialPresence(domain: string) {
  const results = {
    twitter: 0,
    facebook: 0,
    linkedin: 0
  };

  try {
    // Check Twitter
    const twitterResponse = await fetch(
      `https://api.twitter.com/2/tweets/search/recent?query=url:${domain}`,
      {
        headers: {
          'Authorization': `Bearer ${Deno.env.get('TWITTER_BEARER_TOKEN')}`
        }
      }
    );
    
    if (twitterResponse.ok) {
      const twitterData = await twitterResponse.json();
      results.twitter = twitterData.meta?.result_count || 0;
    }
  } catch (error) {
    console.error('Twitter check failed:', error);
  }

  try {
    // Check Facebook using their oEmbed API
    const fbResponse = await fetch(
      `https://graph.facebook.com/v18.0/oembed_page?url=https://${domain}&access_token=${Deno.env.get('FACEBOOK_ACCESS_TOKEN')}`
    );
    
    if (fbResponse.ok) {
      results.facebook = 1;
    }
  } catch (error) {
    console.error('Facebook check failed:', error);
  }

  try {
    // Check LinkedIn using their oEmbed API
    const linkedinResponse = await fetch(
      `https://api.linkedin.com/v2/shares?q=domain&domain=${domain}`,
      {
        headers: {
          'Authorization': `Bearer ${Deno.env.get('LINKEDIN_ACCESS_TOKEN')}`
        }
      }
    );
    
    if (linkedinResponse.ok) {
      const linkedinData = await linkedinResponse.json();
      results.linkedin = linkedinData.total || 0;
    }
  } catch (error) {
    console.error('LinkedIn check failed:', error);
  }

  return results;
}

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

    const results = await checkSocialPresence(domain);
    const totalMentions = Object.values(results).reduce((a, b) => a + b, 0);

    return new Response(
      JSON.stringify({ mentions: totalMentions, details: results }),
      { 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Error in social-proxy function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', mentions: 0, details: { twitter: 0, facebook: 0, linkedin: 0 } }),
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