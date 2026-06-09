"""Sync runs: preview → review (fix/approve/skip) → commit, plus history."""

from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlmodel import Session, select

from ..adapters import DestinationItem, MockAdapter, PushOutcome
from ..db.models import (
    Connection,
    ConnectionType,
    FixAction,
    FixLogEntry,
    RunItem,
    RunStatus,
    SyncRun,
    User,
)
from ..db.session import get_session
from ..deps import get_current_user
from ..engine import ItemStatus, regrade_quantity, run_preview
from ..engine.models import GradedItem
from ..services import (
    excel_column_map,
    last_sync_map,
    thresholds_from_settings,
    upsert_last_sync,
)
from ..sources import read_excel_source, read_shopify_source
from .connections import _get_or_create_settings

router = APIRouter(prefix="/runs", tags=["runs"])


# --------------------------------------------------------------------------- #
# Response models
# --------------------------------------------------------------------------- #

class RunItemResponse(BaseModel):
    id: int
    sku: str
    name: str
    excel_quantity: Optional[int]
    shopify_quantity: Optional[int]
    combined_quantity: Optional[int]
    final_quantity: Optional[int]
    status: str
    flag_reason: str


class RunSummaryResponse(BaseModel):
    total: int
    clean: int
    flagged: int
    synced: int
    failed: int


class RunResponse(BaseModel):
    id: int
    status: str
    ran_at: str
    summary: RunSummaryResponse
    items: list[RunItemResponse] = []


class FixLogResponse(BaseModel):
    sku: str
    field_changed: str
    old_value: Optional[str]
    new_value: Optional[str]
    action: str
    timestamp: str


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def _item_to_response(item: RunItem) -> RunItemResponse:
    return RunItemResponse(
        id=item.id,
        sku=item.sku,
        name=item.name,
        excel_quantity=item.excel_quantity,
        shopify_quantity=item.shopify_quantity,
        combined_quantity=item.combined_quantity,
        final_quantity=item.final_quantity,
        status=item.status,
        flag_reason=item.flag_reason,
    )


def _summary(session: Session, run: SyncRun) -> RunSummaryResponse:
    items = session.exec(select(RunItem).where(RunItem.run_id == run.id)).all()
    clean = sum(1 for i in items if i.status == ItemStatus.CLEAN.value)
    flagged = sum(
        1
        for i in items
        if i.status in (ItemStatus.FLAGGED_HARD.value, ItemStatus.FLAGGED_SUSPICIOUS.value)
    )
    synced = sum(1 for i in items if i.status == ItemStatus.SYNCED.value)
    failed = sum(1 for i in items if i.status == ItemStatus.FAILED.value)
    return RunSummaryResponse(
        total=len(items), clean=clean, flagged=flagged, synced=synced, failed=failed
    )


def _run_response(session: Session, run: SyncRun, *, with_items: bool = True) -> RunResponse:
    resp = RunResponse(
        id=run.id,
        status=run.status.value,
        ran_at=run.ran_at.isoformat(),
        summary=_summary(session, run),
    )
    if with_items:
        items = session.exec(
            select(RunItem).where(RunItem.run_id == run.id).order_by(RunItem.id)
        ).all()
        resp.items = [_item_to_response(i) for i in items]
    return resp


def _graded_to_runitem(run_id: int, g: GradedItem) -> RunItem:
    return RunItem(
        run_id=run_id,
        sku=g.sku,
        name=g.name,
        excel_quantity=g.offline_qty,
        shopify_quantity=g.online_qty,
        combined_quantity=g.combined_qty,
        final_quantity=g.final_quantity,
        status=g.status.value,
        flag_reason=" ".join(g.reasons),
    )


def _load_owned_run(session: Session, run_id: int, user: User) -> SyncRun:
    run = session.get(SyncRun, run_id)
    if run is None or run.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    return run


def _load_owned_item(session: Session, run: SyncRun, item_id: int) -> RunItem:
    item = session.get(RunItem, item_id)
    if item is None or item.run_id != run.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")
    return item


# --------------------------------------------------------------------------- #
# Preview
# --------------------------------------------------------------------------- #

