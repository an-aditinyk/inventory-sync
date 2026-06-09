"""Database tables (SQLModel) — the storage layer from the spec.

Seven tables: users, connections, sync_runs, run_items, fix_log, settings,
last_sync_quantities. Credentials are stored encrypted (see ``app.security``);
the ``*_encrypted`` columns hold ciphertext, never plaintext.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------- #
# Enums (string-valued so they read clearly in the DB and JSON)
# --------------------------------------------------------------------------- #

class ConnectionType(str, Enum):
    SHOPIFY = "shopify"
    ZOHO = "zoho"
    OTHER = "other"


class RunStatus(str, Enum):
    PREVIEW = "preview"
    COMMITTED = "committed"
    FAILED = "failed"


class FixAction(str, Enum):
    FIX = "fix"
    APPROVE = "approve"
    SKIP = "skip"


# --------------------------------------------------------------------------- #
# Tables
# --------------------------------------------------------------------------- #

class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    password_hash: str
    name: str = ""
    created_at: datetime = Field(default_factory=utcnow)


class Connection(SQLModel, table=True):
    __tablename__ = "connections"

    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="users.id", index=True)
    type: ConnectionType
    # Encrypted credential blob (OAuth token, API key, etc.).
    credentials_encrypted: Optional[str] = None
    # Non-secret config: store URL, region, etc. Stored as JSON text.
    config_json: str = "{}"
    created_at: datetime = Field(default_factory=utcnow)


class SyncRun(SQLModel, table=True):
    __tablename__ = "sync_runs"

    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="users.id", index=True)
    destination_id: Optional[int] = Field(default=None, foreign_key="connections.id")
    ran_at: datetime = Field(default_factory=utcnow)
    status: RunStatus = RunStatus.PREVIEW
    # Summary counts for history without re-aggregating run_items.
    count_clean: int = 0
    count_flagged: int = 0
    count_synced: int = 0
    count_failed: int = 0


class RunItem(SQLModel, table=True):
    __tablename__ = "run_items"

    id: Optional[int] = Field(default=None, primary_key=True)
    run_id: int = Field(foreign_key="sync_runs.id", index=True)
    sku: str = Field(index=True)
    name: str = ""
    excel_quantity: Optional[int] = None     # offline pool
    shopify_quantity: Optional[int] = None   # online pool
    combined_quantity: Optional[int] = None
    # Mirrors engine ItemStatus values.
    status: str = "clean"
    flag_reason: str = ""                     # joined plain-language reasons
    final_quantity: Optional[int] = None      # value actually used at sync time


class FixLogEntry(SQLModel, table=True):
    __tablename__ = "fix_log"

    id: Optional[int] = Field(default=None, primary_key=True)
    run_id: int = Field(foreign_key="sync_runs.id", index=True)
    sku: str = Field(index=True)
    field_changed: str = "quantity"
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    action: FixAction = FixAction.FIX
    user_id: int = Field(foreign_key="users.id")
    timestamp: datetime = Field(default_factory=utcnow)


class Setting(SQLModel, table=True):
    """Quality-gate thresholds and Excel mapping, per user (and optionally per
    connection). One row per (owner, connection) scope; connection_id NULL means
    the user-level default."""

    __tablename__ = "settings"

    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="users.id", index=True)
    connection_id: Optional[int] = Field(default=None, foreign_key="connections.id")

    # Quality thresholds
    max_quantity: Optional[int] = 10_000
    max_swing_abs: Optional[int] = None
    max_swing_pct: Optional[float] = 0.75
    flag_single_source: bool = False
    flag_missing_name: bool = True

    # Excel column mapping (which spreadsheet column means what)
    excel_sku_col: str = "sku"
    excel_name_col: str = "name"
    excel_quantity_col: str = "quantity"


class LastSyncQuantity(SQLModel, table=True):
    """sku -> last synced combined quantity, per owner. Powers the
    'big swing since last sync' check."""

    __tablename__ = "last_sync_quantities"

    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="users.id", index=True)
    sku: str = Field(index=True)
    quantity: int = 0
    updated_at: datetime = Field(default_factory=utcnow)
