# Inventory Sync

Reconcile **offline stock (Excel)** and **online stock (Shopify)** into a single
on-hand count per SKU, review anything that looks wrong, then push clean numbers
to a destination inventory app (Zoho first; any app later).

- **Sources:** Excel (offline pile) + Shopify (online pile). Matched by **SKU**.
- **Combine:** the two piles are separate, so quantities **add**
  (30 offline + 50 online = 80 on hand).
- **Quality gate:** flags errors (negative/unreadable/duplicate/no-SKU) and
  suspicious values (too large, big swing since last sync) with plain-language
  reasons.
- **Preview is read-only.** Nothing is written until you click **Sync**, and
  re-syncing is idempotent (no duplicates).
- Every fix is **logged** and applies to that sync only — it never writes back
  to the source.

## Architecture

```
frontend (React + Vite + TS)
        │  REST + bearer token
        ▼
backend (FastAPI)
  ├── engine/      pure logic: readers → match → combine → quality gate
  ├── db/          SQLModel tables (users, connections, sync_runs,
  │                run_items, fix_log, settings, last_sync_quantities)
  ├── adapters/    pluggable destinations (mock, zoho stub)
  └── api/         auth, connections, runs
```

The **engine** has zero web/DB/vendor dependencies, so the core logic is fully
unit-tested in isolation (`backend/tests/test_engine.py`).

## Running locally

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload         # http://localhost:8000  (docs at /docs)
```

A SQLite database (`inventory_sync.db`) is created automatically on startup.

### Frontend

```bash
cd frontend
npm install
npm run dev                           # http://localhost:5173
```

The dev server proxies `/auth`, `/runs`, `/connections`, `/settings` to the
backend on :8000.

### Tests

```bash
cd backend && source .venv/bin/activate
pytest                                # 28 tests: engine + full API flow
```

## The flow

1. **Sign up / log in** (email + password).
2. **Connections** — connect Shopify (OAuth, stubbed), connect a destination
   (a built-in **mock** lets you run the whole thing locally), set the Excel
   column mapping and quality-gate thresholds.
3. **New Sync** — upload Excel, provide Shopify data, **Run preview**.
4. **Review & fix** — for each flagged item: **fix** (re-checked through the
   gate), **approve** as-is (suspicious only), or **skip**. Every action is
   written to the fix log.
5. **Sync** — clean + fixed + approved items are pushed to the destination
   (create if new, update if existing). `last_sync_quantities` is updated to
   power the next run's swing check.
6. **History** — every run with its items and full fix log.

## Status colors

🟢 green = clean / done · 🟡 amber = flagged (needs a glance) · 🔴 red = error.

## What's stubbed (next session's runway)

- **Shopify OAuth callback** — `/connections/shopify/start` returns the authorize
  URL; the token-exchange callback and live inventory pull are not wired.
  `read_shopify_source` already accepts the final variant shape, so the live
  pull plugs straight in.
- **Zoho adapter** — interface + region hosts are in place; the create/update
  HTTP calls are `NotImplementedError`. Commit currently runs against the mock
  destination so the end-to-end flow is exercisable.
- **Later features** (from the spec): scheduled syncing, webhooks, low-stock
  alerts, discrepancy dashboard, notifications, roles, multi-store.
