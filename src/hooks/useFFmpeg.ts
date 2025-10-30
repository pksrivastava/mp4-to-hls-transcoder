import { useState, useEffect, useRef } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";

export const useFFmpeg = () => {
  const [loaded, setLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const ffmpegRef = useRef(new FFmpeg());

  const load = async () => {
    if (loaded) return;
    
    setIsLoading(true);
    const ffmpeg = ffmpegRef.current;

    try {
      console.log("Starting FFmpeg load...");
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
      
      console.log("Fetching core JS...");
      const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript");
      console.log("Core JS loaded");
      
      console.log("Fetching WASM...");
      const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm");
      console.log("WASM loaded");
      
      console.log("Initializing FFmpeg...");
      await ffmpeg.load({
        coreURL,
        wasmURL,
      });

      console.log("FFmpeg loaded successfully");
      setLoaded(true);
    } catch (error) {
      console.error("Failed to load FFmpeg:", error);
      setIsLoading(false);
      throw new Error(`FFmpeg loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const transcodeToHLS = async (
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<{ 
    masterManifest: Blob; 
    variants: Array<{
      resolution: string;
      manifestBlob: Blob;
      segmentBlobs: Blob[];
      bitrate: number;
    }> 
  }> => {
    const ffmpeg = ffmpegRef.current;

    const progressHandler = ({ progress }: { progress: number }) => {
      onProgress?.(Math.round(progress * 100));
    };
    
    ffmpeg.on("progress", progressHandler);

    try {
      await ffmpeg.writeFile("input.mp4", await fetchFile(file));

      // Define quality variants with optimized settings for speed
      const variants = [
        { name: "240p", scale: "426:240", bitrate: "400k", audioBitrate: "64k" },
        { name: "360p", scale: "640:360", bitrate: "800k", audioBitrate: "96k" },
        { name: "480p", scale: "854:480", bitrate: "1400k", audioBitrate: "128k" },
        { name: "720p", scale: "1280:720", bitrate: "2500k", audioBitrate: "128k" },
        { name: "1080p", scale: "1920:1080", bitrate: "5000k", audioBitrate: "192k" },
      ];

      const variantResults = [];

      // Transcode all variants
      for (const variant of variants) {
        await ffmpeg.exec([
          "-i", "input.mp4",
          "-vf", `scale=${variant.scale}`,
          "-c:v", "libx264",
          "-preset", "veryfast", // Faster encoding
          "-b:v", variant.bitrate,
          "-maxrate", variant.bitrate,
          "-bufsize", `${parseInt(variant.bitrate) * 2}k`,
          "-c:a", "aac",
          "-b:a", variant.audioBitrate,
          "-hls_time", "4",
          "-hls_playlist_type", "vod",
          "-hls_segment_filename", `segment_${variant.name}_%03d.ts`,
          `output_${variant.name}.m3u8`
        ]);

        // Read variant manifest
        const manifestData = await ffmpeg.readFile(`output_${variant.name}.m3u8`);
        const manifestBlob = new Blob(
          [new Uint8Array(manifestData as unknown as ArrayBuffer)],
          { type: "application/vnd.apple.mpegurl" }
        );

        // Read segments
        const segmentBlobs: Blob[] = [];
        for (let i = 0; i < 100; i++) {
          try {
            const segmentName = `segment_${variant.name}_${i.toString().padStart(3, '0')}.ts`;
            const segmentData = await ffmpeg.readFile(segmentName);
            segmentBlobs.push(new Blob(
              [new Uint8Array(segmentData as unknown as ArrayBuffer)],
              { type: "video/mp2t" }
            ));
          } catch {
            break;
          }
        }

        variantResults.push({
          resolution: variant.name,
          manifestBlob,
          segmentBlobs,
          bitrate: parseInt(variant.bitrate) * 1000,
        });
      }

      // Create master playlist
      let masterPlaylist = "#EXTM3U\n#EXT-X-VERSION:3\n\n";
      for (const variant of variantResults) {
        const [width, height] = variant.resolution === "240p" ? [426, 240] :
                                 variant.resolution === "360p" ? [640, 360] :
                                 variant.resolution === "480p" ? [854, 480] :
                                 variant.resolution === "720p" ? [1280, 720] : [1920, 1080];
        masterPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=${variant.bitrate},RESOLUTION=${width}x${height}\n`;
        masterPlaylist += `output_${variant.resolution}.m3u8\n\n`;
      }

      const masterManifest = new Blob([masterPlaylist], { type: "application/vnd.apple.mpegurl" });

      return { masterManifest, variants: variantResults };
    } finally {
      ffmpeg.off("progress", progressHandler);
    }
  };

  const transcodeToDASH = async (
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<{ 
    manifestBlob: Blob; 
    segmentBlobs: Array<{ name: string; blob: Blob }>;
    variants: Array<{
      resolution: string;
      bitrate: number;
    }>;
  }> => {
    const ffmpeg = ffmpegRef.current;

    const progressHandler = ({ progress }: { progress: number }) => {
      onProgress?.(Math.round(progress * 100));
    };
    
    ffmpeg.on("progress", progressHandler);

    try {
      await ffmpeg.writeFile("input.mp4", await fetchFile(file));

      // Create DASH with multiple representations using map
      await ffmpeg.exec([
        "-i", "input.mp4",
        "-map", "0:v", "-map", "0:v", "-map", "0:v", "-map", "0:v", "-map", "0:v",
        "-map", "0:a",
        "-c:v:0", "libx264", "-preset", "veryfast", "-s:v:0", "426x240", "-b:v:0", "400k",
        "-c:v:1", "libx264", "-preset", "veryfast", "-s:v:1", "640x360", "-b:v:1", "800k",
        "-c:v:2", "libx264", "-preset", "veryfast", "-s:v:2", "854x480", "-b:v:2", "1400k",
        "-c:v:3", "libx264", "-preset", "veryfast", "-s:v:3", "1280x720", "-b:v:3", "2500k",
        "-c:v:4", "libx264", "-preset", "veryfast", "-s:v:4", "1920x1080", "-b:v:4", "5000k",
        "-c:a", "aac", "-b:a", "128k",
        "-seg_duration", "4",
        "-use_timeline", "1",
        "-use_template", "1",
        "-adaptation_sets", "id=0,streams=v id=1,streams=a",
        "-f", "dash",
        "output.mpd"
      ]);

      const manifestData = await ffmpeg.readFile("output.mpd");
      const manifestBlob = new Blob(
        [new Uint8Array(manifestData as unknown as ArrayBuffer)],
        { type: "application/dash+xml" }
      );

      // Read all segment files
      const segmentBlobs: Array<{ name: string; blob: Blob }> = [];
      const files = await ffmpeg.listDir("/");
      
      for (const fileInfo of files) {
        if (fileInfo.name.endsWith(".m4s") || fileInfo.name.endsWith(".mp4")) {
          try {
            const data = await ffmpeg.readFile(fileInfo.name);
            segmentBlobs.push({
              name: fileInfo.name,
              blob: new Blob(
                [new Uint8Array(data as unknown as ArrayBuffer)],
                { type: "video/mp4" }
              ),
            });
          } catch (e) {
            console.warn(`Could not read ${fileInfo.name}:`, e);
          }
        }
      }

      const variants = [
        { resolution: "240p", bitrate: 400000 },
        { resolution: "360p", bitrate: 800000 },
        { resolution: "480p", bitrate: 1400000 },
        { resolution: "720p", bitrate: 2500000 },
        { resolution: "1080p", bitrate: 5000000 },
      ];

      return { manifestBlob, segmentBlobs, variants };
    } finally {
      ffmpeg.off("progress", progressHandler);
    }
  };

  const convertToMP4 = async (
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<Blob> => {
    const ffmpeg = ffmpegRef.current;

    const progressHandler = ({ progress }: { progress: number }) => {
      const percent = Math.round(progress * 100);
      onProgress?.(percent);
    };
    
    ffmpeg.on("progress", progressHandler);

    try {
      await ffmpeg.writeFile("input", await fetchFile(file));

      // Convert to MP4 with web-optimized settings
      await ffmpeg.exec([
        "-i", "input",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        "output.mp4"
      ]);

      const data = await ffmpeg.readFile("output.mp4");
      return new Blob([new Uint8Array(data as unknown as ArrayBuffer)], { type: "video/mp4" });
    } finally {
      ffmpeg.off("progress", progressHandler);
    }
  };

  // Removed cleanup to prevent FFmpeg termination errors
  // FFmpeg instance is kept alive for better performance

  return {
    loaded,
    isLoading,
    load,
    transcodeToHLS,
    transcodeToDASH,
    convertToMP4,
  };
};
