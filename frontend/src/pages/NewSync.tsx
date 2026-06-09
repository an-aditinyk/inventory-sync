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

const steps = [
  { id: 1, label: "Upload Excel", icon: Upload },
  { id: 2, label: "Fetch Shopify", icon: Download },
  { id: 3, label: "Run Preview", icon: Eye },
  { id: 4, label: "Review & Fix", icon: ClipboardPen },
  { id: 5, label: "Commit Sync", icon: Zap },
];

interface PreviewItem {
  sku: string;
  productName: string;
  quantity: number;
  shopifyQty: number;
  status: "Clean" | "Flagged" | "Error";
  issue?: string;
  fixed?: boolean;
}

const INITIAL_ITEMS: PreviewItem[] = [
  { sku: "SKU-001", productName: "Blue Denim Jacket", quantity: 120, shopifyQty: 120, status: "Clean" },
  { sku: "SKU-002", productName: "Classic White Tee", quantity: 500, shopifyQty: 500, status: "Clean" },
  { sku: "SKU-003", productName: "Running Sneakers", quantity: 45, shopifyQty: 45, status: "Clean" },
  { sku: "SKU-005", productName: "Aviator Sunglasses", quantity: 30, shopifyQty: 85, status: "Flagged", issue: "Qty diff > 50 units" },
  { sku: "SKU-007", productName: "Wool Beanie", quantity: -5, shopifyQty: 10, status: "Error", issue: "Negative stock value" },
  { sku: "SKU-008", productName: "Silver Watch", quantity: 150, shopifyQty: 150, status: "Clean" },
  { sku: "SKU-009", productName: "Cotton Socks (3-Pack)", quantity: 320, shopifyQty: 320, status: "Clean" },
  { sku: "SKU-010", productName: "Puffer Jacket", quantity: 80, shopifyQty: 80, status: "Clean" },
  { sku: "SKU-012", productName: "V-Neck Sweater", quantity: 200, shopifyQty: 200, status: "Clean" },
  { sku: "SKU-013", productName: "Chino Pants", quantity: 110, shopifyQty: 110, status: "Clean" },
];

