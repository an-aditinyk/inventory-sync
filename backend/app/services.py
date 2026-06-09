"""Glue between the persisted layer and the pure engine."""

from __future__ import annotations

from sqlmodel import Session, select

from .db.models import LastSyncQuantity, Setting
from .engine import QualityThresholds


def thresholds_from_settings(setting: Setting) -> QualityThresholds:
    return QualityThresholds(
        max_quantity=setting.max_quantity,
        max_swing_abs=setting.max_swing_abs,
        max_swing_pct=setting.max_swing_pct,
        flag_single_source=setting.flag_single_source,
        flag_missing_name=setting.flag_missing_name,
    )


def excel_column_map(setting: Setting) -> dict[str, str]:
    return {
        "sku": setting.excel_sku_col,
        "name": setting.excel_name_col,
        "quantity": setting.excel_quantity_col,
    }


def last_sync_map(session: Session, owner_id: int) -> dict[str, int]:
    """sku.upper() -> last synced quantity, for the swing check."""
    rows = session.exec(
        select(LastSyncQuantity).where(LastSyncQuantity.owner_id == owner_id)
    ).all()
    return {row.sku.upper(): row.quantity for row in rows}


def upsert_last_sync(session: Session, owner_id: int, sku: str, quantity: int) -> None:
    row = session.exec(
        select(LastSyncQuantity).where(
            LastSyncQuantity.owner_id == owner_id, LastSyncQuantity.sku == sku
        )
    ).first()
    if row is None:
        row = LastSyncQuantity(owner_id=owner_id, sku=sku, quantity=quantity)
    else:
        row.quantity = quantity
    session.add(row)
