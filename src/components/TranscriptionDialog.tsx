import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useWhisperTranscription } from "@/hooks/useWhisperTranscription";
import { useTextEmbeddings } from "@/hooks/useTextEmbeddings";
import { generateSRT, generateVTT, downloadSubtitle, textToSegments } from "@/utils/subtitleFormatter";
import { supabase } from "@/integrations/supabase/client";
import { FileAudio, Download, Database, Loader2 } from "lucide-react";

interface TranscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  sourceUrl: string;
  fileName: string;
}

export const TranscriptionDialog = ({
  open,
  onOpenChange,
  jobId,
  sourceUrl,
  fileName,
}: TranscriptionDialogProps) => {
  const [transcriptText, setTranscriptText] = useState("");
  const [segments, setSegments] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const { transcribe, isLoading: isTranscribing, progress } = useWhisperTranscription();
  const { generateSingleEmbedding, isLoading: isGeneratingEmbedding } = useTextEmbeddings();
  const { toast } = useToast();

  const handleTranscribe = async () => {
    try {
      const result = await transcribe(sourceUrl);
      setTranscriptText(result.text);
      setSegments(result.segments.length > 0 ? result.segments : textToSegments(result.text));
      
      toast({
        title: "Transcription ready",
        description: "You can now download subtitles or save to database",
      });
    } catch (error) {
      console.error("Transcription failed:", error);
    }
  };

  const handleSaveToDatabase = async () => {
    if (!transcriptText.trim()) {
      toast({
        title: "No transcript",
        description: "Please generate a transcript first",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Generate embedding for semantic search
      const embedding = await generateSingleEmbedding(transcriptText);

      // Save transcript with embedding
      const { error } = await supabase.from("transcripts").insert({
        job_id: jobId,
        content: transcriptText,
        language: "en",
        format: "vtt",
        embedding: JSON.stringify(embedding),
      });

      if (error) throw error;

      toast({
        title: "Saved successfully",
        description: "Transcript and embeddings saved to database",
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save transcript",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadSRT = () => {
    if (segments.length === 0) {
      toast({
        title: "No segments",
        description: "Transcript must have time segments for SRT export",
        variant: "destructive",
      });
      return;
    }

    const srt = generateSRT(segments);
    downloadSubtitle(srt, fileName, "srt");
    
    toast({
      title: "Downloaded",
      description: "SRT subtitle file downloaded",
    });
  };

  const handleDownloadVTT = () => {
    if (segments.length === 0) {
      toast({
        title: "No segments",
        description: "Transcript must have time segments for VTT export",
        variant: "destructive",
      });
      return;
    }

    const vtt = generateVTT(segments);
    downloadSubtitle(vtt, fileName, "vtt");
    
    toast({
      title: "Downloaded",
      description: "WebVTT subtitle file downloaded",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Transcription & Subtitling</DialogTitle>
          <DialogDescription>
            Generate transcripts and subtitles using browser-based Whisper AI (no API costs)
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="transcribe" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="transcribe">Transcribe</TabsTrigger>
            <TabsTrigger value="subtitles" disabled={!transcriptText}>
              Subtitles
            </TabsTrigger>
            <TabsTrigger value="vectorize" disabled={!transcriptText}>
              Vectorize
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transcribe" className="space-y-4">
            <div className="space-y-4">
              {!transcriptText ? (
                <div className="text-center py-8 space-y-4">
                  <FileAudio className="w-16 h-16 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Click the button below to start transcription
                  </p>
                  <p className="text-xs text-muted-foreground">
                    First-time use will download ~40MB model (cached for future use)
                  </p>
                  <Button
                    onClick={handleTranscribe}
                    disabled={isTranscribing}
                    size="lg"
                  >
                    {isTranscribing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Transcribing...
                      </>
                    ) : (
                      <>
                        <FileAudio className="w-4 h-4 mr-2" />
                        Start Transcription
                      </>
                    )}
                  </Button>
                  {isTranscribing && (
                    <div className="space-y-2">
                      <Progress value={progress} />
                      <p className="text-xs text-muted-foreground">
                        {progress < 30 ? "Loading model..." : "Processing audio..."}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <Label>Transcript</Label>
                  <Textarea
                    value={transcriptText}
                    onChange={(e) => setTranscriptText(e.target.value)}
                    rows={12}
                    placeholder="Transcript will appear here..."
                    className="font-mono text-sm"
                  />
                  <Button onClick={handleTranscribe} variant="outline" size="sm">
                    Regenerate Transcript
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="subtitles" className="space-y-4">
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">Export your transcript as subtitle files:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>SRT format - Compatible with most video players</li>
                  <li>WebVTT format - Web standard for HTML5 video</li>
                </ul>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleDownloadSRT} variant="outline" className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Download SRT
                </Button>
                <Button onClick={handleDownloadVTT} variant="outline" className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Download WebVTT
                </Button>
              </div>

              <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
                <p className="text-xs font-mono text-muted-foreground mb-2">Preview:</p>
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {segments.length > 0 ? generateVTT(segments.slice(0, 5)) : "No segments available"}
                </pre>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="vectorize" className="space-y-4">
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">Generate embeddings for semantic search:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Creates vector representation of transcript</li>
                  <li>Enables semantic search across all transcripts</li>
                  <li>Stored in database with job reference</li>
                  <li>Uses browser-based embedding model (no API costs)</li>
                </ul>
              </div>

              <Button
                onClick={handleSaveToDatabase}
                disabled={isSaving || isGeneratingEmbedding}
                className="w-full"
              >
                {isSaving || isGeneratingEmbedding ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isGeneratingEmbedding ? "Generating embeddings..." : "Saving..."}
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4 mr-2" />
                    Save to Database with Embeddings
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