@router.post("/preview", response_model=RunResponse)
async def create_preview(
    excel: UploadFile = File(...),
    shopify_variants: str = Form("[]"),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunResponse:
    """Upload Excel + Shopify data, run the engine, persist the run. Writes
    nothing to the destination."""

    setting = _get_or_create_settings(session, user.id)

    try:
        variants = json.loads(shopify_variants)
        assert isinstance(variants, list)
    except (json.JSONDecodeError, AssertionError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "shopify_variants must be a JSON array")

    content = await excel.read()
    try:
        offline_items = read_excel_source(content, excel_column_map(setting))
    except Exception as exc:  # noqa: BLE001 — surface a friendly parse error
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Could not read Excel file: {exc}")
    online_items = read_shopify_source(variants)

    result = run_preview(
        online_items=online_items,
        offline_items=offline_items,
        thresholds=thresholds_from_settings(setting),
        last_sync_quantities=last_sync_map(session, user.id),
    )

    run = SyncRun(owner_id=user.id, status=RunStatus.PREVIEW)
    session.add(run)
    session.commit()
    session.refresh(run)

    for graded in result.items:
        session.add(_graded_to_runitem(run.id, graded))
    run.count_clean = result.summary.clean
    run.count_flagged = result.summary.flagged
    session.add(run)
    session.commit()
    session.refresh(run)
    return _run_response(session, run)


# --------------------------------------------------------------------------- #
# History
# --------------------------------------------------------------------------- #

@router.get("", response_model=list[RunResponse])
def list_runs(
    user: User = Depends(get_current_user), session: Session = Depends(get_session)
) -> list[RunResponse]:
    runs = session.exec(
        select(SyncRun).where(SyncRun.owner_id == user.id).order_by(SyncRun.id.desc())
    ).all()
    return [_run_response(session, r, with_items=False) for r in runs]


@router.get("/{run_id}", response_model=RunResponse)
def get_run(
    run_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunResponse:
    return _run_response(session, _load_owned_run(session, run_id, user))


@router.get("/{run_id}/fix-log", response_model=list[FixLogResponse])
def get_fix_log(
    run_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[FixLogResponse]:
    _load_owned_run(session, run_id, user)
    entries = session.exec(
        select(FixLogEntry).where(FixLogEntry.run_id == run_id).order_by(FixLogEntry.id)
    ).all()
    return [
        FixLogResponse(
            sku=e.sku,
            field_changed=e.field_changed,
            old_value=e.old_value,
            new_value=e.new_value,
            action=e.action.value,
            timestamp=e.timestamp.isoformat(),
        )
        for e in entries
    ]


# --------------------------------------------------------------------------- #
# Review actions: fix / approve / skip
# --------------------------------------------------------------------------- #

class FixBody(BaseModel):
    new_quantity: int


def _log_fix(
    session: Session,
    *,
    run_id: int,
    user_id: int,
    sku: str,
    old: Optional[int],
    new: Optional[int],
    action: FixAction,
) -> None:
    session.add(
        FixLogEntry(
            run_id=run_id,
            sku=sku,
            field_changed="quantity",
            old_value=None if old is None else str(old),
            new_value=None if new is None else str(new),
            action=action,
            user_id=user_id,
        )
    )


@router.post("/{run_id}/items/{item_id}/fix", response_model=RunItemResponse)
def fix_item(
    run_id: int,
    item_id: int,
    body: FixBody,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunItemResponse:
    """Set a new quantity and re-run it through the quality gate."""
    run = _load_owned_run(session, run_id, user)
    if run.status != RunStatus.PREVIEW:
        raise HTTPException(status.HTTP_409_CONFLICT, "Run is already committed")
    item = _load_owned_item(session, run, item_id)
    setting = _get_or_create_settings(session, user.id)

    # Re-grade the new value. Build a minimal GradedItem to feed the gate.
    graded = GradedItem(
        sku=item.sku,
        name=item.name,
        online_qty=item.shopify_quantity,
        offline_qty=item.excel_quantity,
        combined_qty=item.combined_quantity,
        status=ItemStatus(item.status),
        reasons=[],
    )
    rechecked = regrade_quantity(
        graded,
        body.new_quantity,
        thresholds=thresholds_from_settings(setting),
        last_sync_quantities=last_sync_map(session, user.id),
    )

    _log_fix(
        session,
        run_id=run.id,
        user_id=user.id,
        sku=item.sku,
        old=item.final_quantity,
        new=body.new_quantity,
        action=FixAction.FIX,
    )
    item.final_quantity = rechecked.final_quantity
    item.status = rechecked.status.value
    item.flag_reason = " ".join(rechecked.reasons)
    session.add(item)
    session.commit()
    session.refresh(item)
    return _item_to_response(item)


@router.post("/{run_id}/items/{item_id}/approve", response_model=RunItemResponse)
def approve_item(
    run_id: int,
    item_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunItemResponse:
    """Approve a flagged item as-is (only valid for suspicious, not hard errors)."""
    run = _load_owned_run(session, run_id, user)
    item = _load_owned_item(session, run, item_id)
    if item.status == ItemStatus.FLAGGED_HARD.value:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Hard errors can't be approved as-is — fix or skip them.",
        )
    _log_fix(
        session, run_id=run.id, user_id=user.id, sku=item.sku,
        old=item.final_quantity, new=item.final_quantity, action=FixAction.APPROVE,
    )
    item.status = ItemStatus.APPROVED.value
    item.flag_reason = ""
    session.add(item)
    session.commit()
    session.refresh(item)
    return _item_to_response(item)


@router.post("/{run_id}/items/{item_id}/skip", response_model=RunItemResponse)
def skip_item(
    run_id: int,
    item_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunItemResponse:
    run = _load_owned_run(session, run_id, user)
    item = _load_owned_item(session, run, item_id)
    _log_fix(
        session, run_id=run.id, user_id=user.id, sku=item.sku,
        old=item.final_quantity, new=None, action=FixAction.SKIP,
    )
    item.status = ItemStatus.SKIPPED.value
    session.add(item)
    session.commit()
    session.refresh(item)
    return _item_to_response(item)


# --------------------------------------------------------------------------- #
# Commit
# --------------------------------------------------------------------------- #

@router.post("/{run_id}/commit", response_model=RunResponse)
def commit_run(
    run_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunResponse:
    """Push clean + fixed + approved items to the destination (idempotent)."""
    run = _load_owned_run(session, run_id, user)
    if run.status == RunStatus.COMMITTED:
        raise HTTPException(status.HTTP_409_CONFLICT, "Run already committed")

    items = session.exec(select(RunItem).where(RunItem.run_id == run.id)).all()
    syncable = [i for i in items if ItemStatus(i.status).will_sync]

    adapter = _resolve_destination(session, user)
    push_items = [
        DestinationItem(sku=i.sku, name=i.name, quantity=i.final_quantity or 0)
        for i in syncable
    ]
    results = {r.sku: r for r in adapter.push(push_items)}

    synced = failed = 0
    for item in syncable:
        result = results.get(item.sku)
        if result and result.ok:
            item.status = ItemStatus.SYNCED.value
            upsert_last_sync(session, user.id, item.sku, item.final_quantity or 0)
            synced += 1
        else:
            item.status = ItemStatus.FAILED.value
            item.flag_reason = result.message if result else "No result from destination"
            failed += 1
        session.add(item)

    run.status = RunStatus.FAILED if synced == 0 and failed > 0 else RunStatus.COMMITTED
    run.count_synced = synced
    run.count_failed = failed
    session.add(run)
    session.commit()
    session.refresh(run)
    return _run_response(session, run)


def _resolve_destination(session: Session, user: User):
    """Resolve the user's destination connection to an adapter.

    Falls back to the in-memory MockAdapter when no real destination is
    configured, so the full flow is exercisable locally end-to-end.
    """
    conn = session.exec(
        select(Connection).where(
            Connection.owner_id == user.id,
            Connection.type != ConnectionType.SHOPIFY,
        )
    ).first()
    if conn is None or conn.type == ConnectionType.OTHER:
        return MockAdapter()
    # Zoho would be constructed here from decrypted credentials; for now the
    # MVP commits against the mock so the flow is fully runnable.
    return MockAdapter()
