import { useEffect, useState } from "react";
import { useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { CircleCheckBig, CircleX, TriangleAlert, CircleMinus, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Layout } from "../components/Layout";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { api, type Run, type RunItem, type FixLogEntry, type ItemStatus } from "../lib/api";

const statusColors: Record<string, string> = {
  Completed: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  Partial: "bg-amber-100 text-amber-700 border border-amber-200",
  Failed: "bg-red-100 text-red-700 border border-red-200",
  Preview: "bg-blue-100 text-blue-700 border border-blue-200",
};

const itemStatusMeta: Record<ItemStatus, { icon: typeof CircleCheckBig; className: string; label: string }> = {
  clean: { icon: CircleCheckBig, className: "text-emerald-500", label: "Clean" },
  synced: { icon: CircleCheckBig, className: "text-emerald-500", label: "Synced" },
  fixed: { icon: CircleCheckBig, className: "text-emerald-500", label: "Fixed" },
  approved: { icon: CircleCheckBig, className: "text-emerald-500", label: "Approved" },
  "flagged-suspicious": { icon: TriangleAlert, className: "text-amber-500", label: "Flagged" },
  "flagged-hard": { icon: CircleX, className: "text-red-500", label: "Error" },
  failed: { icon: CircleX, className: "text-red-500", label: "Failed" },
  skipped: { icon: CircleMinus, className: "text-slate-400", label: "Skipped" },
};

function rowBg(status: ItemStatus): string {
  if (status === "flagged-hard" || status === "failed") return "bg-red-50/50";
  if (status === "flagged-suspicious") return "bg-amber-50/50";
  if (status === "skipped") return "bg-slate-50/60";
  return "";
}

export function History() {
  const search = useSearch();
  const initial = new URLSearchParams(search).get("run");
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(initial ? Number(initial) : null);

  useEffect(() => {
    api
      .listRuns()
      .then((r) => {
        setRuns(r);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
  }, []);

  return (
    <Layout title="History" subtitle="All past sync runs and their detailed results">
      <AnimatePresence mode="wait">
        {selectedId != null ? (
          <RunDetail key="detail" runId={selectedId} onBack={() => setSelectedId(null)} />
        ) : (
          <RunList key="list" runs={runs} loading={loading} error={error} onSelect={setSelectedId} />
        )}
      </AnimatePresence>
    </Layout>
  );
}

function formatDateTime(value: string): string {
  try {
    return new Date(value)
      .toLocaleString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .replace(",", "");
  } catch {
    return value;
  }
}

function RunList({
  runs,
  loading,
  error,
  onSelect,
}: {
  runs: Run[];
  loading: boolean;
  error: string | null;
  onSelect: (id: number) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
      <Card className="border border-border shadow-none overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Run ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date &amp; Time</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">File</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Synced</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Flagged</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Errors</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">Loading runs…</td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    {error ? `Backend error: ${error}` : "No runs yet."}
                  </td>
                </tr>
              ) : (
                runs.map((r, i) => (
                  <motion.tr
                    key={r.id}
                    data-testid={`row-run-${r.run_id}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="hover:bg-muted/30 transition-colors cursor-pointer group"
                    onClick={() => onSelect(r.id)}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{r.run_id}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(r.ran_at)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.file_name ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">{r.summary.total}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600 font-medium">{r.summary.synced}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-600 font-medium">{r.summary.flagged}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-600 font-medium">{r.summary.failed}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[r.display_status]}`}>
                        {r.display_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </motion.div>
  );
}

function RunDetail({ runId, onBack }: { runId: number; onBack: () => void }) {
  const [run, setRun] = useState<Run | null>(null);
  const [log, setLog] = useState<FixLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getRun(runId).then(setRun).catch((e) => setError(e instanceof Error ? e.message : String(e)));
    api.fixLog(runId).then(setLog).catch(() => {});
  }, [runId]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!run) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} className="space-y-5">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-1 text-muted-foreground hover:text-foreground" data-testid="button-back-to-runs">
        <ChevronLeft className="w-3.5 h-3.5" /> All Runs
      </Button>

      <Card className="border border-border shadow-none">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Run ID</p>
              <p className="font-mono text-lg font-bold text-foreground mt-0.5">{run.run_id}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDateTime(run.ran_at)} · {run.file_name ?? "—"}
              </p>
            </div>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[run.display_status]}`}>
              {run.display_status}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-3 mt-5">
            {[
              { label: "Total", value: run.summary.total, color: "text-foreground" },
              { label: "Clean", value: run.summary.clean, color: "text-emerald-600" },
              { label: "Flagged", value: run.summary.flagged, color: "text-amber-600" },
              { label: "Synced", value: run.summary.synced, color: "text-emerald-600" },
              { label: "Failed", value: run.summary.failed, color: "text-red-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-muted/40 rounded-lg p-3 text-center border border-border">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Product-Level Results</h3>
        <Card className="border border-border shadow-none overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">SKU</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Product Name</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Offline</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Online</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Final</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {run.items.map((p: RunItem, i) => {
                  const meta = itemStatusMeta[p.status];
                  return (
                    <motion.tr
                      key={p.id}
                      data-testid={`row-run-product-${p.sku}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className={`hover:brightness-95 transition-all ${rowBg(p.status)}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku || "—"}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-sm text-muted-foreground">{p.excel_quantity ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-sm text-muted-foreground">{p.shopify_quantity ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-sm text-foreground">{p.final_quantity ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <meta.icon className={`w-3.5 h-3.5 ${meta.className}`} />
                          <span className="text-xs font-semibold text-foreground">{meta.label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {p.flag_reason || <span className="text-muted-foreground/40">—</span>}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {log.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" /> Fix Log
          </h3>
          <Card className="border border-border shadow-none overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">When</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">SKU</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Old → New</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {log.map((e, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(e.timestamp).toLocaleTimeString()}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground">{e.sku}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        {e.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {e.old_value ?? "—"} → {e.new_value ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </motion.div>
  );
}
