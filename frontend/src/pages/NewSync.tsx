import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Download,
  Eye,
  ClipboardPen,
  Zap,
  Check,
  FileSpreadsheet,
  CircleCheckBig,
  TriangleAlert,
  CircleX,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Layout } from "../components/Layout";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useToast } from "../hooks/use-toast";
import { api, type Run, type RunItem, type ItemStatus } from "../lib/api";

const steps = [
  { id: 1, label: "Upload Excel", icon: Upload },
  { id: 2, label: "Fetch Shopify", icon: Download },
  { id: 3, label: "Run Preview", icon: Eye },
  { id: 4, label: "Review & Fix", icon: ClipboardPen },
  { id: 5, label: "Commit Sync", icon: Zap },
];

// Sample online (Shopify) stock used until a live OAuth pull is wired.
const SAMPLE_SHOPIFY = [
  { sku: "MUG-001", title: "Blue Mug", inventory_quantity: 50 },
  { sku: "PEN-002", title: "Gel Pen", inventory_quantity: 12 },
  { sku: "BOX-003", title: "Storage Box", inventory_quantity: 8 },
];

function statusLabel(s: ItemStatus): { text: string; cls: string } {
  switch (s) {
    case "clean":
      return { text: "Clean", cls: "bg-emerald-100 text-emerald-700" };
    case "flagged-suspicious":
      return { text: "Flagged", cls: "bg-amber-100 text-amber-700" };
    case "flagged-hard":
      return { text: "Error", cls: "bg-red-100 text-red-700" };
    case "fixed":
      return { text: "Fixed", cls: "bg-emerald-100 text-emerald-700" };
    case "approved":
      return { text: "Approved", cls: "bg-emerald-100 text-emerald-700" };
    case "skipped":
      return { text: "Skipped", cls: "bg-slate-100 text-slate-600" };
    case "synced":
      return { text: "Synced", cls: "bg-emerald-100 text-emerald-700" };
    case "failed":
      return { text: "Failed", cls: "bg-red-100 text-red-700" };
  }
}

const isFlagged = (s: ItemStatus) => s === "flagged-hard" || s === "flagged-suspicious";

