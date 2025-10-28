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
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
      
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });

      setLoaded(true);
    } catch (error) {
      console.error("Failed to load FFmpeg:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const transcodeToHLS = async (
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<{ manifestBlob: Blob; segmentBlobs: Blob[] }> => {
    const ffmpeg = ffmpegRef.current;
    
    if (!loaded) {
      throw new Error("FFmpeg not loaded");
    }

    // Set up progress monitoring
    const progressHandler = ({ progress }: { progress: number }) => {
      const percent = Math.round(progress * 100);
      onProgress?.(percent);
    };
    
    ffmpeg.on("progress", progressHandler);

    try {
      // Write input file
      await ffmpeg.writeFile("input.mp4", await fetchFile(file));

      // Transcode to HLS with multiple quality variants
      // 720p variant
      await ffmpeg.exec([
        "-i", "input.mp4",
        "-vf", "scale=-2:720",
        "-c:v", "libx264",
        "-b:v", "2500k",
        "-c:a", "aac",
        "-b:a", "128k",
        "-hls_time", "4",
        "-hls_playlist_type", "vod",
        "-hls_segment_filename", "segment_720p_%03d.ts",
        "output_720p.m3u8"
      ]);

      // Read output files
      const manifestData = await ffmpeg.readFile("output_720p.m3u8");
      const manifestBytes = manifestData instanceof Uint8Array 
        ? new Uint8Array(manifestData) 
        : new TextEncoder().encode(manifestData);
      const manifestBlob = new Blob([manifestBytes], { type: "application/vnd.apple.mpegurl" });

      // Read all segment files
      const segmentBlobs: Blob[] = [];
      for (let i = 0; i < 100; i++) {
        try {
          const segmentName = `segment_720p_${i.toString().padStart(3, '0')}.ts`;
          const segmentData = await ffmpeg.readFile(segmentName);
          const segmentBytes = segmentData instanceof Uint8Array
            ? new Uint8Array(segmentData)
            : new TextEncoder().encode(segmentData);
          segmentBlobs.push(new Blob([segmentBytes], { type: "video/mp2t" }));
        } catch {
          break; // No more segments
        }
      }

      return { manifestBlob, segmentBlobs };
    } finally {
      ffmpeg.off("progress", progressHandler);
    }
  };

  const transcodeToDASH = async (
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<{ manifestBlob: Blob; segmentBlobs: Blob[] }> => {
    const ffmpeg = ffmpegRef.current;
    
    if (!loaded) {
      throw new Error("FFmpeg not loaded");
    }

    const progressHandler = ({ progress }: { progress: number }) => {
      const percent = Math.round(progress * 100);
      onProgress?.(percent);
    };
    
    ffmpeg.on("progress", progressHandler);

    try {
      await ffmpeg.writeFile("input.mp4", await fetchFile(file));

      // Transcode to DASH
      await ffmpeg.exec([
        "-i", "input.mp4",
        "-vf", "scale=-2:720",
        "-c:v", "libx264",
        "-b:v", "2500k",
        "-c:a", "aac",
        "-b:a", "128k",
        "-seg_duration", "4",
        "-use_timeline", "1",
        "-use_template", "1",
        "-init_seg_name", "init_$RepresentationID$.m4s",
        "-media_seg_name", "chunk_$RepresentationID$_$Number$.m4s",
        "-f", "dash",
        "output.mpd"
      ]);

      const manifestData = await ffmpeg.readFile("output.mpd");
      const manifestBytes = manifestData instanceof Uint8Array
        ? new Uint8Array(manifestData)
        : new TextEncoder().encode(manifestData);
      const manifestBlob = new Blob([manifestBytes], { type: "application/dash+xml" });

      // Read segment files (simplified)
      const segmentBlobs: Blob[] = [];
      
      return { manifestBlob, segmentBlobs };
    } finally {
      ffmpeg.off("progress", progressHandler);
    }
  };

  const convertToMP4 = async (
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<Blob> => {
    const ffmpeg = ffmpegRef.current;
    
    if (!loaded) {
      throw new Error("FFmpeg not loaded");
    }

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
      const videoBytes = data instanceof Uint8Array
        ? new Uint8Array(data)
        : new TextEncoder().encode(data);
      return new Blob([videoBytes], { type: "video/mp4" });
    } finally {
      ffmpeg.off("progress", progressHandler);
    }
  };

  useEffect(() => {
    return () => {
      // Cleanup
      if (ffmpegRef.current) {
        ffmpegRef.current.terminate();
      }
    };
  }, []);

  return {
    loaded,
    isLoading,
    load,
    transcodeToHLS,
    transcodeToDASH,
    convertToMP4,
  };
};
