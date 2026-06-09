import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Wifi, WifiOff, CircleCheckBig, Settings2, TriangleAlert, ExternalLink } from "lucide-react";
import { Layout } from "../components/Layout";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useToast } from "../hooks/use-toast";
import { api, type Settings as SettingsModel } from "../lib/api";

const columnOptions = ["sku", "name", "quantity", "title", "price", "barcode"];

export function Settings() {
  const { toast } = useToast();
  const [shopifyConnected, setShopifyConnected] = useState(true);
  const [shopifyConnecting, setShopifyConnecting] = useState(false);
  const [destConnected, setDestConnected] = useState(false);
  const [destConnecting, setDestConnecting] = useState(false);
  const [settings, setSettings] = useState<SettingsModel | null>(null);
  const [flagLargeQty, setFlagLargeQty] = useState(false);

  useEffect(() => {
    api.getSettings().then((s) => {
      setSettings(s);
      setFlagLargeQty(s.max_swing_abs != null);
    });
    api
      .listConnections()
      .then((conns) => setDestConnected(conns.some((c) => c.type !== "shopify" && c.connected)))
      .catch(() => {});
  }, []);

  function set<K extends keyof SettingsModel>(key: K, value: SettingsModel[K]) {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
  }

  function toggleShopify() {
    if (shopifyConnected) {
      setShopifyConnected(false);
      toast({ title: "Shopify disconnected", description: "Your Shopify store has been disconnected." });
      return;
    }
    setShopifyConnecting(true);
    setTimeout(() => {
      setShopifyConnecting(false);
      setShopifyConnected(true);
      toast({ title: "Shopify connected", description: "Successfully connected (OAuth pull is stubbed)." });
    }, 1200);
  }

  async function toggleDest() {
    if (destConnected) {
      setDestConnected(false);
      toast({ title: "Destination disconnected" });
      return;
    }
    setDestConnecting(true);
    try {
      await api.connectDestination("mock");
      setDestConnected(true);
      toast({ title: "Destination connected", description: "Mock destination linked — commits will push here." });
    } catch (err) {
      toast({
        title: "Connect failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setDestConnecting(false);
    }
  }

  async function saveMapping() {
    if (!settings) return;
    try {
      await api.updateSettings(settings);
      toast({
        title: "Column mapping saved",
        description: `SKU: ${settings.excel_sku_col} · Name: ${settings.excel_name_col} · Qty: ${settings.excel_quantity_col}`,
      });
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  }

  async function saveRules() {
    if (!settings) return;
    const updated: SettingsModel = {
      ...settings,
      max_swing_abs: flagLargeQty ? settings.max_swing_abs ?? 50 : null,
    };
    try {
      await api.updateSettings(updated);
      setSettings(updated);
      toast({
        title: "Quality rules saved",
        description: flagLargeQty ? `Swing threshold: ${updated.max_swing_abs} units.` : "Swing check disabled.",
      });
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  }

  return (
    <Layout title="Settings" subtitle="Connections, column mapping, and quality rules">
      <div className="max-w-2xl space-y-6">
        <section>
          <SectionHeader icon={Wifi} title="Connections" subtitle="Manage your data source integrations" />
          <div className="space-y-3">
            <Card className="border border-border shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${shopifyConnected ? "bg-emerald-50" : "bg-slate-100"}`}>
                      {shopifyConnected ? <Wifi className="w-5 h-5 text-emerald-600" /> : <WifiOff className="w-5 h-5 text-slate-400" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Shopify</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {shopifyConnected ? "Connected to your-store.myshopify.com" : "Not connected"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {shopifyConnected && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">Connected</span>
                    )}
                    <Button size="sm" variant={shopifyConnected ? "outline" : "default"} onClick={toggleShopify} disabled={shopifyConnecting} className="gap-1.5 text-xs h-8" data-testid="button-shopify-connect">
                      {shopifyConnecting ? (
                        <>
                          <div className="w-3 h-3 rounded-full border-2 border-current/30 border-t-current animate-spin" />
                          Connecting...
                        </>
                      ) : shopifyConnected ? (
                        "Disconnect"
                      ) : (
                        <>
                          <ExternalLink className="w-3 h-3" /> Connect with Shopify
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${destConnected ? "bg-emerald-50" : "bg-slate-100"}`}>
                      {destConnected ? <CircleCheckBig className="w-5 h-5 text-emerald-600" /> : <Settings2 className="w-5 h-5 text-slate-400" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Destination (Mock / Zoho)</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {destConnected ? "Connected — commits push here (idempotent)" : "Not connected"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {destConnected && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">Connected</span>
                    )}
                    <Button size="sm" variant={destConnected ? "outline" : "default"} onClick={toggleDest} disabled={destConnecting} className="gap-1.5 text-xs h-8" data-testid="button-dest-connect">
                      {destConnecting ? (
                        <>
                          <div className="w-3 h-3 rounded-full border-2 border-current/30 border-t-current animate-spin" />
                          Connecting...
                        </>
                      ) : destConnected ? (
                        "Disconnect"
                      ) : (
                        "Connect Destination"
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {settings && (
          <>
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <SectionHeader icon={Settings2} title="Excel Column Mapping" subtitle="Which spreadsheet column means what" />
              <Card className="border border-border shadow-none">
                <CardContent className="p-5 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <MappingSelect label="SKU Column" value={settings.excel_sku_col} onChange={(v) => set("excel_sku_col", v)} testId="select-sku-col" />
                    <MappingSelect label="Product Name Column" value={settings.excel_name_col} onChange={(v) => set("excel_name_col", v)} testId="select-name-col" />
                    <MappingSelect label="Quantity Column" value={settings.excel_quantity_col} onChange={(v) => set("excel_quantity_col", v)} testId="select-qty-col" />
                  </div>
                  <div className="bg-muted/30 rounded-md px-3 py-2 border border-border text-xs text-muted-foreground">
                    Preview: rows are read as → SKU: <strong>{settings.excel_sku_col}</strong>, Name: <strong>{settings.excel_name_col}</strong>, Quantity: <strong>{settings.excel_quantity_col}</strong>
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" className="text-xs h-8" onClick={saveMapping} data-testid="button-save-mapping">Save Mapping</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.section>

            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
              <SectionHeader icon={TriangleAlert} title="Quality Rules" subtitle="Define what gets flagged during validation" />
              <Card className="border border-border shadow-none">
                <CardContent className="p-5 space-y-4">
                  <Toggle
                    title="Flag items with no product name"
                    description="Flag any SKU where no product name was found"
                    enabled={settings.flag_missing_name}
                    onToggle={() => set("flag_missing_name", !settings.flag_missing_name)}
                    testId="toggle-flag-missing"
                  />
                  <div className="border-t border-border" />
                  <Toggle
                    title="Flag large quantity swings"
                    description="Flag products whose quantity moved more than the threshold since last sync"
                    enabled={flagLargeQty}
                    onToggle={() => setFlagLargeQty((v) => !v)}
                    testId="toggle-flag-large-qty"
                  />
                  {flagLargeQty && (
                    <div className="flex items-center gap-3 pl-4">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Threshold (units)</Label>
                      <Input
                        type="number"
                        value={settings.max_swing_abs ?? 50}
                        onChange={(e) => set("max_swing_abs", e.target.value ? Number(e.target.value) : null)}
                        className="h-7 text-xs w-24"
                        min="1"
                        data-testid="input-qty-threshold"
                      />
                      <span className="text-xs text-muted-foreground">units swing triggers a flag</span>
                    </div>
                  )}
                  <div className="flex justify-end pt-1">
                    <Button size="sm" className="text-xs h-8" onClick={saveRules} data-testid="button-save-rules">Save Rules</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.section>
          </>
        )}
      </div>
    </Layout>
  );
}

function MappingSelect({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
}) {
  const options = columnOptions.includes(value) ? columnOptions : [value, ...columnOptions];
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs" data-testid={testId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: typeof Wifi; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function Toggle({
  title,
  description,
  enabled,
  onToggle,
  testId,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  testId: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={enabled}
        data-testid={testId}
        onClick={onToggle}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 mt-0.5 ${enabled ? "bg-primary" : "bg-muted"}`}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}
