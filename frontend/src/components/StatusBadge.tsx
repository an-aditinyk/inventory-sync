import { cn } from "../lib/utils";

const config: Record<string, { label: string; className: string }> = {
  Synced: { label: "Synced", className: "bg-emerald-100 text-emerald-700 border border-emerald-200" },
  Pending: { label: "Pending", className: "bg-slate-100 text-slate-600 border border-slate-200" },
  Flagged: { label: "Flagged", className: "bg-amber-100 text-amber-700 border border-amber-200" },
  Error: { label: "Error", className: "bg-red-100 text-red-700 border border-red-200" },
  INFO: { label: "INFO", className: "bg-slate-100 text-slate-600 border border-slate-200" },
  WARNING: { label: "WARNING", className: "bg-amber-100 text-amber-700 border border-amber-200" },
  ERROR: { label: "ERROR", className: "bg-red-100 text-red-700 border border-red-200" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const c = config[status] ?? {
    label: status,
    className: "bg-slate-100 text-slate-600 border border-slate-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
        c.className,
        className,
      )}
    >
      {c.label}
    </span>
  );
}