export function NewSync() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fetchingShopify, setFetchingShopify] = useState(false);
  const [shopifyFetched, setShopifyFetched] = useState(false);
  const [runningPreview, setRunningPreview] = useState(false);
  const [previewDone, setPreviewDone] = useState(false);
  const [items, setItems] = useState<PreviewItem[]>(INITIAL_ITEMS);
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanCount = items.filter((i) => i.status === "Clean").length;
  const flaggedCount = items.filter((i) => i.status === "Flagged" && !i.fixed).length;
  const errorCount = items.filter((i) => i.status === "Error" && !i.fixed).length;

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setFileName(f.name);
  }
  function fetchShopify() {
    setFetchingShopify(true);
    setTimeout(() => {
      setFetchingShopify(false);
      setShopifyFetched(true);
    }, 2000);
  }
  function runPreview() {
    setRunningPreview(true);
    setTimeout(() => {
      setRunningPreview(false);
      setPreviewDone(true);
    }, 1800);
  }
  function startSync() {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setSyncDone(true);
    }, 2500);
  }
  function updateItem(sku: string, field: "productName" | "quantity", value: string) {
    setItems((arr) =>
      arr.map((it) =>
        it.sku === sku ? { ...it, [field]: field === "quantity" ? Number(value) : value } : it,
      ),
    );
  }
  function markFixed(sku: string) {
    setItems((arr) => arr.map((it) => (it.sku === sku ? { ...it, fixed: true } : it)));
  }
  function canProceed() {
    if (step === 1) return !!fileName;
    if (step === 2) return shopifyFetched;
    if (step === 3) return previewDone;
    return true;
  }
  function next() {
    if (step < 5) setStep((s) => s + 1);
  }
  function back() {
    if (step > 1) setStep((s) => s - 1);
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
                        Select your inventory spreadsheet (.xlsx, .xls, .csv)
                      </p>
                    </div>
                  </div>
                  <div
                    className="border-2 border-dashed border-border rounded-lg p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="upload-dropzone"
                  >
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                    {fileName ? (
                      <>
                        <p className="text-sm font-semibold text-foreground">{fileName}</p>
                        <p className="text-xs text-emerald-600 mt-1">File ready — click Next to continue</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-foreground">Drop your file here or click to browse</p>
                        <p className="text-xs text-muted-foreground mt-1">Supported: .xlsx, .xls, .csv</p>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={onFileChange}
                      data-testid="input-file-upload"
                    />
                  </div>
                  {fileName && (
                    <div className="mt-4 flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                      <CircleCheckBig className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        Detected columns: <strong>SKU</strong>, <strong>Product Name</strong>,{" "}
                        <strong>Quantity</strong>
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
                        Pull your current Shopify product catalog
                      </p>
                    </div>
                  </div>
                  {shopifyFetched ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-md px-4 py-3">
                        <CircleCheckBig className="w-4 h-4 flex-shrink-0" />
                        <span>
                          Successfully fetched <strong>1,390 products</strong> from your Shopify store
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          ["Products fetched", "1,390"],
                          ["Variants", "3,241"],
                          ["Collections", "18"],
                        ].map(([label, value]) => (
                          <div key={label} className="bg-muted/40 rounded-md p-3 text-center border border-border">
                            <p className="text-lg font-bold text-foreground">{value}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                          </div>
                        ))}
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
                      {fetchingShopify && (
                        <p className="text-xs text-muted-foreground mt-4">Connecting to Shopify API...</p>
                      )}
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
                        Dry run — no changes will be made to Shopify
                      </p>
                    </div>
                  </div>
                  {previewDone ? (
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
                              <th className="text-right px-3 py-2 text-muted-foreground font-semibold uppercase tracking-wider">Quantity</th>
                              <th className="text-left px-3 py-2 text-muted-foreground font-semibold uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {items.map((it) => (
                              <tr
                                key={it.sku}
                                className={
                                  it.status === "Error"
                                    ? "bg-red-50/50"
                                    : it.status === "Flagged"
                                      ? "bg-amber-50/50"
                                      : ""
                                }
                              >
                                <td className="px-3 py-2 font-mono text-muted-foreground">{it.sku}</td>
                                <td className="px-3 py-2 text-foreground">{it.productName}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{it.quantity}</td>
                                <td className="px-3 py-2">
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                                      it.status === "Clean"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : it.status === "Flagged"
                                          ? "bg-amber-100 text-amber-700"
                                          : "bg-red-100 text-red-700"
                                    }`}
                                  >
                                    {it.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
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
                            Analyzing...
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
                        Edit flagged and error items before syncing
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
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border">
                          <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">SKU</th>
                          <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Product Name</th>
                          <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Qty (Excel)</th>
                          <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Qty (Shopify)</th>
                          <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Issue</th>
                          <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {items.map((it) => {
                          const editable = (it.status === "Flagged" || it.status === "Error") && !it.fixed;
                          return (
                            <tr
                              key={it.sku}
                              className={
                                it.fixed
                                  ? "bg-emerald-50/40"
                                  : it.status === "Error"
                                    ? "bg-red-50/50"
                                    : it.status === "Flagged"
                                      ? "bg-amber-50/50"
                                      : ""
                              }
                            >
                              <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{it.sku}</td>
                              <td className="px-3 py-2.5">
                                {editable ? (
                                  <Input
                                    value={it.productName}
                                    onChange={(e) => updateItem(it.sku, "productName", e.target.value)}
                                    className="h-7 text-xs w-44"
                                    data-testid={`input-name-${it.sku}`}
                                  />
                                ) : (
                                  <span className="text-xs text-foreground">{it.productName}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                {editable ? (
                                  <Input
                                    type="number"
                                    value={it.quantity}
                                    onChange={(e) => updateItem(it.sku, "quantity", e.target.value)}
                                    className="h-7 text-xs w-20 text-right ml-auto"
                                    data-testid={`input-qty-${it.sku}`}
                                  />
                                ) : (
                                  <span
                                    className={`text-xs tabular-nums ${it.quantity < 0 ? "text-red-600 font-semibold" : "text-foreground"}`}
                                  >
                                    {it.quantity}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                                {it.shopifyQty}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-muted-foreground">
                                {it.issue ?? <span className="text-muted-foreground/40">—</span>}
                              </td>
                              <td className="px-3 py-2.5">
                                {it.fixed ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                                    <CircleCheckBig className="w-3 h-3" /> Fixed
                                  </span>
                                ) : editable ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-xs px-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                    onClick={() => markFixed(it.sku)}
                                    data-testid={`button-fix-${it.sku}`}
                                  >
                                    Mark as Fixed
                                  </Button>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 5 && (
              <Card className="border border-border shadow-none">
                <CardContent className="p-8 text-center">
                  {syncDone ? (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="space-y-5"
                    >
                      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                        <CircleCheckBig className="w-8 h-8 text-emerald-500" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground">Sync Complete</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Run ID: <span className="font-mono font-semibold">SYNC-9822</span>
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
                        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                          <p className="text-xl font-bold text-emerald-600">{cleanCount}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Synced</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                          <p className="text-xl font-bold text-amber-600">0</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Flagged</p>
                        </div>
                        <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                          <p className="text-xl font-bold text-red-600">0</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Errors</p>
                        </div>
                      </div>
                      <div className="flex justify-center gap-3 pt-2">
                        <Button variant="outline" size="sm" onClick={() => navigate("/history")} data-testid="button-view-run">
                          View Run Details
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setStep(1);
                            setFileName(null);
                            setShopifyFetched(false);
                            setPreviewDone(false);
                            setSyncDone(false);
                          }}
                          data-testid="button-new-run"
                        >
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
                          Ready to sync {items.length} products to Shopify
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          This will update live inventory. This action cannot be undone.
                        </p>
                      </div>
                      <div className="flex justify-center gap-2 text-xs text-muted-foreground">
                        <span className="text-emerald-600 font-semibold">{cleanCount} clean</span>
                        <span>·</span>
                        <span className="text-amber-600 font-semibold">{flaggedCount} flagged</span>
                        <span>·</span>
                        <span className="text-red-600 font-semibold">{errorCount} errors</span>
                      </div>
                      <Button size="lg" onClick={startSync} disabled={syncing} className="gap-2" data-testid="button-start-sync">
                        {syncing ? (
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
