// Typed client for the Inventory Sync API. Stores the session token in
// localStorage and attaches it as a bearer header on every call.

const TOKEN_KEY = "inventory-sync-token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const resp = await fetch(path, { ...init, headers });
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

// ----- Types (mirror the backend response models) -----

export type ItemStatus =
  | "clean"
  | "flagged-hard"
  | "flagged-suspicious"
  | "fixed"
  | "approved"
  | "skipped"
  | "synced"
  | "failed";

export interface AuthResponse {
  token: string;
  user_id: number;
  email: string;
  name: string;
}

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
  status: "preview" | "committed" | "failed";
  ran_at: string;
  summary: RunSummary;
  items: RunItem[];
}

export interface Connection {
  id: number;
  type: string;
  connected: boolean;
  config: Record<string, unknown>;
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

export interface FixLogEntry {
  sku: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  action: string;
  timestamp: string;
}

// ----- Endpoints -----

export const api = {
  signup: (email: string, password: string, name: string) =>
    request<AuthResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ id: number; email: string; name: string }>("/auth/me"),

  listConnections: () => request<Connection[]>("/connections"),
  connectDestination: (type: string, credentials: object | null, config: object) =>
    request<Connection>("/connections/destination", {
      method: "POST",
      body: JSON.stringify({ type, credentials, config }),
    }),
  shopifyStart: (store_url: string) =>
    request<{ authorize_url: string }>("/connections/shopify/start", {
      method: "POST",
      body: JSON.stringify({ store_url }),
    }),

  getSettings: () => request<Settings>("/settings"),
  updateSettings: (s: Settings) =>
    request<Settings>("/settings", { method: "PUT", body: JSON.stringify(s) }),

  preview: (excel: File, shopifyVariants: unknown[]) => {
    const form = new FormData();
    form.append("excel", excel);
    form.append("shopify_variants", JSON.stringify(shopifyVariants));
    return request<Run>("/runs/preview", { method: "POST", body: form });
  },
  listRuns: () => request<Run[]>("/runs"),
  getRun: (id: number) => request<Run>(`/runs/${id}`),
  fixLog: (id: number) => request<FixLogEntry[]>(`/runs/${id}/fix-log`),
  fixItem: (runId: number, itemId: number, newQuantity: number) =>
    request<RunItem>(`/runs/${runId}/items/${itemId}/fix`, {
      method: "POST",
      body: JSON.stringify({ new_quantity: newQuantity }),
    }),
  approveItem: (runId: number, itemId: number) =>
    request<RunItem>(`/runs/${runId}/items/${itemId}/approve`, { method: "POST" }),
  skipItem: (runId: number, itemId: number) =>
    request<RunItem>(`/runs/${runId}/items/${itemId}/skip`, { method: "POST" }),
  commit: (runId: number) =>
    request<Run>(`/runs/${runId}/commit`, { method: "POST" }),
};

export { ApiError };
