import { useState } from "react";
import { Card } from "@/components/ui/card";
import { JobCard } from "@/components/JobCard";
import { Activity, FileVideo, CheckCircle2, AlertCircle } from "lucide-react";

const mockJobs = [
  {
    id: "1",
    fileName: "conference_recording.mp4",
    status: "processing" as const,
    progress: 67,
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    format: "HLS" as const,
  },
  {
    id: "2",
    fileName: "webinar_2024.mp4",
    status: "completed" as const,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    format: "DASH" as const,
  },
  {
    id: "3",
    fileName: "tutorial_video.mov",
    status: "queued" as const,
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    format: "HLS" as const,
  },
];

const Dashboard = () => {
  const [jobs] = useState(mockJobs);

  const stats = [
    {
      label: "Active Jobs",
      value: "3",
      icon: Activity,
      color: "text-processing",
    },
    {
      label: "Total Processed",
      value: "127",
      icon: FileVideo,
      color: "text-primary",
    },
    {
      label: "Completed Today",
      value: "12",
      icon: CheckCircle2,
      color: "text-success",
    },
    {
      label: "Failed",
      value: "2",
      icon: AlertCircle,
      color: "text-destructive",
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
          {stats.map((stat) => {
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

        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-4">Recent Jobs</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              {...job}
              onView={(id) => console.log("View job", id)}
              onDownload={(id) => console.log("Download job", id)}
              onDelete={(id) => console.log("Delete job", id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
