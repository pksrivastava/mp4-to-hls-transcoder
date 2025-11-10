import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { JobCard } from "@/components/JobCard";
import { Activity, FileVideo, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { VideoPreview } from "@/components/VideoPreview";
import JSZip from "jszip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Job {
  id: string;
  file_name: string;
  status: "queued" | "processing" | "completed" | "failed" | "paused";
  progress: number;
  created_at: string;
  format: "HLS" | "DASH";
  source_url: string;
}

const DashboardFunctional = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState({
    active: 0,
    total: 0,
    completedToday: 0,
    failed: 0,
  });
  const [selectedJobUrl, setSelectedJobUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchJobs();
    
    // Set up realtime subscription for job updates
    const channel = supabase
      .channel("transcoding_jobs_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transcoding_jobs",
        },
        () => {
          fetchJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchJobs = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("transcoding_jobs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Error fetching jobs:", error);
      return;
    }

    if (data) {
      setJobs(data as Job[]);

      // Calculate stats
      const active = data.filter(
        (j) => j.status === "processing" || j.status === "queued"
      ).length;
      const completed = data.filter((j) => j.status === "completed").length;
      const failed = data.filter((j) => j.status === "failed").length;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const completedToday = data.filter(
        (j) =>
          j.status === "completed" &&
          new Date(j.created_at) >= today
      ).length;

      setStats({
        active,
        total: data.length,
        completedToday,
        failed,
      });
    }
  };

  const [selectedQualities, setSelectedQualities] = useState<Array<{ label: string; url: string }>>([]);
  const [selectedSubtitles, setSelectedSubtitles] = useState<Array<{ label: string; url: string; language: string }>>([]);

  const handleViewJob = async (id: string) => {
    const job = jobs.find((j) => j.id === id);
    if (job && job.status === "completed") {
      // Fetch all quality variants for this job
      const { data: outputs } = await supabase
        .from("transcoded_outputs")
        .select("manifest_url, quality_variant")
        .eq("job_id", id);

      // Fetch subtitles/transcripts for this job
      const { data: transcripts } = await supabase
        .from("transcripts")
        .select("content, language, format")
        .eq("job_id", id);

      if (outputs && outputs.length > 0) {
        const qualities = outputs.map(output => ({
          label: output.quality_variant,
          url: output.manifest_url,
        }));
        setSelectedQualities(qualities);
        
        // Convert transcripts to subtitle format (if available)
        if (transcripts && transcripts.length > 0) {
          const subtitleUrls = transcripts.map(transcript => {
            // Create a blob URL for the subtitle content
            const blob = new Blob([transcript.content], { type: 'text/vtt' });
            const url = URL.createObjectURL(blob);
            return {
              label: transcript.language.toUpperCase(),
              url: url,
              language: transcript.language,
            };
          });
          setSelectedSubtitles(subtitleUrls);
        } else {
          setSelectedSubtitles([]);
        }
        
        setSelectedJobUrl(outputs[0].manifest_url);
        setIsPreviewOpen(true);
      } else if (job.source_url) {
        // Fallback to source if no outputs
        setSelectedJobUrl(job.source_url);
        setSelectedQualities([]);
        setSelectedSubtitles([]);
        setIsPreviewOpen(true);
      } else {
        toast({
          title: "Preview not available",
          description: "This job has no available outputs",
        });
      }
    } else {
      toast({
        title: "Preview not available",
        description: "This job is not completed yet",
      });
    }
  };

  const handleDownload = async (id: string) => {
    const job = jobs.find((j) => j.id === id);
    if (!job) return;

    toast({
      title: "Preparing download",
      description: "Fetching transcoded files...",
    });

    try {
      const { data: outputs, error } = await supabase
        .from("transcoded_outputs")
        .select("manifest_url, quality_variant")
        .eq("job_id", id);

      if (error || !outputs || outputs.length === 0) {
        toast({
          title: "Download failed",
          description: "Could not retrieve transcoded files",
          variant: "destructive",
        });
        return;
      }

      // Fetch transcripts as well
      const { data: transcripts } = await supabase
        .from("transcripts")
        .select("content, language, format")
        .eq("job_id", id);

      const zip = new JSZip();
      
      // Download all manifest and segment files
      for (const output of outputs) {
        const qualityFolder = zip.folder(output.quality_variant);
        if (!qualityFolder) continue;

        try {
          // Fetch the manifest file
          const manifestResponse = await fetch(output.manifest_url);
          const manifestText = await manifestResponse.text();
          
          // Determine file extension based on format
          const isHLS = job.format === "HLS";
          const manifestExtension = isHLS ? "m3u8" : "mpd";
          qualityFolder.file(`manifest.${manifestExtension}`, manifestText);

          // Parse manifest to get segment URLs
          const segmentUrls = parseManifestForSegments(manifestText, output.manifest_url, isHLS);
          
          // Download all segments
          for (let i = 0; i < segmentUrls.length; i++) {
            const segmentUrl = segmentUrls[i];
            const segmentResponse = await fetch(segmentUrl);
            const segmentBlob = await segmentResponse.blob();
            const segmentName = segmentUrl.split('/').pop() || `segment_${i}`;
            qualityFolder.file(segmentName, segmentBlob);
          }
        } catch (err) {
          console.error(`Error downloading ${output.quality_variant}:`, err);
        }
      }

      // Add transcripts/subtitles to the zip
      if (transcripts && transcripts.length > 0) {
        const subtitlesFolder = zip.folder("subtitles");
        transcripts.forEach((transcript) => {
          subtitlesFolder?.file(
            `${transcript.language}.${transcript.format}`,
            transcript.content
          );
        });
      }

      // Generate and download the zip file
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${job.file_name}_transcoded.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download complete",
        description: `Downloaded ${outputs.length} quality variants`,
      });
    } catch (err) {
      console.error("Download error:", err);
      toast({
        title: "Download failed",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  // Helper function to parse manifest files and extract segment URLs
  const parseManifestForSegments = (manifestContent: string, manifestUrl: string, isHLS: boolean): string[] => {
    const baseUrl = manifestUrl.substring(0, manifestUrl.lastIndexOf('/') + 1);
    const lines = manifestContent.split('\n');
    const segments: string[] = [];

    if (isHLS) {
      // Parse HLS manifest (m3u8)
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith('#')) continue;
        // This is a segment file
        if (trimmed.endsWith('.ts') || trimmed.endsWith('.m4s') || trimmed.includes('.ts?') || trimmed.includes('.m4s?')) {
          segments.push(trimmed.startsWith('http') ? trimmed : baseUrl + trimmed);
        }
      }
    } else {
      // Parse DASH manifest (mpd) - simplified version
      const segmentRegex = /media="([^"]+)"/g;
      let match;
      while ((match = segmentRegex.exec(manifestContent)) !== null) {
        const segmentPath = match[1];
        segments.push(segmentPath.startsWith('http') ? segmentPath : baseUrl + segmentPath);
      }
    }

    return segments;
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("transcoding_jobs")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Job deleted",
      description: "The transcoding job has been deleted",
    });

    fetchJobs();
  };

  const statsConfig = [
    {
      label: "Active Jobs",
      value: stats.active.toString(),
      icon: Activity,
      color: "text-processing",
    },
    {
      label: "Total Processed",
      value: stats.total.toString(),
      icon: FileVideo,
      color: "text-primary",
    },
    {
      label: "Completed Today",
      value: stats.completedToday.toString(),
      icon: CheckCircle2,
      color: "text-success",
    },
    {
      label: "Failed",
      value: stats.failed.toString(),
      icon: AlertCircle,
      color: "text-destructive",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your transcoding jobs and system performance
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsConfig.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold">{stat.value}</p>
                  </div>
                  <Icon className={`w-8 h-8 ${stat.color}`} />
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-4">Recent Jobs</h2>
        </div>

        {jobs.length === 0 ? (
          <Card className="p-12 text-center">
            <FileVideo className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No jobs yet</h3>
            <p className="text-muted-foreground">
              Submit your first transcoding job to get started
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                id={job.id}
                fileName={job.file_name}
                status={job.status}
                progress={job.progress || 0}
                createdAt={job.created_at}
                format={job.format}
                onView={handleViewJob}
                onDownload={handleDownload}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Video Preview</DialogTitle>
          </DialogHeader>
          {selectedJobUrl && (
            <VideoPreview 
              videoUrl={selectedJobUrl} 
              qualities={selectedQualities.length > 0 ? selectedQualities : undefined}
              subtitles={selectedSubtitles.length > 0 ? selectedSubtitles : undefined}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardFunctional;
