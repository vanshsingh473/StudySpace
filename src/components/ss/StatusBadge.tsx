import { CheckCircle2, AlertTriangle, XCircle, Ban } from "lucide-react";
import type { RoomStatus } from "@/lib/availability";
import { cn } from "@/lib/utils";

const STYLES: Record<RoomStatus, { cls: string; Icon: typeof CheckCircle2; sr: string }> = {
  FREE: { cls: "bg-free-soft text-free-strong", Icon: CheckCircle2, sr: "Status: free" },
  FEW: { cls: "bg-few-soft text-few-strong", Icon: AlertTriangle, sr: "Status: few seats left" },
  FULL: { cls: "bg-full-soft text-full-strong", Icon: XCircle, sr: "Status: full" },
  UNAVAILABLE: { cls: "bg-unavail-soft text-muted-foreground", Icon: Ban, sr: "Status: unavailable" },
};

export function StatusBadge({ status, label, className }: { status: RoomStatus; label: string; className?: string }) {
  const { cls, Icon, sr } = STYLES[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tracking-wide", cls, className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span aria-hidden="true">{label}</span>
      <span className="sr-only">{sr}{status === "FEW" ? `, ${label.toLowerCase()}` : ""}</span>
    </span>
  );
}
