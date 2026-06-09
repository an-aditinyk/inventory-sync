import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface SyncRunRow {
  id: number;
  run_id: string;
  date_time: string;
  file_name: string | null;
  total_items: number;
  synced_items: number;
  errors_count: number;
  status: "Completed" | "Partial" | "Failed" | "Running";
  _optimistic?: boolean;
}

export interface DashboardStats {
  totalProducts: number;
  synced: number;
  flagged: number;
  errors: number;
  remaining: number;
}

const FALLBACK_STATS: DashboardStats = {
  totalProducts: 15,
  synced: 9,
  flagged: 3,
  errors: 2,
  remaining: 1,
};

function computeStats(runs: SyncRunRow[], totalProducts: number, synced: number): DashboardStats {
  const latest = runs.find((r) => !r._optimistic) ?? runs[0];
  const errors = latest?.errors_count ?? 0;
  const remaining = latest ? latest.total_items - latest.synced_items - latest.errors_count : 0;
  const flagged = latest?.status === "Partial" ? 1 : 0;
  return { totalProducts, synced, flagged, errors, remaining };
}

export function useDashboardData() {
  const [state, setState] = useState<{
    runs: SyncRunRow[];
    stats: DashboardStats;
    loading: boolean;
    error: string | null;
    isLive: boolean;
  }>({ runs: [], stats: FALLBACK_STATS, loading: true, error: null, isLive: false });

  const refetch = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [runsRes, totalRes, syncedRes] = await Promise.all([
        supabase
          .from("Fix_Logs")
          .select(
            "id, run_id, date_time, file_name, total_items, synced_items, errors_count, status",
          )
          .order("date_time", { ascending: false })
          .limit(10),
        supabase.from("Products").select("*", { count: "exact", head: true }),
        supabase.from("Products").select("*", { count: "exact", head: true }).eq("status", "Synced"),
      ]);

      if (runsRes.error) throw runsRes.error;
      if (totalRes.error) throw totalRes.error;
      if (syncedRes.error) throw syncedRes.error;

      const runs = (runsRes.data as SyncRunRow[]) ?? [];
      const totalProducts = totalRes.count ?? 0;
      const synced = syncedRes.count ?? 0;

      setState({
        runs,
        stats: computeStats(runs, totalProducts, synced),
        loading: false,
        error: null,
        isLive: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[Dashboard] Supabase fetch failed, using fallback:", message);
      setState((s) => ({
        ...s,
        loading: false,
        error: message,
        isLive: false,
        stats: FALLBACK_STATS,
      }));
    }
  }, []);

  const prependRun = useCallback((run: SyncRunRow) => {
    setState((s) => ({ ...s, runs: [run, ...s.runs] }));
  }, []);

  const removeOptimistic = useCallback((id: number) => {
    setState((s) => ({ ...s, runs: s.runs.filter((r) => r.id !== id) }));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch, prependRun, removeOptimistic };
}
