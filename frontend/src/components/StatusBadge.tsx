import { ItemStatus } from "../api";

// Maps each item status to the spec's color language:
// green = clean/done, amber = flagged (needs a glance), red = error.
const MAP: Record<ItemStatus, { color: string; label: string }> = {
  clean: { color: "green", label: "Clean" },
  synced: { color: "green", label: "Synced" },
  fixed: { color: "green", label: "Fixed" },
  approved: { color: "green", label: "Approved" },
  "flagged-suspicious": { color: "amber", label: "Flagged" },
  "flagged-hard": { color: "red", label: "Error" },
  failed: { color: "red", label: "Failed" },
  skipped: { color: "gray", label: "Skipped" },
};

export function StatusBadge({ status }: { status: ItemStatus }) {
  const { color, label } = MAP[status] ?? { color: "gray", label: status };
  return <span className={`badge ${color}`}>{label}</span>;
}
