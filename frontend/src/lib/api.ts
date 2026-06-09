// Typed client for the FastAPI backend (proxied at /api in dev).
// A demo session is auto-provisioned so the SyncOps UI stays login-free while
// every call is authenticated against the real engine.

const TOKEN_KEY = "inventory-sync-token";
const DEMO_EMAIL = "demo@syncops.example";
const DEMO_PASSWORD = "syncops-demo-pw";

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  const resp = await fetch(`/api${path}`, { ...init, headers });
  if (resp.status === 401 && retry) {
    // Session missing/expired — re-provision and retry once.
    setToken(null);
    await ensureSession();
    return request<T>(path, init, false);
  }
  if (!resp.ok) {
    let detail = resp.statusText;
    try {
      detail = (await resp.json()).detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(resp.status, detail);
  }
  return resp.status === 204 ? (undefined as T) : ((await resp.json()) as T);
}

interface AuthResponse {
  token: string;
  user_id: number;
  email: string;
  name: string;
}

let sessionPromise: Promise<void> | null = null;

/** Ensure a valid bearer token exists (sign up the demo user if needed). */
export function ensureSession(): Promise<void> {
  if (getToken()) return Promise.resolve();
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    const body = JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD, name: "Demo" });
    // Try signup first; if the account already exists, fall back to login.
    let res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (res.status === 409) {
      res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
      });
    }
    if (!res.ok) throw new ApiError(res.status, "Could not establish a session");
    const data: AuthResponse = await res.json();
    setToken(data.token);
  })().finally(() => {
    sessionPromise = null;
  });
  return sessionPromise;
}

// ----- Types (mirror backend response models) -----

export type ItemStatus =
  | "clean"
  | "flagged-hard"
  | "flagged-suspicious"
  | "fixed"
  | "approved"
  | "skipped"
  | "synced"
  | "failed";

export interface RunItem {
  id: number;
  sku: string;
  name: string;
  excel_quantity: number | null;
  shopify_quantity: number | null;
  combined_quantity: number | null;
  final_quantity: number | null;
  status: ItemStatus;
  flag_reason: string;
}

export interface RunSummary {
  total: number;
  clean: number;
  flagged: number;
  synced: number;
  failed: number;
}

export interface Run {
  id: number;
  run_id: string;
  file_name: string | null;
  status: "preview" | "committed" | "failed";
  display_status: "Preview" | "Completed" | "Partial" | "Failed";
  ran_at: string;
  summary: RunSummary;
  items: RunItem[];
}

export interface FixLogEntry {
  sku: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  action: string;
  timestamp: string;
}

export interface Settings {
  max_quantity: number | null;
  max_swing_abs: number | null;
  max_swing_pct: number | null;
  flag_single_source: boolean;
  flag_missing_name: boolean;
  excel_sku_col: string;
  excel_name_col: string;
  excel_quantity_col: string;
}

export interface Connection {
  id: number;
  type: string;
  connected: boolean;
  config: Record<string, unknown>;
}

// ----- Endpoints -----

export const api = {
  ensureSession,

  listRuns: () => request<Run[]>("/runs"),
  getRun: (id: number) => request<Run>(`/runs/${id}`),
  fixLog: (id: number) => request<FixLogEntry[]>(`/runs/${id}/fix-log`),

  preview: (excel: File, shopifyVariants: unknown[]) => {
    const form = new FormData();
    form.append("excel", excel);
    form.append("shopify_variants", JSON.stringify(shopifyVariants));
    return request<Run>("/runs/preview", { method: "POST", body: form });
  },
  fixItem: (runId: number, itemId: number, newQuantity: number) =>
    request<RunItem>(`/runs/${runId}/items/${itemId}/fix`, {
      method: "POST",
      body: JSON.stringify({ new_quantity: newQuantity }),
    }),
  approveItem: (runId: number, itemId: number) =>
    request<RunItem>(`/runs/${runId}/items/${itemId}/approve`, { method: "POST" }),
  skipItem: (runId: number, itemId: number) =>
    request<RunItem>(`/runs/${runId}/items/${itemId}/skip`, { method: "POST" }),
  commit: (runId: number) => request<Run>(`/runs/${runId}/commit`, { method: "POST" }),

  listConnections: () => request<Connection[]>("/connections"),
  connectDestination: (type: string) =>
    request<Connection>("/connections/destination", {
      method: "POST",
      body: JSON.stringify({ type, credentials: null, config: {} }),
    }),

  getSettings: () => request<Settings>("/settings"),
  updateSettings: (s: Settings) =>
    request<Settings>("/settings", { method: "PUT", body: JSON.stringify(s) }),
};