export function NewSync() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [shopifyFetched, setShopifyFetched] = useState(false);
  const [fetchingShopify, setFetchingShopify] = useState(false);
  const [runningPreview, setRunningPreview] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const items = run?.items ?? [];
  const cleanCount = items.filter((i) => i.status === "clean").length;
  const flaggedCount = items.filter((i) => i.status === "flagged-suspicious").length;
  const errorCount = items.filter((i) => i.status === "flagged-hard").length;
  const unresolvedFlags = items.filter((i) => isFlagged(i.status));

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  function fetchShopify() {
    setFetchingShopify(true);
    setTimeout(() => {
      setFetchingShopify(false);
      setShopifyFetched(true);
    }, 1200);
  }

  async function runPreview() {
    if (!file) return;
    setRunningPreview(true);
    try {
      const result = await api.preview(file, SAMPLE_SHOPIFY);
      setRun(result);
    } catch (err) {
      toast({
        title: "Preview failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setRunningPreview(false);
    }
  }

  function replaceItem(updated: RunItem) {
    setRun((r) => (r ? { ...r, items: r.items.map((i) => (i.id === updated.id ? updated : i)) } : r));
  }

  async function act(fn: () => Promise<RunItem>) {
    try {
      replaceItem(await fn());
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  }

  async function startSync() {
    if (!run) return;
    setCommitting(true);
    try {
      const committed = await api.commit(run.id);
      setRun(committed);
    } catch (err) {
      toast({
        title: "Sync failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setCommitting(false);
    }
  }

  const syncDone = run?.status === "committed" || run?.status === "failed";

  function canProceed() {
    if (step === 1) return !!file;
    if (step === 2) return shopifyFetched;
    if (step === 3) return !!run;
    return true;
  }
  function next() {
    if (step < 5) setStep((s) => s + 1);
  }
  function back() {
    if (step > 1) setStep((s) => s - 1);
  }
  function reset() {
    setStep(1);
    setFile(null);
    setShopifyFetched(false);
    setRun(null);
  }

  return (
    <Layout title="New Sync" subtitle="Step-by-step inventory sync wizard">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center">
          {steps.map((s, idx) => {
            const completed = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      completed
                        ? "bg-emerald-500 text-white"
                        : active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {completed ? <Check className="w-4 h-4" /> : <s.icon className="w-3.5 h-3.5" />}
                  </div>
                  <span
                    className={`text-xs font-medium hidden sm:block ${active ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`flex-1 h-px mx-3 transition-colors ${completed ? "bg-emerald-400" : "bg-border"}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
          >
            {step === 1 && (
              <Card className="border border-border shadow-none">
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                      <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Upload Excel File</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Columns are read using your saved mapping (default: sku / name / quantity)
                      </p>
                    </div>
                  </div>
                  <div
                    className="border-2 border-dashed border-border rounded-lg p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="upload-dropzone"
                  >
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                    {file ? (
                      <>
                        <p className="text-sm font-semibold text-foreground">{file.name}</p>
                        <p className="text-xs text-emerald-600 mt-1">File ready — click Next to continue</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-foreground">Drop your file here or click to browse</p>
                        <p className="text-xs text-muted-foreground mt-1">Supported: .xlsx</p>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx"
                      className="hidden"
                      onChange={onFileChange}
                      data-testid="input-file-upload"
                    />
                  </div>
                  {file && (
                    <div className="mt-4 flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                      <CircleCheckBig className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        Reading offline stock; online stock will be combined from Shopify.
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <Card className="border border-border shadow-none">
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                      <Download className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Fetch Shopify Data</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Stage online stock (sample data until live OAuth pull is wired)
                      </p>
                    </div>
                  </div>
                  {shopifyFetched ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-md px-4 py-3">
                        <CircleCheckBig className="w-4 h-4 flex-shrink-0" />
                        <span>
                          Staged <strong>{SAMPLE_SHOPIFY.length} variants</strong> of online stock for matching.
                        </span>
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-muted/40 border-b border-border">
                              <th className="text-left px-3 py-2 text-muted-foreground font-semibold uppercase tracking-wider">SKU</th>
                              <th className="text-left px-3 py-2 text-muted-foreground font-semibold uppercase tracking-wider">Title</th>
                              <th className="text-right px-3 py-2 text-muted-foreground font-semibold uppercase tracking-wider">Online Qty</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {SAMPLE_SHOPIFY.map((v) => (
                              <tr key={v.sku}>
                                <td className="px-3 py-2 font-mono text-muted-foreground">{v.sku}</td>
                                <td className="px-3 py-2 text-foreground">{v.title}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{v.inventory_quantity}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Button size="lg" onClick={fetchShopify} disabled={fetchingShopify} className="gap-2" data-testid="button-fetch-shopify">
                        {fetchingShopify ? (
                          <>
                            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            Fetching catalog...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" /> Fetch Shopify Products
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {step === 3 && (
              <Card className="border border-border shadow-none">
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                      <Eye className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Run Preview</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Real engine run — match by SKU, combine pools, quality gate. Writes nothing.
                      </p>
                    </div>
                  </div>
                  {run ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <PreviewStat label="Clean" value={cleanCount} color="emerald" icon={CircleCheckBig} />
                        <PreviewStat label="Flagged" value={flaggedCount} color="amber" icon={TriangleAlert} />
                        <PreviewStat label="Errors" value={errorCount} color="red" icon={CircleX} />
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-muted/40 border-b border-border">
                              <th className="text-left px-3 py-2 text-muted-foreground font-semibold uppercase tracking-wider">SKU</th>
                              <th className="text-left px-3 py-2 text-muted-foreground font-semibold uppercase tracking-wider">Product Name</th>
                              <th className="text-right px-3 py-2 text-muted-foreground font-semibold uppercase tracking-wider">Combined Qty</th>
                              <th className="text-left px-3 py-2 text-muted-foreground font-semibold uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {items.map((it) => {
                              const sl = statusLabel(it.status);
                              return (
                                <tr
                                  key={it.id}
                                  className={
                                    it.status === "flagged-hard"
                                      ? "bg-red-50/50"
                                      : it.status === "flagged-suspicious"
                                        ? "bg-amber-50/50"
                                        : ""
                                  }
                                >
                                  <td className="px-3 py-2 font-mono text-muted-foreground">{it.sku || "—"}</td>
                                  <td className="px-3 py-2 text-foreground">{it.name}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{it.combined_quantity ?? "—"}</td>
                                  <td className="px-3 py-2">
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold ${sl.cls}`}>
                                      {sl.text}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Button size="lg" variant="outline" onClick={runPreview} disabled={runningPreview} className="gap-2" data-testid="button-run-preview">
                        {runningPreview ? (
                          <>
                            <div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                            Running engine...
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4" /> Run Preview
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {step === 4 && (
              <Card className="border border-border shadow-none">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                      <ClipboardPen className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Review &amp; Fix</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Fixes are re-checked through the quality gate. Logged per sync.
                      </p>
                    </div>
                    <div className="ml-auto flex gap-2">
                      <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                        {flaggedCount} flagged
                      </span>
                      <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-semibold">
                        {errorCount} errors
                      </span>
                    </div>
                  </div>
                  {unresolvedFlags.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      Nothing to review — all items are clean or already resolved.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/40 border-b border-border">
                            <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">SKU</th>
                            <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reason</th>
                            <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Qty</th>
                            <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {unresolvedFlags.map((it) => (
                            <FlaggedRow key={it.id} runId={run!.id} item={it} onAct={act} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {step === 5 && (
              <Card className="border border-border shadow-none">
                <CardContent className="p-8 text-center">
                  {syncDone ? (
                    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-5">
                      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                        <CircleCheckBig className="w-8 h-8 text-emerald-500" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground">Sync Complete</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Run ID: <span className="font-mono font-semibold">{run?.run_id}</span>
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
                        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                          <p className="text-xl font-bold text-emerald-600">{run?.summary.synced ?? 0}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Synced</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                          <p className="text-xl font-bold text-amber-600">{run?.summary.flagged ?? 0}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Flagged</p>
                        </div>
                        <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                          <p className="text-xl font-bold text-red-600">{run?.summary.failed ?? 0}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Failed</p>
                        </div>
                      </div>
                      <div className="flex justify-center gap-3 pt-2">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/history?run=${run?.id}`)} data-testid="button-view-run">
                          View Run Details
                        </Button>
                        <Button size="sm" onClick={reset} data-testid="button-new-run">
                          Start Another Sync
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="py-6 space-y-5">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                        <Zap className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">
                          Push {cleanCount + items.filter((i) => i.status === "fixed" || i.status === "approved").length} ready items to the destination
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Clean, fixed, and approved items are pushed (idempotent). Re-running never duplicates.
                        </p>
                      </div>
                      <div className="flex justify-center gap-2 text-xs text-muted-foreground">
                        <span className="text-emerald-600 font-semibold">{cleanCount} clean</span>
                        <span>·</span>
                        <span className="text-amber-600 font-semibold">{flaggedCount} flagged</span>
                        <span>·</span>
                        <span className="text-red-600 font-semibold">{errorCount} errors</span>
                      </div>
                      <Button size="lg" onClick={startSync} disabled={committing || !run} className="gap-2" data-testid="button-start-sync">
                        {committing ? (
                          <>
                            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4" /> Start Sync
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>

        {!syncDone && (
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={back} disabled={step === 1} className="gap-1" data-testid="button-back">
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </Button>
            {step < 5 && (
              <Button size="sm" onClick={next} disabled={!canProceed()} className="gap-1" data-testid="button-next">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function FlaggedRow({
  runId,
  item,
  onAct,
}: {
  runId: number;
  item: RunItem;
  onAct: (fn: () => Promise<RunItem>) => void;
}) {
  const [qty, setQty] = useState<string>(String(item.combined_quantity ?? 0));
  const isHard = item.status === "flagged-hard";
  return (
    <tr className={isHard ? "bg-red-50/50" : "bg-amber-50/50"}>
      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{item.sku || "no SKU"}</td>
      <td className="px-3 py-2.5 text-xs text-amber-700">{item.flag_reason}</td>
      <td className="px-3 py-2.5 text-right">
        <Input
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="h-7 text-xs w-20 text-right ml-auto"
          data-testid={`input-qty-${item.sku}`}
        />
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-xs px-2"
          onClick={() => onAct(() => api.fixItem(runId, item.id, Number(qty)))}
          data-testid={`button-fix-${item.sku}`}
        >
          Fix
        </Button>{" "}
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-xs px-2"
          disabled={isHard}
          title={isHard ? "Hard errors must be fixed or skipped" : ""}
          onClick={() => onAct(() => api.approveItem(runId, item.id))}
          data-testid={`button-approve-${item.sku}`}
        >
          Approve
        </Button>{" "}
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-xs px-2 border-red-300 text-red-600 hover:bg-red-50"
          onClick={() => onAct(() => api.skipItem(runId, item.id))}
          data-testid={`button-skip-${item.sku}`}
        >
          Skip
        </Button>
      </td>
    </tr>
  );
}

function PreviewStat({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: "emerald" | "amber" | "red";
  icon: typeof CircleCheckBig;
}) {
  const styles = {
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-600",
    amber: "bg-amber-50 border-amber-100 text-amber-600",
    red: "bg-red-50 border-red-100 text-red-600",
  };
  return (
    <div className={`border rounded-lg p-4 text-center ${styles[color]}`}>
      <Icon className="w-5 h-5 mx-auto mb-2 opacity-70" />
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-0.5 opacity-80">{label}</p>
    </div>
  );
}
