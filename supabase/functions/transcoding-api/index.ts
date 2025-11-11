import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TranscodingJobRequest {
  source_url: string
  file_name: string
  format: 'HLS' | 'DASH'
  qualities?: string[]
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const path = url.pathname.split('/').filter(Boolean).pop()

    // POST /transcoding-api/submit - Submit new job
    if (req.method === 'POST' && path === 'submit') {
      const body: TranscodingJobRequest = await req.json()

      const { data, error } = await supabaseClient
        .from('transcoding_jobs')
        .insert({
          user_id: user.id,
          file_name: body.file_name,
          source_url: body.source_url,
          format: body.format,
          status: 'queued',
          progress: 0,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating job:', error)
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          job_id: data.id,
          status: data.status,
          created_at: data.created_at,
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET /transcoding-api/status/:job_id - Get job status
    if (req.method === 'GET' && path === 'status') {
      const jobId = url.searchParams.get('job_id')
      if (!jobId) {
        return new Response(
          JSON.stringify({ error: 'job_id parameter required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data, error } = await supabaseClient
        .from('transcoding_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', user.id)
        .single()

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: 'Job not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify(data),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET /transcoding-api/jobs - List all jobs
    if (req.method === 'GET' && path === 'jobs') {
      const limit = parseInt(url.searchParams.get('limit') || '50')
      const offset = parseInt(url.searchParams.get('offset') || '0')

      const { data, error, count } = await supabaseClient
        .from('transcoding_jobs')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ jobs: data, total: count }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET /transcoding-api/outputs/:job_id - Get transcoded outputs
    if (req.method === 'GET' && path === 'outputs') {
      const jobId = url.searchParams.get('job_id')
      if (!jobId) {
        return new Response(
          JSON.stringify({ error: 'job_id parameter required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Verify job belongs to user
      const { data: job } = await supabaseClient
        .from('transcoding_jobs')
        .select('id')
        .eq('id', jobId)
        .eq('user_id', user.id)
        .single()

      if (!job) {
        return new Response(
          JSON.stringify({ error: 'Job not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: outputs, error } = await supabaseClient
        .from('transcoded_outputs')
        .select('*')
        .eq('job_id', jobId)

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ outputs }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE /transcoding-api/delete/:job_id - Delete job
    if (req.method === 'DELETE' && path === 'delete') {
      const jobId = url.searchParams.get('job_id')
      if (!jobId) {
        return new Response(
          JSON.stringify({ error: 'job_id parameter required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { error } = await supabaseClient
        .from('transcoding_jobs')
        .delete()
        .eq('id', jobId)
        .eq('user_id', user.id)

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ message: 'Job deleted successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE /transcoding-api/bulk-delete - Delete multiple jobs
    if (req.method === 'DELETE' && path === 'bulk-delete') {
      const body: { job_ids: string[] } = await req.json()
      
      if (!body.job_ids || !Array.isArray(body.job_ids) || body.job_ids.length === 0) {
        return new Response(
          JSON.stringify({ error: 'job_ids array required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { error } = await supabaseClient
        .from('transcoding_jobs')
        .delete()
        .in('id', body.job_ids)
        .eq('user_id', user.id)

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ 
          message: `${body.job_ids.length} job(s) deleted successfully`,
          deleted_count: body.job_ids.length 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST /transcoding-api/bulk-download - Get download info for multiple jobs
    if (req.method === 'POST' && path === 'bulk-download') {
      const body: { job_ids: string[] } = await req.json()
      
      if (!body.job_ids || !Array.isArray(body.job_ids) || body.job_ids.length === 0) {
        return new Response(
          JSON.stringify({ error: 'job_ids array required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Verify all jobs belong to user
      const { data: jobs, error: jobsError } = await supabaseClient
        .from('transcoding_jobs')
        .select('id, file_name, format, status')
        .in('id', body.job_ids)
        .eq('user_id', user.id)

      if (jobsError) {
        return new Response(
          JSON.stringify({ error: jobsError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get outputs for all jobs
      const downloadData = []
      for (const job of jobs || []) {
        const { data: outputs } = await supabaseClient
          .from('transcoded_outputs')
          .select('*')
          .eq('job_id', job.id)

        if (outputs && outputs.length > 0) {
          downloadData.push({
            job_id: job.id,
            file_name: job.file_name,
            format: job.format,
            status: job.status,
            outputs: outputs
          })
        }
      }

      return new Response(
        JSON.stringify({ 
          jobs: downloadData,
          total_jobs: downloadData.length
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Endpoint not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
