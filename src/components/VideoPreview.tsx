import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Copy, Check } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import { useToast } from "@/hooks/use-toast";

interface VideoPreviewProps {
  videoUrl: string;
  title?: string;
  qualities?: Array<{ label: string; url: string }>;
  subtitles?: Array<{ label: string; url: string; language: string }>;
}

export const VideoPreview = ({ videoUrl, title, qualities, subtitles }: VideoPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!videoRef.current) return;

    // Initialize Video.js player
    const player = videojs(videoRef.current, {
      controls: true,
      responsive: true,
      fluid: true,
      playbackRates: [0.5, 1, 1.5, 2],
      controlBar: {
        children: [
          'playToggle',
          'volumePanel',
          'currentTimeDisplay',
          'timeDivider',
          'durationDisplay',
          'progressControl',
          'remainingTimeDisplay',
          'playbackRateMenuButton',
          'subsCapsButton',
          'qualitySelector',
          'fullscreenToggle',
        ],
      },
    });

    playerRef.current = player;

    // Set source based on format
    if (videoUrl.includes('.m3u8')) {
      player.src({
        src: videoUrl,
        type: 'application/x-mpegURL',
      });
    } else if (videoUrl.includes('.mpd')) {
      player.src({
        src: videoUrl,
        type: 'application/dash+xml',
      });
    } else {
      player.src({
        src: videoUrl,
        type: 'video/mp4',
      });
    }

    // Add subtitles/captions if available
    if (subtitles && subtitles.length > 0) {
      subtitles.forEach((subtitle, index) => {
        player.addRemoteTextTrack({
          kind: 'subtitles',
          label: subtitle.label,
          srclang: subtitle.language,
          src: subtitle.url,
          default: index === 0,
        }, false);
      });
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [videoUrl, subtitles]);

  const handleDownload = (url: string, label: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `video_${label}.m3u8`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Download started",
      description: `Downloading ${label} quality`,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({
      title: "Copied to clipboard",
      description: "Export URL has been copied",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="overflow-hidden">
      {title && (
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold">{title}</h3>
        </div>
      )}
      
      <div className="relative bg-black">
        <div data-vjs-player>
          <video
            ref={videoRef}
            className="video-js vjs-big-play-centered"
          />
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Export URL</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(videoUrl)}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="p-2 bg-muted rounded text-xs font-mono break-all">
            {videoUrl}
          </div>
        </div>

        {qualities && qualities.length > 1 && (
          <div className="space-y-2">
            <span className="text-sm font-medium">Available Qualities</span>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {qualities.map((quality) => (
                <Button
                  key={quality.url}
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(quality.url, quality.label)}
                  className="flex items-center gap-2"
                >
                  <Download className="h-3 w-3" />
                  {quality.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
