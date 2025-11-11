-- Enable pgvector extension for vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to transcripts table for semantic search
ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS embedding vector(384);

-- Create an index for faster similarity searches
CREATE INDEX IF NOT EXISTS transcripts_embedding_idx ON transcripts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Function to search transcripts by semantic similarity
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