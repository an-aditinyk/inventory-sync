import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Search, RefreshCw } from "lucide-react";
import { Layout } from "../components/Layout";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { StatusBadge } from "../components/StatusBadge";

interface LogEntry {
  id: string;
  timestamp: string;
  runId: string;
  action: "UPLOAD" | "VALIDATE" | "FETCH" | "PREVIEW" | "SYNC" | "ERROR";
  sku: string | null;
  message: string;
  status: "INFO" | "WARNING" | "ERROR";
}

const LOGS: LogEntry[] = [
  { id: "l1", timestamp: "2023-10-27 08:00:05", runId: "SYNC-9821", action: "UPLOAD", sku: null, message: "Excel file uploaded: inventory_oct27.xlsx (15 rows)", status: "INFO" },
  { id: "l2", timestamp: "2023-10-27 08:00:08", runId: "SYNC-9821", action: "VALIDATE", sku: null, message: "Validating column mapping: SKU, Product Name, Quantity", status: "INFO" },
  { id: "l3", timestamp: "2023-10-27 08:00:10", runId: "SYNC-9821", action: "FETCH", sku: null, message: "Fetching Shopify product catalog — 1,390 products found", status: "INFO" },
  { id: "l4", timestamp: "2023-10-27 08:00:15", runId: "SYNC-9821", action: "PREVIEW", sku: null, message: "Preview complete: 9 clean, 3 flagged, 2 errors, 1 remaining", status: "INFO" },
  { id: "l5", timestamp: "2023-10-27 08:01:02", runId: "SYNC-9821", action: "VALIDATE", sku: "SKU-005", message: "Quantity difference > 50 units (Excel: 30, Shopify: 85)", status: "WARNING" },
  { id: "l6", timestamp: "2023-10-27 08:01:14", runId: "SYNC-9821", action: "ERROR", sku: "SKU-007", message: "Negative stock value detected — SKU skipped", status: "ERROR" },
  { id: "l7", timestamp: "2023-10-27 08:01:30", runId: "SYNC-9821", action: "SYNC", sku: "SKU-001", message: "Updated Shopify inventory: 120 units", status: "INFO" },
  { id: "l8", timestamp: "2023-10-27 08:01:40", runId: "SYNC-9821", action: "SYNC", sku: "SKU-002", message: "Updated Shopify inventory: 500 units", status: "INFO" },
  { id: "l9", timestamp: "2023-10-27 08:02:45", runId: "SYNC-9821", action: "SYNC", sku: null, message: "Sync run SYNC-9821 completed: 9 synced, 2 errors, 3 flagged", status: "INFO" },
  { id: "l10", timestamp: "2023-10-26 18:00:00", runId: "SYNC-9820", action: "UPLOAD", sku: null, message: "Excel file uploaded: inventory_oct26_pm.xlsx (14 rows)", status: "INFO" },
  { id: "l11", timestamp: "2023-10-26 18:00:05", runId: "SYNC-9820", action: "FETCH", sku: null, message: "Shopify catalog fetched successfully", status: "INFO" },
  { id: "l12", timestamp: "2023-10-26 18:00:30", runId: "SYNC-9820", action: "PREVIEW", sku: null, message: "Preview complete: 14 clean, 0 flagged, 0 errors", status: "INFO" },
  { id: "l13", timestamp: "2023-10-26 18:01:00", runId: "SYNC-9820", action: "SYNC", sku: null, message: "All 14 products synced successfully", status: "INFO" },
  { id: "l14", timestamp: "2023-10-26 18:02:10", runId: "SYNC-9820", action: "SYNC", sku: null, message: "Run SYNC-9820 completed with no errors", status: "INFO" },
  { id: "l15", timestamp: "2023-10-26 08:00:00", runId: "SYNC-9819", action: "UPLOAD", sku: null, message: "Excel file uploaded: inventory_oct26_am.xlsx", status: "INFO" },
  { id: "l16", timestamp: "2023-10-26 08:01:45", runId: "SYNC-9819", action: "ERROR", sku: null, message: "Shopify API timeout — connection refused after 30s", status: "ERROR" },
  { id: "l17", timestamp: "2023-10-26 08:01:50", runId: "SYNC-9819", action: "ERROR", sku: null, message: "Run SYNC-9819 aborted due to API failure", status: "ERROR" },
  { id: "l18", timestamp: "2023-10-25 18:00:00", runId: "SYNC-9818", action: "UPLOAD", sku: null, message: "Excel file uploaded: inventory_oct25_pm.xlsx", status: "INFO" },
  { id: "l19", timestamp: "2023-10-25 18:01:00", runId: "SYNC-9818", action: "SYNC", sku: null, message: "All 13 products synced", status: "INFO" },
  { id: "l20", timestamp: "2023-10-25 18:02:00", runId: "SYNC-9818", action: "SYNC", sku: null, message: "Run SYNC-9818 completed successfully", status: "INFO" },
];

