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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import JSZip from "jszip";

interface Quality {
  quality_variant: string;
  manifest_url: string;
}

interface SelectiveDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qualities: Quality[];
  fileName: string;
  format: "HLS" | "DASH";
}

export const SelectiveDownloadDialog = ({
  open,
  onOpenChange,
  qualities,
  fileName,
  format,
}: SelectiveDownloadDialogProps) => {
  const [selectedQualities, setSelectedQualities] = useState<string[]>(
    qualities.map((q) => q.quality_variant)
  );
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  const toggleQuality = (quality: string) => {
    setSelectedQualities((prev) =>
      prev.includes(quality)
        ? prev.filter((q) => q !== quality)
        : [...prev, quality]
    );
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
    if (selectedQualities.length === 0) {
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
      const isHLS = format === "HLS";
      const selectedOutputs = qualities.filter((q) =>
        selectedQualities.includes(q.quality_variant)
      );

      for (const output of selectedOutputs) {
        const qualityFolder = zip.folder(output.quality_variant);
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

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}_transcoded.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download complete",
        description: `Downloaded ${selectedQualities.length} quality variant(s)`,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Quality Variants</DialogTitle>
          <DialogDescription>
            Choose which quality variants you want to download
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {qualities.map((quality) => (
            <div
              key={quality.quality_variant}
              className="flex items-center space-x-2"
            >
              <Checkbox
                id={quality.quality_variant}
                checked={selectedQualities.includes(quality.quality_variant)}
                onCheckedChange={() => toggleQuality(quality.quality_variant)}
              />
              <Label
                htmlFor={quality.quality_variant}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {quality.quality_variant}
              </Label>
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
          <Button onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
