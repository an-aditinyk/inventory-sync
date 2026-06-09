import { useState } from "react";
import { useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { CircleCheckBig, CircleX, TriangleAlert, CircleMinus, ChevronLeft, ChevronRight } from "lucide-react";
import { Layout } from "../components/Layout";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";

interface RunSummary {
  runId: string;
  dateTime: string;
  status: "Completed" | "Partial" | "Failed";
  total: number;
  synced: number;
  flagged: number;
  errors: number;
  remaining: number;
  fileName: string;
}

interface RunProduct {
  sku: string;
  productName: string;
  quantity: number;
  shopifyQty: number;
  status: "Synced" | "Failed" | "Flagged" | "Skipped";
  note?: string;
}

const RUNS: RunSummary[] = [
  { runId: "SYNC-9821", dateTime: "2023-10-27 08:02:45", status: "Partial", total: 15, synced: 9, flagged: 3, errors: 2, remaining: 1, fileName: "inventory_oct27.xlsx" },
  { runId: "SYNC-9820", dateTime: "2023-10-26 18:02:10", status: "Completed", total: 14, synced: 14, flagged: 0, errors: 0, remaining: 0, fileName: "inventory_oct26_pm.xlsx" },
  { runId: "SYNC-9819", dateTime: "2023-10-26 08:01:45", status: "Failed", total: 14, synced: 0, flagged: 0, errors: 1, remaining: 14, fileName: "inventory_oct26_am.xlsx" },
  { runId: "SYNC-9818", dateTime: "2023-10-25 18:02:00", status: "Completed", total: 13, synced: 13, flagged: 0, errors: 0, remaining: 0, fileName: "inventory_oct25_pm.xlsx" },
  { runId: "SYNC-9817", dateTime: "2023-10-25 08:00:30", status: "Partial", total: 13, synced: 10, flagged: 2, errors: 1, remaining: 0, fileName: "inventory_oct25_am.xlsx" },
  { runId: "SYNC-9816", dateTime: "2023-10-24 18:05:00", status: "Completed", total: 12, synced: 12, flagged: 0, errors: 0, remaining: 0, fileName: "inventory_oct24.xlsx" },
];

const RUN_PRODUCTS: Record<string, RunProduct[]> = {
  "SYNC-9821": [
    { sku: "SKU-001", productName: "Blue Denim Jacket", quantity: 120, shopifyQty: 120, status: "Synced" },
    { sku: "SKU-002", productName: "Classic White Tee", quantity: 500, shopifyQty: 500, status: "Synced" },
    { sku: "SKU-003", productName: "Running Sneakers", quantity: 45, shopifyQty: 45, status: "Synced" },
    { sku: "SKU-004", productName: "Leather Wallet", quantity: 200, shopifyQty: 0, status: "Skipped", note: "Not in Shopify" },
    { sku: "SKU-005", productName: "Aviator Sunglasses", quantity: 30, shopifyQty: 85, status: "Flagged", note: "Qty diff > 50" },
    { sku: "SKU-006", productName: "Canvas Backpack", quantity: 0, shopifyQty: 60, status: "Skipped", note: "Not in Excel" },
    { sku: "SKU-007", productName: "Wool Beanie", quantity: -5, shopifyQty: 10, status: "Failed", note: "Negative stock not allowed" },
    { sku: "SKU-008", productName: "Silver Watch", quantity: 150, shopifyQty: 150, status: "Synced" },
    { sku: "SKU-009", productName: "Cotton Socks (3-Pack)", quantity: 320, shopifyQty: 320, status: "Synced" },
    { sku: "SKU-010", productName: "Puffer Jacket", quantity: 80, shopifyQty: 80, status: "Synced" },
  ],
  "SYNC-9820": [
    { sku: "SKU-001", productName: "Blue Denim Jacket", quantity: 115, shopifyQty: 115, status: "Synced" },
    { sku: "SKU-002", productName: "Classic White Tee", quantity: 490, shopifyQty: 490, status: "Synced" },
    { sku: "SKU-008", productName: "Silver Watch", quantity: 148, shopifyQty: 148, status: "Synced" },
    { sku: "SKU-009", productName: "Cotton Socks (3-Pack)", quantity: 310, shopifyQty: 310, status: "Synced" },
    { sku: "SKU-010", productName: "Puffer Jacket", quantity: 78, shopifyQty: 78, status: "Synced" },
  ],
};

const statusColors: Record<string, string> = {
  Completed: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  Partial: "bg-amber-100 text-amber-700 border border-amber-200",
  Failed: "bg-red-100 text-red-700 border border-red-200",
};

const productStatus: Record<string, { icon: typeof CircleCheckBig; className: string }> = {
  Synced: { icon: CircleCheckBig, className: "text-emerald-500" },
  Failed: { icon: CircleX, className: "text-red-500" },
  Flagged: { icon: TriangleAlert, className: "text-amber-500" },
  Skipped: { icon: CircleMinus, className: "text-slate-400" },
};

const rowBg: Record<string, string> = {
  Synced: "",
  Failed: "bg-red-50/50",
  Flagged: "bg-amber-50/50",
  Skipped: "bg-slate-50/60",
};

export function History() {
  const search = useSearch();
  const initial = new URLSearchParams(search).get("run");
  const [selected, setSelected] = useState<string | null>(initial);

  const run = selected ? RUNS.find((r) => r.runId === selected) : null;
  const products = selected ? (RUN_PRODUCTS[selected] ?? []) : [];

  return (
    <Layout title="History" subtitle="All past sync runs and their detailed results">
      <AnimatePresence mode="wait">
        {run ? (
          <RunDetail key="detail" run={run} products={products} onBack={() => setSelected(null)} />
        ) : (
          <RunList key="list" onSelect={setSelected} />
        )}
      </AnimatePresence>
    </Layout>
  );
}

function RunList({ onSelect }: { onSelect: (id: string) => void }) {
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
              {RUNS.map((r, i) => (
                <motion.tr
                  key={r.runId}
                  data-testid={`row-run-${r.runId}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="hover:bg-muted/30 transition-colors cursor-pointer group"
                  onClick={() => onSelect(r.runId)}
                >
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{r.runId}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{r.dateTime}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.fileName}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">{r.total}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-600 font-medium">{r.synced}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-600 font-medium">{r.flagged}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-600 font-medium">{r.errors}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </motion.div>
  );
}

function RunDetail({
  run,
  products,
  onBack,
}: {
  run: RunSummary;
  products: RunProduct[];
  onBack: () => void;
}) {
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
              <p className="font-mono text-lg font-bold text-foreground mt-0.5">{run.runId}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {run.dateTime} · {run.fileName}
              </p>
            </div>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[run.status]}`}>
              {run.status}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-3 mt-5">
            {[
              { label: "Total", value: run.total, color: "text-foreground" },
              { label: "Synced", value: run.synced, color: "text-emerald-600" },
              { label: "Flagged", value: run.flagged, color: "text-amber-600" },
              { label: "Errors", value: run.errors, color: "text-red-600" },
              { label: "Remaining", value: run.remaining, color: "text-slate-500" },
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
        {products.length === 0 ? (
          <Card className="border border-border shadow-none">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No detailed product data available for this run.
            </CardContent>
          </Card>
        ) : (
          <Card className="border border-border shadow-none overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">SKU</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Product Name</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Qty (Excel)</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Qty (Shopify)</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {products.map((p, i) => {
                    const { icon: Icon, className } = productStatus[p.status] ?? productStatus.Skipped;
                    return (
                      <motion.tr
                        key={p.sku}
                        data-testid={`row-run-product-${p.sku}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className={`hover:brightness-95 transition-all ${rowBg[p.status]}`}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{p.productName}</td>
                        <td className={`px-4 py-3 text-right tabular-nums text-sm ${p.quantity < 0 ? "text-red-600 font-semibold" : "text-foreground"}`}>
                          {p.quantity}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-sm text-muted-foreground">{p.shopifyQty}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5">
                            <Icon className={`w-3.5 h-3.5 ${className}`} />
                            <span className="text-xs font-semibold text-foreground">{p.status}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {p.note ?? <span className="text-muted-foreground/40">—</span>}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </motion.div>
  );
}
