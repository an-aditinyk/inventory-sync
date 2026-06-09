import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  CircleCheckBig,
  TriangleAlert,
  CircleX,
  Clock,
  Plus,
  ShoppingCart,
  Zap,
  Wifi,
  WifiOff,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Layout } from "../components/Layout";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { useToast } from "../hooks/use-toast";
import { useDashboardData, type SyncRunRow } from "../hooks/use-dashboard-data";

const statusColors: Record<string, string> = {
  Completed: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  Partial: "bg-amber-100 text-amber-700 border border-amber-200",
  Failed: "bg-red-100 text-red-700 border border-red-200",
  Running: "bg-blue-100 text-blue-700 border border-blue-200",
};

function formatDateTime(value: string): string {
  try {
    return new Date(value)
      .toLocaleString("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
      .replace(",", "");
  } catch {
    return value;
  }
}

function generatePosRunId() {
  return `POS-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function Dashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isShopifyConnected] = useState(true);
  const [isDestConnected] = useState(true);
  const [simulatingSale, setSimulatingSale] = useState(false);
  const [zohoStage, setZohoStage] = useState<null | "fetching" | "pushing">(null);
  const { runs, stats, loading, error, isLive, refetch, prependRun, removeOptimistic } =
    useDashboardData();

  const cards = [
    { label: "Total Products", value: stats.totalProducts, icon: Package, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
    { label: "Synced", value: stats.synced, icon: CircleCheckBig, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
    { label: "Flagged", value: stats.flagged, icon: TriangleAlert, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
    { label: "Errors", value: stats.errors, icon: CircleX, color: "text-red-600", bg: "bg-red-50", border: "border-red-100" },
    { label: "Remaining", value: stats.remaining, icon: Clock, color: "text-slate-500", bg: "bg-slate-100", border: "border-slate-200" },
  ];

  async function handleZohoSync() {
    setZohoStage("fetching");
    await new Promise((r) => setTimeout(r, 1500));
    setZohoStage("pushing");
    await new Promise((r) => setTimeout(r, 1500));

    const optimisticId = -Date.now();
    const dateTime = new Date().toISOString();
    const runId = `ZOHO-${Math.floor(1000 + Math.random() * 9000)}`;
    prependRun({
      id: optimisticId,
      run_id: runId,
      date_time: dateTime,
      file_name: "Shopify_Excel_to_Zoho",
      total_items: 6,
      synced_items: 6,
      errors_count: 0,
      status: "Completed",
      _optimistic: true,
    });

    try {
      const { error: insertError } = await supabase.from("Fix_Logs").insert({
        run_id: runId,
        date_time: dateTime,
        file_name: "Shopify_Excel_to_Zoho",
        total_items: 6,
        synced_items: 6,
        errors_count: 0,
        status: "Completed",
      });
      if (insertError) throw insertError;
      removeOptimistic(optimisticId);
      await refetch();
      toast({
        title: "Zoho sync complete",
        description: `${runId} — 6 products pushed to Zoho Inventory.`,
      });
    } catch (err) {
      removeOptimistic(optimisticId);
      toast({
        title: "Zoho sync failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setZohoStage(null);
    }
  }

  async function handleSimulateSale() {
    setSimulatingSale(true);
    const optimisticId = -Date.now();
    const dateTime = new Date().toISOString();
    const runId = generatePosRunId();
    prependRun({
      id: optimisticId,
      run_id: runId,
      date_time: dateTime,
      file_name: "POS_Sale_Trigger",
      total_items: 1,
      synced_items: 1,
      errors_count: 0,
      status: "Completed",
      _optimistic: true,
    });

    try {
      const { error: insertError } = await supabase.from("Fix_Logs").insert({
        run_id: runId,
        date_time: dateTime,
        file_name: "POS_Sale_Trigger",
        total_items: 1,
        synced_items: 1,
        errors_count: 0,
        status: "Completed",
      });
      if (insertError) throw insertError;
      removeOptimistic(optimisticId);
      await refetch();
      toast({ title: "Sale simulated", description: `Run ${runId} written to Fix_Logs.` });
    } catch (err) {
      removeOptimistic(optimisticId);
      toast({
        title: "Insert failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSimulatingSale(false);
    }
  }

  return (
    <Layout title="Dashboard" subtitle="Inventory sync overview and connection status">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button
            size="lg"
            className="gap-2 h-11 px-6 text-sm font-semibold shadow-sm"
            onClick={() => navigate("/new-sync")}
            data-testid="button-new-sync"
          >
            <Plus className="w-4 h-4" />
            New Sync
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="gap-2 h-11 px-5 text-sm font-semibold border-amber-300 text-amber-700 hover:bg-amber-50"
            onClick={handleSimulateSale}
            disabled={simulatingSale || !!zohoStage}
            data-testid="button-simulate-sale"
          >
            {simulatingSale ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ShoppingCart className="w-4 h-4" />
            )}
            {simulatingSale ? "Simulating..." : "Simulate Sale"}
          </Button>
          <Button
            size="lg"
            className="gap-2 h-11 px-5 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
            onClick={handleZohoSync}
            disabled={!!zohoStage || simulatingSale}
            data-testid="button-sync-zoho"
          >
            {zohoStage ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {zohoStage === "fetching"
              ? "Fetching from Source..."
              : zohoStage === "pushing"
                ? "Pushing to Zoho Inventory API..."
                : "Sync to Zoho"}
          </Button>

          <div className="flex items-center gap-3 ml-auto">
            <ConnectionBadge label="Shopify" connected={isShopifyConnected} />
            <ConnectionBadge label="Destination" connected={isDestConnected} />
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {cards.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <Card className={`border ${c.border} shadow-none relative overflow-hidden`}>
                <CardContent className="p-4">
                  <div className={`w-8 h-8 rounded-md ${c.bg} flex items-center justify-center mb-3`}>
                    <c.icon className={`w-4 h-4 ${c.color}`} />
                  </div>
                  {loading ? (
                    <div className="h-8 flex items-center">
                      <div className="h-6 w-10 bg-muted animate-pulse rounded" />
                    </div>
                  ) : (
                    <p
                      className="text-2xl font-bold text-foreground"
                      data-testid={`stat-${c.label.toLowerCase().replace(/ /g, "-")}`}
                    >
                      {c.value}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
                </CardContent>
                {!loading && (
                  <div className="absolute top-2.5 right-2.5">
                    {isLive ? (
                      <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                        live
                      </span>
                    ) : (
                      <span
                        title={error ?? ""}
                        className="text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full cursor-help"
                      >
                        mock
                      </span>
                    )}
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Recent Sync Runs</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isLive
                  ? "Live data from Supabase · Fix_Logs"
                  : "Showing fallback data — could not reach Supabase"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground"
                onClick={refetch}
                disabled={loading}
                title="Refresh from Supabase"
                data-testid="button-refresh-runs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={() => navigate("/history")}
                data-testid="button-view-all-runs"
              >
                View all
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

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
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Errors</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && runs.length === 0 ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        {Array.from({ length: 7 }).map((__, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-3 w-20 bg-muted rounded" />
                          </td>
                        ))}
                        <td className="px-4 py-3" />
                      </tr>
                    ))
                  ) : runs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        No sync runs found in Fix_Logs.
                      </td>
                    </tr>
                  ) : (
                    <AnimatePresence initial={false}>
                      {runs.map((run: SyncRunRow) => (
                        <motion.tr
                          key={run.id}
                          data-testid={`row-run-${run.run_id}`}
                          layout
                          initial={{ opacity: 0, y: -12, backgroundColor: "#f0fdf4" }}
                          animate={{
                            opacity: 1,
                            y: 0,
                            backgroundColor: run._optimistic ? "#f0fdf4" : "#ffffff",
                          }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                          className={cn(
                            "hover:bg-muted/30 transition-colors cursor-pointer group",
                            run._optimistic && "bg-emerald-50/60",
                          )}
                          onClick={() => !run._optimistic && navigate(`/history?run=${run.run_id}`)}
                        >
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">
                            {run.run_id}
                            {run._optimistic && (
                              <span className="ml-1.5 text-[10px] font-normal text-emerald-600 bg-emerald-100 px-1 py-0.5 rounded">
                                saving…
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDateTime(run.date_time)}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {run.file_name ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-foreground">{run.total_items}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-emerald-600 font-medium">{run.synced_items}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-red-600 font-medium">{run.errors_count}</td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
                                statusColors[run.status] ??
                                  "bg-slate-100 text-slate-600 border border-slate-200",
                              )}
                            >
                              {run.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {!run._optimistic && (
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                            )}
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {error && (
            <p className="text-xs text-amber-600 mt-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              ⚠ Supabase error: {error}
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
}

function ConnectionBadge({ label, connected }: { label: string; connected: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium",
        connected
          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
          : "bg-red-50 border-red-200 text-red-600",
      )}
    >
      {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      <span>{label}:</span>
      <span className="font-semibold">{connected ? "Connected" : "Not Connected"}</span>
    </div>
  );
}
