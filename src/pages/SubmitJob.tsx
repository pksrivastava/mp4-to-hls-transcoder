import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Video, Radio } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SubmitJob = () => {
  const [format, setFormat] = useState<"HLS" | "DASH">("HLS");
  const { toast } = useToast();

  const handleFileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Job submitted successfully",
      description: "Your transcoding job has been added to the queue.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Submit Transcoding Job</h1>
          <p className="text-muted-foreground">
            Upload files or configure live streams for transcoding
          </p>
        </div>

        <Card className="p-8">
          <Tabs defaultValue="file" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="file" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                File Upload
              </TabsTrigger>
              <TabsTrigger value="live" className="flex items-center gap-2">
                <Radio className="w-4 h-4" />
                Live Stream
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file">
              <form onSubmit={handleFileSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="file">Select Video/Audio File</Label>
                  <div className="flex items-center justify-center w-full">
                    <label
                      htmlFor="file"
                      className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Video className="w-12 h-12 mb-4 text-muted-foreground" />
                        <p className="mb-2 text-sm text-muted-foreground">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground">
                          MP4, MOV, AVI, MKV, MP3, WAV (MAX. 5GB)
                        </p>
                      </div>
                      <input id="file" type="file" className="hidden" />
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Output Format</Label>
                  <RadioGroup
                    value={format}
                    onValueChange={(value) => setFormat(value as "HLS" | "DASH")}
                    className="flex gap-4"
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

                <div className="space-y-2">
                  <Label htmlFor="job-name">Job Name (Optional)</Label>
                  <Input id="job-name" placeholder="Enter a name for this job" />
                </div>

                <Button type="submit" className="w-full" size="lg">
                  Submit Job
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="live">
              <form onSubmit={handleFileSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="stream-url">Stream URL</Label>
                  <Input
                    id="stream-url"
                    placeholder="rtmp://your-server.com/live/stream"
                    type="url"
                  />
                  <p className="text-xs text-muted-foreground">
                    Supports RTMP, SRT, and WebRTC protocols
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stream-key">Stream Key (if required)</Label>
                  <Input id="stream-key" type="password" placeholder="Enter stream key" />
                </div>

                <div className="space-y-2">
                  <Label>Output Format</Label>
                  <RadioGroup
                    value={format}
                    onValueChange={(value) => setFormat(value as "HLS" | "DASH")}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="HLS" id="live-hls" />
                      <Label htmlFor="live-hls" className="cursor-pointer">
                        HLS (.m3u8)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="DASH" id="live-dash" />
                      <Label htmlFor="live-dash" className="cursor-pointer">
                        MPEG-DASH (.mpd)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <Button type="submit" className="w-full" size="lg">
                  Start Live Transcoding
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default SubmitJob;
