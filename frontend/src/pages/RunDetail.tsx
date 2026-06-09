import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, FixLogEntry, Run, RunItem } from "../api";
import { StatusBadge } from "../components/StatusBadge";

export function RunDetail() {
  const { id } = useParams();
  const runId = Number(id);
  const [run, setRun] = useState<Run | null>(null);
  const [log, setLog] = useState<FixLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    api.getRun(runId).then(setRun).catch((e) => setError(e.message));
    api.fixLog(runId).then(setLog).catch(() => {});
  }, [runId]);

  useEffect(refresh, [refresh]);

  if (!run) return <div className="app">{error || "Loading…"}</div>;

  const isPreview = run.status === "preview";
  const flagged = run.items.filter(
    (i) => i.status === "flagged-hard" || i.status === "flagged-suspicious"
  );
  const replace = (updated: RunItem) =>
    setRun((r) => r && { ...r, items: r.items.map((i) => (i.id === updated.id ? updated : i)) });

  const act = async (fn: () => Promise<RunItem>) => {
    setError("");
    try {
      replace(await fn());
      api.fixLog(runId).then(setLog).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  };

  const commit = async () => {
    setBusy(true);
    setError("");
    try {
      setRun(await api.commit(runId));
      api.fixLog(runId).then(setLog).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Commit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <h1>Run #{run.id}</h1>
      <p className="muted">{new Date(run.ran_at).toLocaleString()} · {run.status}</p>

      <div className="cards">
        <div className="card"><div className="big" style={{ color: "var(--green)" }}>{run.summary.clean}</div>clean</div>
        <div className="card"><div className="big" style={{ color: "var(--amber)" }}>{run.summary.flagged}</div>flagged</div>
        <div className="card"><div className="big">{run.summary.synced}</div>synced</div>
        <div className="card"><div className="big" style={{ color: "var(--red)" }}>{run.summary.failed}</div>failed</div>
      </div>

      {error && <div className="error">{error}</div>}

      {isPreview && flagged.length > 0 && (
        <div className="card">
          <h2>Review & fix ({flagged.length})</h2>
          <table>
            <thead>
              <tr><th>SKU</th><th>Name</th><th>Reason</th><th>Qty</th><th></th></tr>
            </thead>
            <tbody>
              {flagged.map((item) => (
                <FlaggedRow key={item.id} runId={runId} item={item} onAct={act} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h2>All items ({run.items.length})</h2>
        <table>
          <thead>
            <tr><th>SKU</th><th>Name</th><th>Offline</th><th>Online</th><th>Combined</th><th>Final</th><th>Status</th></tr>
          </thead>
          <tbody>
            {run.items.map((i) => (
              <tr key={i.id}>
                <td>{i.sku || <span className="muted">—</span>}</td>
                <td>{i.name}</td>
                <td>{i.excel_quantity ?? "—"}</td>
                <td>{i.shopify_quantity ?? "—"}</td>
                <td>{i.combined_quantity ?? "—"}</td>
                <td>{i.final_quantity ?? "—"}</td>
                <td><StatusBadge status={i.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isPreview && (
        <button className="primary" onClick={commit} disabled={busy}>
          {busy ? "Syncing…" : "Sync to destination"}
        </button>
      )}

      {log.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <h2>Fix log</h2>
          <table>
            <thead>
              <tr><th>When</th><th>SKU</th><th>Action</th><th>Old → New</th></tr>
            </thead>
            <tbody>
              {log.map((e, idx) => (
                <tr key={idx}>
                  <td className="muted">{new Date(e.timestamp).toLocaleTimeString()}</td>
                  <td>{e.sku}</td>
                  <td><span className="badge gray">{e.action}</span></td>
                  <td>{e.old_value ?? "—"} → {e.new_value ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
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
    <tr>
      <td>{item.sku || <span className="muted">no SKU</span>}</td>
      <td>{item.name}</td>
      <td style={{ color: "var(--amber)", fontSize: 13 }}>{item.flag_reason}</td>
      <td>
        <input
          className="qty-input"
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
      </td>
      <td style={{ whiteSpace: "nowrap" }}>
        <button onClick={() => onAct(() => api.fixItem(runId, item.id, Number(qty)))}>
          Fix
        </button>{" "}
        <button
          disabled={isHard}
          title={isHard ? "Hard errors must be fixed or skipped" : ""}
          onClick={() => onAct(() => api.approveItem(runId, item.id))}
        >
          Approve
        </button>{" "}
        <button className="danger" onClick={() => onAct(() => api.skipItem(runId, item.id))}>
          Skip
        </button>
      </td>
    </tr>
  );
}
