import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Run } from "../api";
import { StatusBadge } from "../components/StatusBadge";

export function History() {
  const [runs, setRuns] = useState<Run[]>([]);
  useEffect(() => {
    api.listRuns().then(setRuns).catch(() => {});
  }, []);

  return (
    <div className="app">
      <h1>History</h1>
      <div className="card">
        {runs.length === 0 ? (
          <p className="muted">No runs yet.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Run</th><th>When</th><th>Status</th><th>Clean</th><th>Flagged</th><th>Synced</th><th>Failed</th></tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/runs/${r.id}`}>#{r.id}</Link></td>
                  <td className="muted">{new Date(r.ran_at).toLocaleString()}</td>
                  <td>
                    <StatusBadge
                      status={r.status === "committed" ? "synced" : r.status === "failed" ? "failed" : "flagged-suspicious"}
                    />
                  </td>
                  <td>{r.summary.clean}</td>
                  <td>{r.summary.flagged}</td>
                  <td>{r.summary.synced}</td>
                  <td>{r.summary.failed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
