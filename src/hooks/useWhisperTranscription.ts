import { useState, useCallback } from "react";
import { pipeline } from "@huggingface/transformers";
import { useToast } from "@/hooks/use-toast";

interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

interface TranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
}

export const useWhisperTranscription = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [transcriber, setTranscriber] = useState<any>(null);
  const { toast } = useToast();

  const initializeTranscriber = useCallback(async () => {
    if (transcriber) return transcriber;

    try {
      setProgress(10);
      toast({
        title: "Loading Whisper model",
        description: "Downloading speech recognition model... This may take a minute on first use.",
      });

      const pipe = await pipeline(
        "automatic-speech-recognition",
        "onnx-community/whisper-tiny.en",
        {
          device: "webgpu",
          dtype: "fp32",
        }
      );

      setTranscriber(pipe);
      setProgress(100);
      
      toast({
        title: "Model loaded",
        description: "Speech recognition is ready!",
      });

      return pipe;
    } catch (error) {
      console.error("Failed to initialize transcriber:", error);
      
      // Fallback to CPU if WebGPU fails
      try {
        const pipe = await pipeline(
          "automatic-speech-recognition",
          "onnx-community/whisper-tiny.en"
        );
        setTranscriber(pipe);
        setProgress(100);
        
        toast({
          title: "Model loaded (CPU mode)",
          description: "Speech recognition is ready using CPU.",
        });
        
        return pipe;
      } catch (cpuError) {
        toast({
          title: "Failed to load model",
          description: "Could not initialize speech recognition",
          variant: "destructive",
        });
        throw cpuError;
      }
    }
  }, [transcriber, toast]);

  const transcribe = useCallback(
    async (audioSource: string | File | Blob): Promise<TranscriptionResult> => {
      setIsLoading(true);
      setProgress(0);

      try {
        const pipe = await initializeTranscriber();

        setProgress(30);
        toast({
          title: "Transcribing audio",
          description: "Processing audio with Whisper...",
        });

        const result = await pipe(audioSource, {
          return_timestamps: "word",
          chunk_length_s: 30,
        });

        setProgress(100);

        // Format the result with segments
        const segments: TranscriptionSegment[] = [];
        if (result.chunks && Array.isArray(result.chunks)) {
          for (const chunk of result.chunks) {
            segments.push({
              start: chunk.timestamp[0] || 0,
              end: chunk.timestamp[1] || 0,
              text: chunk.text.trim(),
            });
          }
        }

        toast({
          title: "Transcription complete",
          description: "Audio has been transcribed successfully",
        });

        return {
          text: result.text,
          segments,
        };
      } catch (error) {
        console.error("Transcription error:", error);
        toast({
          title: "Transcription failed",
          description: error instanceof Error ? error.message : "An error occurred",
          variant: "destructive",
        });
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [initializeTranscriber, toast]
  );

  return {
    transcribe,
    isLoading,
    progress,
    isModelLoaded: !!transcriber,
  };
};
