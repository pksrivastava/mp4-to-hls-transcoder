import { useState } from "react";
import { JobCard } from "@/components/JobCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter } from "lucide-react";

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
  {
    id: "4",
    fileName: "product_demo.mp4",
    status: "failed" as const,
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    format: "HLS" as const,
  },
  {
    id: "5",
    fileName: "live_stream_recording.mp4",
    status: "completed" as const,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    format: "DASH" as const,
  },
];

const JobsList = () => {
  const [jobs] = useState(mockJobs);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch = job.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">All Jobs</h1>
          <p className="text-muted-foreground">View and manage all your transcoding jobs</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search jobs by filename..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">Export CSV</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              {...job}
              onView={(id) => console.log("View job", id)}
              onDownload={(id) => console.log("Download job", id)}
              onDelete={(id) => console.log("Delete job", id)}
            />
          ))}
        </div>

        {filteredJobs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">No jobs found matching your criteria</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobsList;