const actionColors: Record<string, string> = {
  UPLOAD: "text-blue-600",
  VALIDATE: "text-purple-600",
  FETCH: "text-cyan-600",
  PREVIEW: "text-indigo-600",
  SYNC: "text-emerald-600",
  ERROR: "text-red-600",
};

const runIds = Array.from(new Set(LOGS.map((l) => l.runId)));

export function Logs() {
  const [query, setQuery] = useState("");
  const [runFilter, setRunFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function refresh() {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      setLastUpdated(new Date());
    }, 800);
  }

  useEffect(() => {
    if (autoRefresh) intervalRef.current = setInterval(refresh, 5000);
    else if (intervalRef.current) clearInterval(intervalRef.current);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh]);

  const filtered = LOGS.filter((e) => {
    const q = query.toLowerCase();
    const matchesQuery =
      !q ||
      e.message.toLowerCase().includes(q) ||
      (e.sku && e.sku.toLowerCase().includes(q)) ||
      e.runId.toLowerCase().includes(q) ||
      e.action.toLowerCase().includes(q);
    const matchesRun = runFilter === "All" || e.runId === runFilter;
    const matchesType = typeFilter === "All" || e.status === typeFilter;
    return matchesQuery && matchesRun && matchesType;
  });

  return (
    <Layout title="Logs" subtitle="Full history of sync operations, uploads, validations, and errors">
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search message, SKU, run ID..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-8 text-sm"
              data-testid="input-log-search"
            />
          </div>
          <Select value={runFilter} onValueChange={setRunFilter}>
            <SelectTrigger className="h-8 text-xs w-40" data-testid="select-run-filter">
              <SelectValue placeholder="Filter by Run ID" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Runs</SelectItem>
              {runIds.map((id) => (
                <SelectItem key={id} value={id}>
                  {id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 text-xs w-36" data-testid="select-type-filter">
              <SelectValue placeholder="Log type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Types</SelectItem>
              <SelectItem value="INFO">INFO</SelectItem>
              <SelectItem value="WARNING">WARNING</SelectItem>
              <SelectItem value="ERROR">ERROR</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground">
              {filtered.length}/{LOGS.length} entries
            </span>
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => setAutoRefresh((v) => !v)}
              data-testid="button-auto-refresh"
            >
              <RefreshCw className={`w-3 h-3 ${autoRefresh && !refreshing ? "animate-spin" : ""}`} />
              {autoRefresh ? "Auto-refresh ON" : "Auto-refresh"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={refresh}
              disabled={refreshing}
              data-testid="button-manual-refresh"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {autoRefresh && (
          <p className="text-xs text-muted-foreground">
            Auto-refreshing every 5s · Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        )}

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border border-border shadow-none overflow-hidden">
            <div className="overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-border bg-muted/40 backdrop-blur-sm">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Timestamp</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Run ID</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">SKU</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Message</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        No log entries match your search or filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((e, i) => (
                      <motion.tr
                        key={e.id}
                        data-testid={`row-log-${e.id}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(i * 0.015, 0.3) }}
                        className={`hover:bg-muted/30 transition-colors ${
                          e.status === "ERROR" ? "bg-red-50/30" : e.status === "WARNING" ? "bg-amber-50/20" : ""
                        }`}
                      >
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">{e.timestamp}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{e.runId}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-semibold whitespace-nowrap ${actionColors[e.action] ?? "text-foreground"}`}>
                            {e.action}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {e.sku ?? <span className="text-muted-foreground/30">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-foreground">{e.message}</td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={e.status} />
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
}
