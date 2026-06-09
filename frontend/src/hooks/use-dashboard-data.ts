import { useCallback, useEffect, useState } from "react";
import { api, type Run } from "../lib/api";

export interface DashboardStats {
  totalProducts: number;
  synced: number;
  flagged: number;
  errors: number;
  remaining: number;
}

const EMPTY_STATS: DashboardStats = {
  totalProducts: 0,
  synced: 0,
  flagged: 0,
  errors: 0,
  remaining: 0,
};

function computeStats(runs: Run[]): DashboardStats {
  const latest = runs[0];
  if (!latest) return EMPTY_STATS;
  const { total, synced, flagged, failed } = latest.summary;
  return {
    totalProducts: total,
    synced,
    flagged,
    errors: failed,
    remaining: Math.max(0, total - synced - failed),
  };
}

export function useDashboardData() {
  const [state, setState] = useState<{
    runs: Run[];
    stats: DashboardStats;
    loading: boolean;
    error: string | null;
    isLive: boolean;
  }>({ runs: [], stats: EMPTY_STATS, loading: true, error: null, isLive: false });

  const refetch = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      await api.ensureSession();
      const runs = await api.listRuns();
      setState({ runs, stats: computeStats(runs), loading: false, error: null, isLive: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[Dashboard] backend fetch failed:", message);
      setState((s) => ({ ...s, loading: false, error: message, isLive: false }));
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
