import { useState, useCallback } from "react";
import { pipeline } from "@huggingface/transformers";
import { useToast } from "@/hooks/use-toast";

export const useTextEmbeddings = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [embedder, setEmbedder] = useState<any>(null);
  const { toast } = useToast();

  const initializeEmbedder = useCallback(async () => {
    if (embedder) return embedder;

    try {
      toast({
        title: "Loading embedding model",
        description: "Downloading text embedding model...",
      });

      const pipe = await pipeline(
        "feature-extraction",
        "mixedbread-ai/mxbai-embed-xsmall-v1",
        {
          device: "webgpu",
          dtype: "fp32",
        }
      );

      setEmbedder(pipe);
      
      toast({
        title: "Model loaded",
        description: "Text embedding is ready!",
      });

      return pipe;
    } catch (error) {
      console.error("Failed to initialize embedder:", error);
      
      // Fallback to CPU
      try {
        const pipe = await pipeline(
          "feature-extraction",
          "mixedbread-ai/mxbai-embed-xsmall-v1"
        );
        setEmbedder(pipe);
        
        toast({
          title: "Model loaded (CPU mode)",
          description: "Text embedding is ready using CPU.",
        });
        
        return pipe;
      } catch (cpuError) {
        toast({
          title: "Failed to load model",
          description: "Could not initialize text embedding",
          variant: "destructive",
        });
        throw cpuError;
      }
    }
  }, [embedder, toast]);

  const generateEmbeddings = useCallback(
    async (texts: string[]): Promise<number[][]> => {
      setIsLoading(true);

      try {
        const pipe = await initializeEmbedder();

        const result = await pipe(texts, {
          pooling: "mean",
          normalize: true,
        });

        // Convert to array format
        const embeddings = result.tolist();

        return embeddings;
      } catch (error) {
        console.error("Embedding generation error:", error);
        toast({
          title: "Embedding generation failed",
          description: error instanceof Error ? error.message : "An error occurred",
          variant: "destructive",
        });
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [initializeEmbedder, toast]
  );

  const generateSingleEmbedding = useCallback(
    async (text: string): Promise<number[]> => {
      const embeddings = await generateEmbeddings([text]);
      return embeddings[0];
    },
    [generateEmbeddings]
  );

  return {
    generateEmbeddings,
    generateSingleEmbedding,
    isLoading,
    isModelLoaded: !!embedder,
  };
};
