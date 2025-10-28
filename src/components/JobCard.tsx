import { Card } from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Eye, Download, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface JobCardProps {
  id: string;
  fileName: string;
  status: "completed" | "processing" | "failed" | "queued" | "paused";
  progress?: number;
  createdAt: string;
  format: "HLS" | "DASH";
  onView: (id: string) => void;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
}

export const JobCard = ({
  id,
  fileName,
  status,
  progress = 0,
  createdAt,
  format,
  onView,
  onDownload,
  onDelete,
}: JobCardProps) => {
  return (
    <Card className="p-6 hover:shadow-glow transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg truncate mb-1">{fileName}</h3>
          <p className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      {status === "processing" && (
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="text-sm">
          <span className="text-muted-foreground">Format: </span>
          <span className="font-medium">{format}</span>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onView(id)}>
            <Eye className="w-4 h-4" />
          </Button>
          {status === "completed" && (
            <Button size="sm" variant="outline" onClick={() => onDownload(id)}>
              <Download className="w-4 h-4" />
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDelete(id)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
