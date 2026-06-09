import { useEffect, useState } from "react";
import { api, Connection, Settings } from "../api";

export function Connections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [store, setStore] = useState("");
  const [msg, setMsg] = useState("");

  const refresh = () => {
    api.listConnections().then(setConnections).catch(() => {});
    api.getSettings().then(setSettings).catch(() => {});
  };
  useEffect(refresh, []);

  const connectShopify = async () => {
    setMsg("");
    try {
      const { authorize_url } = await api.shopifyStart(store);
      // Real flow redirects to Shopify's approval screen.
      setMsg(`Would redirect to: ${authorize_url}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  };

  const connectDestination = async () => {
    setMsg("");
    try {
      await api.connectDestination("mock", null, {});
      setMsg("Destination connected (mock).");
      refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setMsg("");
    await api.updateSettings(settings);
    setMsg("Settings saved.");
  };

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setSettings((s) => s && { ...s, [k]: v });

  return (
    <div className="app">
      <h1>Connections & Settings</h1>
      {msg && <p className="muted">{msg}</p>}

      <div className="card">
        <h2>Shopify</h2>
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label>Store address</label>
            <input
              placeholder="my-store.myshopify.com"
              value={store}
              onChange={(e) => setStore(e.target.value)}
            />
          </div>
          <button className="primary" onClick={connectShopify}>
            Connect with Shopify
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Destination</h2>
        <p className="muted">
          Zoho is the first adapter. A built-in mock destination lets you try the
          full sync locally.
        </p>
        <button onClick={connectDestination}>Connect mock destination</button>
        <div style={{ marginTop: 12 }}>
          {connections.map((c) => (
            <div key={c.id} className="muted">
              <span className={`dot ${c.connected ? "green" : "red"}`} />
              {c.type} — {c.connected ? "connected" : "not connected"}
            </div>
          ))}
        </div>
      </div>

      {settings && (
        <>
          <div className="card">
            <h2>Excel column mapping</h2>
            <p className="muted">Which spreadsheet column means what.</p>
            <div className="row">
              <div className="field" style={{ flex: 1 }}>
                <label>SKU column</label>
                <input value={settings.excel_sku_col}
                  onChange={(e) => set("excel_sku_col", e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Name column</label>
                <input value={settings.excel_name_col}
                  onChange={(e) => set("excel_name_col", e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Quantity column</label>
                <input value={settings.excel_quantity_col}
                  onChange={(e) => set("excel_quantity_col", e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Quality gate thresholds</h2>
            <div className="row">
              <div className="field" style={{ flex: 1 }}>
                <label>Too large (max quantity)</label>
                <input type="number" value={settings.max_quantity ?? ""}
                  onChange={(e) => set("max_quantity", e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Big swing (% since last sync)</label>
                <input type="number" step="0.05" value={settings.max_swing_pct ?? ""}
                  onChange={(e) => set("max_swing_pct", e.target.value ? Number(e.target.value) : null)} />
              </div>
            </div>
            <label className="muted">
              <input type="checkbox" style={{ width: "auto", marginRight: 8 }}
                checked={settings.flag_missing_name}
                onChange={(e) => set("flag_missing_name", e.target.checked)} />
              Flag items with no name
            </label>
          </div>

          <button className="primary" onClick={saveSettings}>Save settings</button>
        </>
      )}
    </div>
  );
}
