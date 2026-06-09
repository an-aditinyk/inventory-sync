"""End-to-end API test: signup → settings → preview → fix → commit → history.

Uses a throwaway SQLite file so it never touches a real dev database.
"""

from __future__ import annotations

import io
import json
import os
import tempfile

import pytest

# Point the app at a temp DB before importing it.
_tmp_db = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp_db}"
os.environ["SECRET_KEY"] = "test-secret"

from fastapi.testclient import TestClient  # noqa: E402
from openpyxl import Workbook  # noqa: E402

from app.db.session import init_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    init_db()
    with TestClient(app) as c:
        yield c


def _xlsx_bytes(rows: list[tuple]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.append(["sku", "name", "quantity"])
    for r in rows:
        ws.append(list(r))
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


@pytest.fixture(scope="module")
def auth(client):
    resp = client.post(
        "/auth/signup",
        json={"email": "shop@example.com", "password": "supersecret", "name": "Shop"},
    )
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['token']}"}


def test_signup_login_me(client, auth):
    me = client.get("/auth/me", headers=auth)
    assert me.status_code == 200
    assert me.json()["email"] == "shop@example.com"

    login = client.post(
        "/auth/login", json={"email": "shop@example.com", "password": "supersecret"}
    )
    assert login.status_code == 200
    bad = client.post(
        "/auth/login", json={"email": "shop@example.com", "password": "wrong"}
    )
    assert bad.status_code == 401


def test_full_sync_flow(client, auth):
    # Tighten the "too large" threshold so we get a predictable flag.
    settings = client.get("/settings", headers=auth).json()
    settings["max_quantity"] = 100
    assert client.put("/settings", json=settings, headers=auth).status_code == 200

    excel = _xlsx_bytes(
        [
            ("MUG", "Blue Mug", 30),     # + online 50 = 80 clean
            ("BOX", "Big Box", 5),       # + online 999 = 1004 → too large
            ("PEN", "Pen", -2),          # negative → hard
        ]
    )
    shopify = json.dumps(
        [
            {"sku": "MUG", "title": "Blue Mug", "inventory_quantity": 50},
            {"sku": "BOX", "title": "Big Box", "inventory_quantity": 999},
        ]
    )

    resp = client.post(
        "/runs/preview",
        headers=auth,
        files={"excel": ("stock.xlsx", excel, "application/vnd.ms-excel")},
        data={"shopify_variants": shopify},
    )
    assert resp.status_code == 200, resp.text
    run = resp.json()
    run_id = run["id"]
    assert run["status"] == "preview"
    assert run["summary"]["clean"] == 1
    assert run["summary"]["flagged"] == 2

    items = {i["sku"]: i for i in run["items"]}
    assert items["MUG"]["status"] == "clean"
    assert items["MUG"]["combined_quantity"] == 80
    assert items["BOX"]["status"] == "flagged-suspicious"
    assert items["PEN"]["status"] == "flagged-hard"

    # Fix the negative item to a sane value → should clear to 'fixed'.
    fix = client.post(
        f"/runs/{run_id}/items/{items['PEN']['id']}/fix",
        headers=auth,
        json={"new_quantity": 12},
    )
    assert fix.status_code == 200, fix.text
    assert fix.json()["status"] == "fixed"
    assert fix.json()["final_quantity"] == 12

    # Approve the suspicious-but-fine big box as-is.
    approve = client.post(
        f"/runs/{run_id}/items/{items['BOX']['id']}/approve", headers=auth
    )
    assert approve.status_code == 200, approve.text
    assert approve.json()["status"] == "approved"

    # Commit → all three should sync.
    commit = client.post(f"/runs/{run_id}/commit", headers=auth)
    assert commit.status_code == 200, commit.text
    committed = commit.json()
    assert committed["status"] == "committed"
    assert committed["summary"]["synced"] == 3
    assert committed["summary"]["failed"] == 0

    # Fix log records the two actions.
    log = client.get(f"/runs/{run_id}/fix-log", headers=auth).json()
    actions = sorted(e["action"] for e in log)
    assert actions == ["approve", "fix"]

    # History lists the committed run.
    history = client.get("/runs", headers=auth).json()
    assert any(r["id"] == run_id and r["status"] == "committed" for r in history)


def test_hard_error_cannot_be_approved(client, auth):
    excel = _xlsx_bytes([("NEG", "Negative", -5)])
    resp = client.post(
        "/runs/preview",
        headers=auth,
        files={"excel": ("s.xlsx", excel, "application/vnd.ms-excel")},
        data={"shopify_variants": "[]"},
    )
    item = resp.json()["items"][0]
    run_id = resp.json()["id"]
    approve = client.post(
        f"/runs/{run_id}/items/{item['id']}/approve", headers=auth
    )
    assert approve.status_code == 409


def test_requires_auth(client):
    assert client.get("/runs").status_code == 401
