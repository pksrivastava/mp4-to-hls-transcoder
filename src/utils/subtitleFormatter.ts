interface SubtitleSegment {
  start: number;
  end: number;
  text: string;
}

// Convert seconds to SRT timestamp format (HH:MM:SS,mmm)
const formatSRTTimestamp = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")},${milliseconds
    .toString()
    .padStart(3, "0")}`;
};

// Convert seconds to VTT timestamp format (HH:MM:SS.mmm)
const formatVTTTimestamp = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${milliseconds
    .toString()
    .padStart(3, "0")}`;
};

/**
 * Convert transcript segments to SRT subtitle format
 */
export const generateSRT = (segments: SubtitleSegment[]): string => {
  let srt = "";

  segments.forEach((segment, index) => {
    srt += `${index + 1}\n`;
    srt += `${formatSRTTimestamp(segment.start)} --> ${formatSRTTimestamp(
      segment.end
    )}\n`;
    srt += `${segment.text}\n\n`;
  });

  return srt.trim();
};

/**
 * Convert transcript segments to WebVTT subtitle format
 */
export const generateVTT = (segments: SubtitleSegment[]): string => {
  let vtt = "WEBVTT\n\n";

  segments.forEach((segment, index) => {
    vtt += `${index + 1}\n`;
    vtt += `${formatVTTTimestamp(segment.start)} --> ${formatVTTTimestamp(
      segment.end
    )}\n`;
    vtt += `${segment.text}\n\n`;
  });

  return vtt.trim();
};

/**
 * Convert plain text to basic subtitle segments (split by sentences)
 */
export const textToSegments = (
  text: string,
  duration?: number
): SubtitleSegment[] => {
  // Split by sentence endings
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0);

  if (sentences.length === 0) return [];

  // Estimate timing if duration is provided
  const segmentDuration = duration
    ? duration / sentences.length
    : 5; // Default 5 seconds per segment

  return sentences.map((sentence, index) => ({
    start: index * segmentDuration,
    end: (index + 1) * segmentDuration,
    text: sentence.trim(),
  }));
};

/**
 * Download subtitle file
 */
export const downloadSubtitle = (
  content: string,
  filename: string,
  format: "srt" | "vtt"
) => {
  const blob = new Blob([content], {
    type: format === "srt" ? "text/plain" : "text/vtt",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.${format}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
