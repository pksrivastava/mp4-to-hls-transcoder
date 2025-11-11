-- Fix search_path for the similarity search function
DROP FUNCTION IF EXISTS search_transcripts_by_similarity(vector, float, int);

CREATE OR REPLACE FUNCTION search_transcripts_by_similarity(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  job_id uuid,
  content text,
  language text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.job_id,
    t.content,
    t.language,
    1 - (t.embedding <=> query_embedding) as similarity
  FROM transcripts t
  WHERE t.embedding IS NOT NULL
    AND 1 - (t.embedding <=> query_embedding) > match_threshold
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;