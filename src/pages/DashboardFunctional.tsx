import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { JobCard } from "@/components/JobCard";
import { TranscriptionDialog } from "@/components/TranscriptionDialog";
import { Activity, FileVideo, CheckCircle2, AlertCircle, HardDrive, Download, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { VideoPreview } from "@/components/VideoPreview";
import { SelectiveDownloadDialog } from "@/components/SelectiveDownloadDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
    storageUsed: 0,
  });
  const [selectedJobUrl, setSelectedJobUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [selectedJobForDownload, setSelectedJobForDownload] = useState<{
    jobs: Array<{
      id: string;
      qualities: Array<{ quality_variant: string; manifest_url: string }>;
      fileName: string;
      format: "HLS" | "DASH";
    }>;
  } | null>(null);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transcriptionDialogOpen, setTranscriptionDialogOpen] = useState(false);
  const [selectedJobForTranscription, setSelectedJobForTranscription] = useState<{
    jobId: string;
    sourceUrl: string;
    fileName: string;
  } | null>(null);
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

      // Calculate storage usage (estimate based on completed jobs)
      const storageEstimate = completed * 50; // Rough estimate: 50MB per job

      setStats({
        active,
        total: data.length,
        completedToday,
        failed,
        storageUsed: storageEstimate,
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

    // Open selective download dialog
    setSelectedJobForDownload({
      jobs: [{
        id,
        qualities: outputs,
        fileName: job.file_name,
        format: job.format,
      }]
    });
    setDownloadDialogOpen(true);
  };

  const handleBulkDownload = async () => {
    if (selectedJobIds.size === 0) return;

    const jobsToDownload = [];
    for (const jobId of selectedJobIds) {
      const job = jobs.find((j) => j.id === jobId);
      if (!job || job.status !== "completed") continue;

      const { data: outputs } = await supabase
        .from("transcoded_outputs")
        .select("manifest_url, quality_variant")
        .eq("job_id", jobId);

      if (outputs && outputs.length > 0) {
        jobsToDownload.push({
          id: jobId,
          qualities: outputs,
          fileName: job.file_name,
          format: job.format,
        });
      }
    }

    if (jobsToDownload.length === 0) {
      toast({
        title: "No files to download",
        description: "Selected jobs have no completed outputs",
        variant: "destructive",
      });
      return;
    }

    setSelectedJobForDownload({ jobs: jobsToDownload });
    setDownloadDialogOpen(true);
  };

  const handleBulkDelete = async () => {
    if (selectedJobIds.size === 0) return;
    
    const { error } = await supabase
      .from("transcoding_jobs")
      .delete()
      .in("id", Array.from(selectedJobIds));

    if (error) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Jobs deleted",
      description: `${selectedJobIds.size} job(s) have been deleted`,
    });

    setSelectedJobIds(new Set());
    setDeleteDialogOpen(false);
    fetchJobs();
  };

  const handleSelectionChange = (id: string, selected: boolean) => {
    const newSelection = new Set(selectedJobIds);
    if (selected) {
      newSelection.add(id);
    } else {
      newSelection.delete(id);
    }
    setSelectedJobIds(newSelection);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobIds(new Set(jobs.map(j => j.id)));
    } else {
      setSelectedJobIds(new Set());
    }
  };

  const handleTranscribe = (id: string) => {
    const job = jobs.find((j) => j.id === id);
    if (job) {
      setSelectedJobForTranscription({
        jobId: job.id,
        sourceUrl: job.source_url,
        fileName: job.file_name,
      });
      setTranscriptionDialogOpen(true);
    }
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
    {
      label: "Storage Used",
      value: `${stats.storageUsed}MB`,
      icon: HardDrive,
      color: "text-primary",
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

        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-semibold">Recent Jobs</h2>
            {jobs.length > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedJobIds.size === jobs.length && jobs.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  Select All ({selectedJobIds.size} selected)
                </span>
              </div>
            )}
          </div>
          {selectedJobIds.size > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDownload}
                disabled={!Array.from(selectedJobIds).some(id => jobs.find(j => j.id === id)?.status === "completed")}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Selected ({selectedJobIds.size})
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected ({selectedJobIds.size})
              </Button>
            </div>
          )}
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
                sourceUrl={job.source_url}
                onView={handleViewJob}
                onDownload={handleDownload}
                onDelete={handleDelete}
                onTranscribe={handleTranscribe}
                isSelected={selectedJobIds.has(job.id)}
                onSelectionChange={handleSelectionChange}
              />
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Jobs?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedJobIds.size} job(s) and all associated transcoded files.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {selectedJobForDownload && (
        <SelectiveDownloadDialog
          open={downloadDialogOpen}
          onOpenChange={setDownloadDialogOpen}
          jobs={selectedJobForDownload.jobs}
        />
      )}

      {selectedJobForTranscription && (
        <TranscriptionDialog
          open={transcriptionDialogOpen}
          onOpenChange={setTranscriptionDialogOpen}
          jobId={selectedJobForTranscription.jobId}
          sourceUrl={selectedJobForTranscription.sourceUrl}
          fileName={selectedJobForTranscription.fileName}
        />
      )}
    </div>
  );
};

export default DashboardFunctional;
