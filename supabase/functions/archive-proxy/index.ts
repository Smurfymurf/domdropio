import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
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

    const archiveUrl = `https://web.archive.org/cdx/search/cdx?url=${domain}&output=json&fl=timestamp&filter=statuscode:200&collapse=timestamp:8`;

    try {
      const response = await fetch(archiveUrl);
      
      if (!response.ok) {
        throw new Error(`Archive.org API returned ${response.status}`);
      }

      const data = await response.json();

      return new Response(
        JSON.stringify(data),
        { 
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      console.error('Error fetching from archive.org:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch archive data' }),
        { 
          status: 502,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }
  } catch (error) {
    console.error('Error in archive-proxy function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
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