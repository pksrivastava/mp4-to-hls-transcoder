import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle, Loader2, Pause } from "lucide-react";

type JobStatus = "completed" | "processing" | "failed" | "queued" | "paused";

interface StatusBadgeProps {
  status: JobStatus;
}

const statusConfig = {
  completed: {
    label: "Completed",
    className: "bg-success text-success-foreground",
    icon: CheckCircle2,
  },
  processing: {
    label: "Processing",
    className: "bg-processing text-processing-foreground",
    icon: Loader2,
  },
  failed: {
    label: "Failed",
    className: "bg-destructive text-destructive-foreground",
    icon: AlertCircle,
  },
  queued: {
    label: "Queued",
    className: "bg-warning text-warning-foreground",
    icon: Clock,
  },
  paused: {
    label: "Paused",
    className: "bg-muted text-muted-foreground",
    icon: Pause,
  },
};

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge className={config.className}>
      <Icon className={`w-3 h-3 mr-1 ${status === "processing" ? "animate-spin" : ""}`} />
      {config.label}
    </Badge>
  );
};
