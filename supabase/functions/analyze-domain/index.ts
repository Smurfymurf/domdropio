import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// ... [Previous DomainAnalyzer class code remains unchanged] ...

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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // First verify the domain exists
    const { data: existingDomain, error: checkError } = await supabase
      .from('domains')
      .select('id, domain')
      .eq('domain', domain)
      .single();

    if (checkError) {
      console.error('Failed to check domain:', checkError);
      throw new Error(`Failed to check domain: ${checkError.message}`);
    }

    if (!existingDomain) {
      return new Response(
        JSON.stringify({ error: 'Domain not found' }),
        { 
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Run the analysis
    const analyzer = new DomainAnalyzer();
    const analysis = await analyzer.analyzeDomain(domain);

    // Update the domain with analysis results
    const { data: updatedDomain, error: updateError } = await supabase
      .from('domains')
      .update({
        ...analysis,
        status: 'available',
        last_checked: new Date().toISOString()
      })
      .eq('id', existingDomain.id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update domain:', updateError);
      throw new Error(`Failed to update domain: ${updateError.message}`);
    }

    if (!updatedDomain) {
      throw new Error('Failed to retrieve updated domain data');
    }

    return new Response(
      JSON.stringify(updatedDomain),
      { 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Error:', error);
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
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