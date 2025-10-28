import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Upload, Video, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useFFmpeg } from "@/hooks/useFFmpeg";
import { VideoPreview } from "@/components/VideoPreview";
import { useNavigate } from "react-router-dom";

const SubmitJobFunctional = () => {
  const [format, setFormat] = useState<"HLS" | "DASH">("HLS");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [isTranscoding, setIsTranscoding] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const { loaded, isLoading, load, transcodeToHLS, convertToMP4 } = useFFmpeg();
  const navigate = useNavigate();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a video file to transcode",
        variant: "destructive",
      });
      return;
    }

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to submit transcoding jobs",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsTranscoding(true);
      setProgress(0);

      // Load FFmpeg if not loaded
      if (!loaded) {
        toast({
          title: "Loading FFmpeg...",
          description: "This may take a moment on first use",
        });
        await load();
      }

      // Create job in database
      const { data: job, error: jobError } = await supabase
        .from("transcoding_jobs")
        .insert({
          user_id: user.id,
          file_name: selectedFile.name,
          source_url: "processing",
          format: format,
          status: "processing",
        })
        .select()
        .single();

      if (jobError) throw jobError;

      toast({
        title: "Transcoding started",
        description: "Your video is being transcoded...",
      });

      // First convert to optimized MP4
      const mp4Blob = await convertToMP4(selectedFile, (prog) => {
        setProgress(Math.round(prog * 0.5)); // First 50%
      });

      // Upload source to storage
      const sourcePath = `${user.id}/${job.id}/source.mp4`;
      const { error: uploadError } = await supabase.storage
        .from("source-videos")
        .upload(sourcePath, mp4Blob);

      if (uploadError) throw uploadError;

      // Create preview URL
      const { data: { publicUrl } } = supabase.storage
        .from("source-videos")
        .getPublicUrl(sourcePath);

      setPreviewUrl(publicUrl);

      // Transcode to HLS
      const { manifestBlob, segmentBlobs } = await transcodeToHLS(
        new File([mp4Blob], "source.mp4", { type: "video/mp4" }),
        (prog) => {
          setProgress(50 + Math.round(prog * 0.5)); // Second 50%
        }
      );

      // Upload manifest
      const manifestPath = `${user.id}/${job.id}/master.m3u8`;
      await supabase.storage
        .from("transcoded-videos")
        .upload(manifestPath, manifestBlob);

      // Upload segments
      for (let i = 0; i < segmentBlobs.length; i++) {
        const segmentPath = `${user.id}/${job.id}/segment_${i.toString().padStart(3, '0')}.ts`;
        await supabase.storage
          .from("transcoded-videos")
          .upload(segmentPath, segmentBlobs[i]);
      }

      // Get public URL for manifest
      const { data: { publicUrl: manifestUrl } } = supabase.storage
        .from("transcoded-videos")
        .getPublicUrl(manifestPath);

      // Update job status
      await supabase
        .from("transcoding_jobs")
        .update({
          status: "completed",
          progress: 100,
          source_url: publicUrl,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      // Create output record
      await supabase.from("transcoded_outputs").insert({
        job_id: job.id,
        manifest_url: manifestUrl,
        quality_variant: "720p",
        bitrate: 2500000,
        resolution: "1280x720",
      });

      toast({
        title: "Transcoding completed!",
        description: "Your video has been successfully transcoded",
      });

      setProgress(100);
      
      // Navigate to jobs list after a delay
      setTimeout(() => {
        navigate("/jobs");
      }, 2000);

    } catch (error: any) {
      console.error("Transcoding error:", error);
      toast({
        title: "Transcoding failed",
        description: error.message || "An error occurred during transcoding",
        variant: "destructive",
      });
    } finally {
      setIsTranscoding(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Submit Transcoding Job</h1>
          <p className="text-muted-foreground">
            Upload and transcode videos using real FFmpeg WebAssembly
          </p>
        </div>

        <div className="grid gap-6">
          <Card className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="file">Select Video/Audio File</Label>
                <div className="flex items-center justify-center w-full">
                  <label
                    htmlFor="file"
                    className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                      selectedFile
                        ? "bg-primary/10 border-primary"
                        : "bg-muted/20 hover:bg-muted/40 border-border"
                    }`}
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Video className="w-12 h-12 mb-4 text-muted-foreground" />
                      {selectedFile ? (
                        <>
                          <p className="mb-2 text-sm font-semibold">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="mb-2 text-sm text-muted-foreground">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-muted-foreground">
                            MP4, MOV, AVI, MKV, MP3, WAV (MAX. 500MB recommended)
                          </p>
                        </>
                      )}
                    </div>
                    <input
                      id="file"
                      type="file"
                      className="hidden"
                      accept="video/*,audio/*"
                      onChange={handleFileSelect}
                      disabled={isTranscoding}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Output Format</Label>
                <RadioGroup
                  value={format}
                  onValueChange={(value) => setFormat(value as "HLS" | "DASH")}
                  className="flex gap-4"
                  disabled={isTranscoding}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="HLS" id="hls" />
                    <Label htmlFor="hls" className="cursor-pointer">
                      HLS (.m3u8)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="DASH" id="dash" />
                    <Label htmlFor="dash" className="cursor-pointer">
                      MPEG-DASH (.mpd)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {isTranscoding && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Transcoding Progress</span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  {!loaded && isLoading && (
                    <p className="text-xs text-muted-foreground">Loading FFmpeg (first time only)...</p>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={!selectedFile || isTranscoding}
              >
                {isTranscoding ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Transcoding...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Start Transcoding
                  </>
                )}
              </Button>
            </form>
          </Card>

          {previewUrl && (
            <VideoPreview videoUrl={previewUrl} title="Transcoded Video Preview" />
          )}
        </div>
      </div>
    </div>
  );
};

export default SubmitJobFunctional;
