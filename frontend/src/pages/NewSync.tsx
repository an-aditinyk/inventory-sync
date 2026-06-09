import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

// Sample Shopify data so the flow is exercisable locally before the real
// OAuth pull is wired. In production this comes from the connected store.
const SAMPLE_SHOPIFY = [
  { sku: "MUG-001", title: "Blue Mug", inventory_quantity: 50 },
  { sku: "PEN-002", title: "Gel Pen", inventory_quantity: 12 },
];

export function NewSync() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [shopifyJson, setShopifyJson] = useState(
    JSON.stringify(SAMPLE_SHOPIFY, null, 2)
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!file) {
      setError("Choose an Excel file first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const variants = JSON.parse(shopifyJson);
      const result = await api.preview(file, variants);
      navigate(`/runs/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <h1>New Sync</h1>
      <p className="muted">
        Upload your offline-stock spreadsheet and pull live online stock, then
        preview before anything is written.
      </p>

      <div className="card">
        <h2>1. Offline stock (Excel)</h2>
        <input
          type="file"
          accept=".xlsx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="muted">
          Columns are read using your saved mapping (set in Connections).
        </p>
      </div>

      <div className="card">
        <h2>2. Online stock (Shopify)</h2>
        <p className="muted">
          When Shopify is connected this is pulled automatically. For now you can
          paste variant data to try the flow.
        </p>
        <textarea
          rows={8}
          style={{ width: "100%", fontFamily: "monospace", fontSize: 13 }}
          value={shopifyJson}
          onChange={(e) => setShopifyJson(e.target.value)}
        />
      </div>

      {error && <div className="error">{error}</div>}
      <button className="primary" onClick={run} disabled={busy}>
        {busy ? "Running…" : "Run preview"}
      </button>
    </div>
  );
}
