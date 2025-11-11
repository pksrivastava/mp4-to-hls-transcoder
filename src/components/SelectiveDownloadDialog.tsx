import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import JSZip from "jszip";

interface Quality {
  quality_variant: string;
  manifest_url: string;
}

interface Job {
  id: string;
  qualities: Quality[];
  fileName: string;
  format: "HLS" | "DASH";
}

interface SelectiveDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: Job[];
}

export const SelectiveDownloadDialog = ({
  open,
  onOpenChange,
  jobs,
}: SelectiveDownloadDialogProps) => {
  const [selectedQualities, setSelectedQualities] = useState<Map<string, Set<string>>>(new Map());
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  // Initialize selection when dialog opens or jobs change
  useEffect(() => {
    if (open && jobs.length > 0) {
      const initial = new Map<string, Set<string>>();
      jobs.forEach(job => {
        initial.set(job.id, new Set(job.qualities.map(q => q.quality_variant)));
      });
      setSelectedQualities(initial);
    }
  }, [open, jobs]);

  const toggleQuality = (jobId: string, quality: string) => {
    setSelectedQualities(prev => {
      const newMap = new Map(prev);
      const jobSet = new Set(newMap.get(jobId) || []);
      
      if (jobSet.has(quality)) {
        jobSet.delete(quality);
      } else {
        jobSet.add(quality);
      }
      
      newMap.set(jobId, jobSet);
      return newMap;
    });
  };

  const selectAllForJob = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    setSelectedQualities(prev => {
      const newMap = new Map(prev);
      newMap.set(jobId, new Set(job.qualities.map(q => q.quality_variant)));
      return newMap;
    });
  };

  const deselectAllForJob = (jobId: string) => {
    setSelectedQualities(prev => {
      const newMap = new Map(prev);
      newMap.set(jobId, new Set());
      return newMap;
    });
  };

  const parseManifestForSegments = (
    manifestContent: string,
    manifestUrl: string,
    isHLS: boolean
  ): string[] => {
    const baseUrl = manifestUrl.substring(0, manifestUrl.lastIndexOf("/") + 1);
    const lines = manifestContent.split("\n");
    const segments: string[] = [];

    if (isHLS) {
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        if (
          trimmed.endsWith(".ts") ||
          trimmed.endsWith(".m4s") ||
          trimmed.includes(".ts?") ||
          trimmed.includes(".m4s?")
        ) {
          segments.push(trimmed.startsWith("http") ? trimmed : baseUrl + trimmed);
        }
      }
    } else {
      const segmentRegex = /media="([^"]+)"/g;
      let match;
      while ((match = segmentRegex.exec(manifestContent)) !== null) {
        const segmentPath = match[1];
        segments.push(
          segmentPath.startsWith("http") ? segmentPath : baseUrl + segmentPath
        );
      }
    }

    return segments;
  };

  const handleDownload = async () => {
    const totalSelected = Array.from(selectedQualities.values()).reduce((sum, set) => sum + set.size, 0);
    
    if (totalSelected === 0) {
      toast({
        title: "No qualities selected",
        description: "Please select at least one quality variant",
        variant: "destructive",
      });
      return;
    }

    setDownloading(true);
    toast({
      title: "Preparing download",
      description: "Fetching transcoded files...",
    });

    try {
      const zip = new JSZip();

      for (const job of jobs) {
        const jobSelection = selectedQualities.get(job.id);
        if (!jobSelection || jobSelection.size === 0) continue;

        const isHLS = job.format === "HLS";
        const jobFolder = jobs.length > 1 ? zip.folder(job.fileName.replace(/\.[^/.]+$/, "")) : zip;
        
        const selectedOutputs = job.qualities.filter(q => jobSelection.has(q.quality_variant));

        for (const output of selectedOutputs) {
          const qualityFolder = jobFolder?.folder(output.quality_variant);
          if (!qualityFolder) continue;

          try {
            const manifestResponse = await fetch(output.manifest_url);
            const manifestText = await manifestResponse.text();

            const manifestExtension = isHLS ? "m3u8" : "mpd";
            qualityFolder.file(`manifest.${manifestExtension}`, manifestText);

            const segmentUrls = parseManifestForSegments(
              manifestText,
              output.manifest_url,
              isHLS
            );

            for (let i = 0; i < segmentUrls.length; i++) {
              const segmentUrl = segmentUrls[i];
              const segmentResponse = await fetch(segmentUrl);
              const segmentBlob = await segmentResponse.blob();
              const segmentName = segmentUrl.split("/").pop() || `segment_${i}`;
              qualityFolder.file(segmentName, segmentBlob);
            }
          } catch (err) {
            console.error(`Error downloading ${output.quality_variant}:`, err);
          }
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      const downloadName = jobs.length === 1 
        ? `${jobs[0].fileName}_transcoded.zip`
        : `bulk_transcoded_${jobs.length}_files.zip`;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download complete",
        description: `Downloaded ${totalSelected} quality variant(s) from ${jobs.length} job(s)`,
      });
      onOpenChange(false);
    } catch (err) {
      console.error("Download error:", err);
      toast({
        title: "Download failed",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const totalSelected = Array.from(selectedQualities.values()).reduce((sum, set) => sum + set.size, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Quality Variants to Download</DialogTitle>
          <DialogDescription>
            Choose which quality variants you want to download {jobs.length > 1 ? `for ${jobs.length} jobs` : ""}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {jobs.map((job) => (
            <div key={job.id} className="space-y-3 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">{job.fileName}</h4>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => selectAllForJob(job.id)}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => deselectAllForJob(job.id)}>
                    Deselect All
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {job.qualities.map((quality) => (
                  <div
                    key={quality.quality_variant}
                    className="flex items-center space-x-2 p-2 rounded hover:bg-accent"
                  >
                    <Checkbox
                      id={`${job.id}-${quality.quality_variant}`}
                      checked={selectedQualities.get(job.id)?.has(quality.quality_variant) || false}
                      onCheckedChange={() => toggleQuality(job.id, quality.quality_variant)}
                    />
                    <Label
                      htmlFor={`${job.id}-${quality.quality_variant}`}
                      className="text-sm font-medium leading-none cursor-pointer flex-1"
                    >
                      {quality.quality_variant}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={downloading}
          >
            Cancel
          </Button>
          <Button onClick={handleDownload} disabled={downloading || totalSelected === 0}>
            {downloading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download ({totalSelected} variant{totalSelected !== 1 ? 's' : ''})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};