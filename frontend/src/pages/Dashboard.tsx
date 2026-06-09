import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, Connection, Run } from "../api";
import { StatusBadge } from "../components/StatusBadge";

export function Dashboard() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<Run[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);

  useEffect(() => {
    api.listRuns().then(setRuns).catch(() => {});
    api.listConnections().then(setConnections).catch(() => {});
  }, []);

  const hasShopify = connections.some((c) => c.type === "shopify" && c.connected);
  const hasDestination = connections.some(
    (c) => c.type !== "shopify" && c.connected
  );

  return (
    <div className="app">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Dashboard</h1>
        <button className="primary" onClick={() => navigate("/sync/new")}>
          + New Sync
        </button>
      </div>

      <div className="cards">
        <div className="card" style={{ textAlign: "left" }}>
          <strong>Shopify</strong>
          <p className="muted">
            <span className={`dot ${hasShopify ? "green" : "red"}`} />
            {hasShopify ? "Connected" : "Not connected"}
          </p>
        </div>
        <div className="card" style={{ textAlign: "left" }}>
          <strong>Destination</strong>
          <p className="muted">
            <span className={`dot ${hasDestination ? "green" : "red"}`} />
            {hasDestination ? "Connected" : "Not connected"}
          </p>
        </div>
        <div className="card" style={{ textAlign: "left" }}>
          <strong>Setup</strong>
          <p className="muted">
            <Link to="/connections">Manage connections & mapping →</Link>
          </p>
        </div>
      </div>

      <div className="card">
        <h2>Recent runs</h2>
        {runs.length === 0 ? (
          <p className="muted">No runs yet. Start your first sync.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Run</th><th>When</th><th>Status</th><th>Clean</th><th>Flagged</th><th>Synced</th></tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/runs/${r.id}`}>#{r.id}</Link></td>
                  <td className="muted">{new Date(r.ran_at).toLocaleString()}</td>
                  <td><StatusBadge status={r.status === "committed" ? "synced" : r.status === "failed" ? "failed" : "flagged-suspicious"} /></td>
                  <td>{r.summary.clean}</td>
                  <td>{r.summary.flagged}</td>
                  <td>{r.summary.synced}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
