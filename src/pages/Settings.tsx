import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings as SettingsIcon, Key, Bell, Database, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

const Settings = () => {
  const [autoCleanup, setAutoCleanup] = useState(false);
  const [storageStats, setStorageStats] = useState({
    totalJobs: 0,
    completedJobs: 0,
    estimatedStorage: 0,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchStorageStats();
  }, []);

  const fetchStorageStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: jobs } = await supabase
      .from("transcoding_jobs")
      .select("status")
      .eq("user_id", user.id);

    if (jobs) {
      const completed = jobs.filter((j) => j.status === "completed").length;
      setStorageStats({
        totalJobs: jobs.length,
        completedJobs: completed,
        estimatedStorage: completed * 50, // 50MB per job estimate
      });
    }
  };

  const handleCleanupOldJobs = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { error } = await supabase
      .from("transcoding_jobs")
      .delete()
      .eq("user_id", user.id)
      .eq("status", "completed")
      .lt("completed_at", thirtyDaysAgo.toISOString());

    if (error) {
      toast({
        title: "Cleanup failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Cleanup complete",
        description: "Old completed jobs have been removed",
      });
      fetchStorageStats();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your transcoding system configuration</p>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Key className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">API Configuration</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="api-key"
                    type="password"
                    value="••••••••••••••••"
                    readOnly
                    className="flex-1"
                  />
                  <Button variant="outline">Regenerate</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Keep your API key secure. It provides full access to your transcoding system.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook-url">Webhook URL (Optional)</Label>
                <Input
                  id="webhook-url"
                  type="url"
                  placeholder="https://your-api.com/webhook"
                />
                <p className="text-xs text-muted-foreground">
                  Receive notifications when jobs complete or fail.
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <SettingsIcon className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Transcoding Defaults</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-generate subtitles</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically create subtitles for all transcoded media
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Multi-language subtitles</Label>
                  <p className="text-sm text-muted-foreground">
                    Generate subtitles in multiple languages
                  </p>
                </div>
                <Switch />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Adaptive bitrate streaming</Label>
                  <p className="text-sm text-muted-foreground">
                    Create multiple quality variants automatically
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Notifications</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email updates on job completion
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Failure alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified immediately when jobs fail
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Database className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Storage Management</h2>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total Jobs</p>
                    <p className="text-2xl font-bold">{storageStats.totalJobs}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <p className="text-2xl font-bold">{storageStats.completedJobs}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Est. Storage</p>
                    <p className="text-2xl font-bold">{storageStats.estimatedStorage}MB</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Storage Used</span>
                    <span className="font-medium">{Math.min((storageStats.estimatedStorage / 5000) * 100, 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={Math.min((storageStats.estimatedStorage / 5000) * 100, 100)} />
                  <p className="text-xs text-muted-foreground">
                    {storageStats.estimatedStorage} MB of 5000 MB used
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-cleanup old jobs</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically delete completed jobs after 30 days
                  </p>
                </div>
                <Switch checked={autoCleanup} onCheckedChange={setAutoCleanup} />
              </div>

              <Button
                variant="destructive"
                className="w-full"
                onClick={handleCleanupOldJobs}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clean Up Jobs Older Than 30 Days
              </Button>
            </div>
          </Card>

          <div className="flex justify-end gap-4">
            <Button variant="outline">Reset to Defaults</Button>
            <Button>Save Changes</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
