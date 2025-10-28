-- Create storage buckets for video files
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('source-videos', 'source-videos', false),
  ('transcoded-videos', 'transcoded-videos', true);

-- Create enum for job status
CREATE TYPE job_status AS ENUM ('queued', 'processing', 'completed', 'failed', 'paused');

-- Create enum for output format
CREATE TYPE output_format AS ENUM ('HLS', 'DASH');

-- Create transcoding_jobs table
CREATE TABLE public.transcoding_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  status job_status NOT NULL DEFAULT 'queued',
  format output_format NOT NULL,
  progress INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Create transcoded_outputs table
CREATE TABLE public.transcoded_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.transcoding_jobs(id) ON DELETE CASCADE NOT NULL,
  manifest_url TEXT NOT NULL,
  quality_variant TEXT NOT NULL,
  bitrate INTEGER,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create transcripts table
CREATE TABLE public.transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.transcoding_jobs(id) ON DELETE CASCADE NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  format TEXT NOT NULL DEFAULT 'vtt',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transcoding_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcoded_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for transcoding_jobs
CREATE POLICY "Users can view their own jobs"
  ON public.transcoding_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own jobs"
  ON public.transcoding_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs"
  ON public.transcoding_jobs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own jobs"
  ON public.transcoding_jobs FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for transcoded_outputs
CREATE POLICY "Users can view outputs for their jobs"
  ON public.transcoded_outputs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.transcoding_jobs
    WHERE transcoding_jobs.id = transcoded_outputs.job_id
    AND transcoding_jobs.user_id = auth.uid()
  ));

CREATE POLICY "Users can create outputs for their jobs"
  ON public.transcoded_outputs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.transcoding_jobs
    WHERE transcoding_jobs.id = transcoded_outputs.job_id
    AND transcoding_jobs.user_id = auth.uid()
  ));

-- RLS Policies for transcripts
CREATE POLICY "Users can view transcripts for their jobs"
  ON public.transcripts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.transcoding_jobs
    WHERE transcoding_jobs.id = transcripts.job_id
    AND transcoding_jobs.user_id = auth.uid()
  ));

CREATE POLICY "Users can create transcripts for their jobs"
  ON public.transcripts FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.transcoding_jobs
    WHERE transcoding_jobs.id = transcripts.job_id
    AND transcoding_jobs.user_id = auth.uid()
  ));

-- Storage policies for source-videos bucket
CREATE POLICY "Users can upload their own source videos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'source-videos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own source videos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'source-videos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own source videos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'source-videos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for transcoded-videos bucket (public read)
CREATE POLICY "Anyone can view transcoded videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'transcoded-videos');

CREATE POLICY "Users can upload their own transcoded videos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'transcoded-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for transcoding_jobs
CREATE TRIGGER update_transcoding_jobs_updated_at
  BEFORE UPDATE ON public.transcoding_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for job updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.transcoding_jobs;