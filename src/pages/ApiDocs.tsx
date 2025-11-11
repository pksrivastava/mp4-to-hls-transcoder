import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Code } from "lucide-react";

const ApiDocs = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">API Documentation</h1>
          <p className="text-muted-foreground">
            RESTful API reference for integrating with Transcoder Pro
          </p>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Code className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-semibold">Base URL</h2>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm">
              {import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcoding-api
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Use your Supabase auth token for authentication
            </p>
          </Card>

          <Tabs defaultValue="transcode" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="transcode">Transcode</TabsTrigger>
              <TabsTrigger value="status">Status</TabsTrigger>
              <TabsTrigger value="transcript">Transcript</TabsTrigger>
              <TabsTrigger value="media">Media</TabsTrigger>
              <TabsTrigger value="bulk">Bulk Ops</TabsTrigger>
            </TabsList>

            <TabsContent value="transcode" className="space-y-6">
              <Card className="p-6">
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-processing">POST</Badge>
                    <code className="text-sm">/transcoding-api/submit</code>
                  </div>
                  <p className="text-muted-foreground">Submit a new transcoding job</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Request Body</h4>
                    <pre className="bg-muted/50 p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "source_url": "https://example.com/video.mp4",
  "format": "HLS",
  "quality_profiles": ["720p", "1080p"],
  "subtitle_languages": ["en", "es"],
  "callback_url": "https://your-api.com/webhook"
}`}
                    </pre>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Response</h4>
                    <pre className="bg-muted/50 p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "job_id": "job_abc123xyz",
  "status": "queued",
  "created_at": "2024-01-15T10:30:00Z",
  "estimated_completion": "2024-01-15T10:45:00Z"
}`}
                    </pre>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="status" className="space-y-6">
              <Card className="p-6">
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-success">GET</Badge>
                    <code className="text-sm">/transcoding-api/status?job_id=xxx</code>
                  </div>
                  <p className="text-muted-foreground">Check the status of a transcoding job</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Response</h4>
                    <pre className="bg-muted/50 p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "job_id": "job_abc123xyz",
  "status": "processing",
  "progress": 67,
  "current_step": "Encoding 1080p variant",
  "manifest_url": null,
  "error": null
}`}
                    </pre>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="transcript" className="space-y-6">
              <Card className="p-6">
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-success">GET</Badge>
                    <code className="text-sm">/transcript/:file_id</code>
                  </div>
                  <p className="text-muted-foreground">
                    Retrieve transcript for a completed transcoding job
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Query Parameters</h4>
                    <pre className="bg-muted/50 p-4 rounded-lg overflow-x-auto text-sm">
{`format: "srt" | "vtt" | "json"
language: "en" | "es" | "fr" | ...`}
                    </pre>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Response (JSON format)</h4>
                    <pre className="bg-muted/50 p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "file_id": "file_abc123",
  "language": "en",
  "segments": [
    {
      "start": 0.0,
      "end": 3.5,
      "text": "Welcome to our tutorial"
    }
  ]
}`}
                    </pre>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="media" className="space-y-6">
              <Card className="p-6">
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-success">GET</Badge>
                    <code className="text-sm">/media/:file_id</code>
                  </div>
                  <p className="text-muted-foreground">
                    Retrieve media files and manifests for completed jobs
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Response</h4>
                    <pre className="bg-muted/50 p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "file_id": "file_abc123",
  "format": "HLS",
  "manifest_url": "https://cdn.example.com/master.m3u8",
  "variants": [
    {
      "quality": "1080p",
      "bitrate": 5000000,
      "url": "https://cdn.example.com/1080p/index.m3u8"
    }
  ],
  "subtitles": [
    {
      "language": "en",
      "format": "vtt",
      "url": "https://cdn.example.com/subtitles/en.vtt"
    }
  ]
}`}
                    </pre>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="bulk" className="space-y-6">
              <Card className="p-6">
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-destructive">DELETE</Badge>
                    <code className="text-sm">/transcoding-api/bulk-delete</code>
                  </div>
                  <p className="text-muted-foreground">Delete multiple transcoding jobs at once</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Request Body</h4>
                    <pre className="bg-muted/50 p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "job_ids": ["job_abc123", "job_def456", "job_ghi789"]
}`}
                    </pre>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Response</h4>
                    <pre className="bg-muted/50 p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "message": "3 job(s) deleted successfully",
  "deleted_count": 3
}`}
                    </pre>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-processing">POST</Badge>
                    <code className="text-sm">/transcoding-api/bulk-download</code>
                  </div>
                  <p className="text-muted-foreground">Get download information for multiple jobs</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Request Body</h4>
                    <pre className="bg-muted/50 p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "job_ids": ["job_abc123", "job_def456"]
}`}
                    </pre>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Response</h4>
                    <pre className="bg-muted/50 p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "jobs": [
    {
      "job_id": "job_abc123",
      "file_name": "video1.mp4",
      "format": "HLS",
      "status": "completed",
      "outputs": [
        {
          "quality_variant": "720p",
          "manifest_url": "https://...",
          "bitrate": 2500000,
          "resolution": "1280x720"
        }
      ]
    }
  ],
  "total_jobs": 2
}`}
                    </pre>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>

          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-4">Authentication</h3>
            <p className="text-muted-foreground mb-4">
              All API requests require authentication using an API key in the Authorization header:
            </p>
            <pre className="bg-muted/50 p-4 rounded-lg overflow-x-auto text-sm">
              Authorization: Bearer YOUR_API_KEY
            </pre>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ApiDocs;
