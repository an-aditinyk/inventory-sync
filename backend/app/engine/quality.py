"""The quality gate: grade each matched item clean / flagged, with reasons.

Two tiers of flag:

* **flagged-hard** — a genuine error; the item *cannot* be synced as-is
  (unreadable or negative quantity, duplicate SKU). Needs a fix.
* **flagged-suspicious** — the value is usable but looks off and deserves a
  human glance (too large, big swing since last sync, missing name). Can be
  approved as-is.

Every flag carries a plain-language reason a non-technical shop owner can read.

The same checks power two moments:

1. The initial preview, via :func:`grade_matched`.
2. The re-check after a human fixes a value, via :func:`regrade_quantity` —
   a fixed item runs back through the gate and only clears if it now passes.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, Optional

from .combine import combine_quantity
from .match import MatchResult
from .models import GradedItem, ItemStatus, MatchedItem, Pool


@dataclass
class QualityThresholds:
    """Tunable rules for the gate (persisted per user/connection in settings).

    A ``None`` threshold disables that check. Swing is checked against the last
    synced quantity for the SKU; both an absolute and a percentage trigger are
    supported and either one firing flags the item.
    """

    max_quantity: Optional[int] = None          # "too large" on-hand count
    max_swing_abs: Optional[int] = None          # absolute change since last sync
    max_swing_pct: Optional[float] = None        # e.g. 0.5 == a 50% change
    flag_single_source: bool = False             # SKU present in only one pool
    flag_missing_name: bool = True               # no product name anywhere

    @classmethod
    def defaults(cls) -> "QualityThresholds":
        """Sensible starting rules; the UI lets the user adjust these."""
        return cls(
            max_quantity=10_000,
            max_swing_abs=None,
            max_swing_pct=0.75,
            flag_single_source=False,
            flag_missing_name=True,
        )


@dataclass
class _Reasons:
    hard: list[str]
    suspicious: list[str]

    def status(self) -> ItemStatus:
        if self.hard:
            return ItemStatus.FLAGGED_HARD
        if self.suspicious:
            return ItemStatus.FLAGGED_SUSPICIOUS
        return ItemStatus.CLEAN

    def all(self) -> list[str]:
        return self.hard + self.suspicious


def _evaluate_quantity(
    quantity: Optional[int],
    *,
    last_qty: Optional[int],
    thresholds: QualityThresholds,
) -> _Reasons:
    """Checks that apply to a single resolved quantity (combined or fixed)."""

    hard: list[str] = []
    suspicious: list[str] = []

    if quantity is None:
        hard.append("Quantity couldn't be read as a whole number.")
        return _Reasons(hard, suspicious)

    if quantity < 0:
        hard.append(f"Quantity is negative ({quantity}).")
        return _Reasons(hard, suspicious)

    if thresholds.max_quantity is not None and quantity > thresholds.max_quantity:
        suspicious.append(
            f"On-hand quantity ({quantity}) is above the 'too large' "
            f"threshold ({thresholds.max_quantity})."
        )

    if last_qty is not None:
        change = quantity - last_qty
        magnitude = abs(change)
        direction = "up" if change > 0 else "down"
        if thresholds.max_swing_abs is not None and magnitude > thresholds.max_swing_abs:
            suspicious.append(
                f"Quantity moved {direction} by {magnitude} since last sync "
                f"({last_qty} → {quantity}), more than the allowed swing "
                f"of {thresholds.max_swing_abs}."
            )
        elif (
            thresholds.max_swing_pct is not None
            and last_qty > 0
            and magnitude / last_qty > thresholds.max_swing_pct
        ):
            pct = round(magnitude / last_qty * 100)
            suspicious.append(
                f"Quantity moved {direction} {pct}% since last sync "
                f"({last_qty} → {quantity})."
            )

    return _Reasons(hard, suspicious)


def grade_matched(
    matched: MatchedItem,
    *,
    thresholds: QualityThresholds,
    last_sync_quantities: Optional[Mapping[str, int]] = None,
) -> GradedItem:
    """Combine the pools and grade the matched item for the preview."""

    last_sync_quantities = last_sync_quantities or {}
    combined = combine_quantity(matched)
    last_qty = last_sync_quantities.get(matched.sku.upper())

    reasons = _evaluate_quantity(
        combined, last_qty=last_qty, thresholds=thresholds
    )

    # Structural checks that only make sense on the matched item itself.
    if thresholds.flag_missing_name and not matched.name:
        reasons.suspicious.append("No product name was found for this SKU.")

    if thresholds.flag_single_source and (
        matched.online is None or matched.offline is None
    ):
        present = "online (Shopify)" if matched.online else "offline (Excel)"
        reasons.suspicious.append(
            f"SKU appears in only one source ({present})."
        )

    # If the combine itself failed, name which pool was unreadable for clarity.
    if combined is None:
        bad_pool = (
            "online (Shopify)"
            if matched.online and matched.online.quantity is None
            else "offline (Excel)"
        )
        raw = (
            matched.online.raw_quantity
            if bad_pool.startswith("online")
            else matched.offline.raw_quantity
        )
        reasons.hard = [
            f"Quantity from {bad_pool} couldn't be read as a whole "
            f"number (got '{raw}')."
        ]

    return GradedItem(
        sku=matched.sku,
        name=matched.name,
        online_qty=matched.online_qty,
        offline_qty=matched.offline_qty,
        combined_qty=combined,
        status=reasons.status(),
        reasons=reasons.all(),
    )


def regrade_quantity(
    item: GradedItem,
    new_quantity: int,
    *,
    thresholds: QualityThresholds,
    last_sync_quantities: Optional[Mapping[str, int]] = None,
) -> GradedItem:
    """Re-run the gate against a human-supplied value (the fix re-check).

    Returns a new ``GradedItem`` whose ``final_quantity`` is ``new_quantity``.
    If it now passes, status becomes ``FIXED``; if it still looks wrong it stays
    flagged with fresh reasons.
    """

    last_sync_quantities = last_sync_quantities or {}
    last_qty = last_sync_quantities.get(item.sku.upper())
    reasons = _evaluate_quantity(
        new_quantity, last_qty=last_qty, thresholds=thresholds
    )
    status = ItemStatus.FIXED if reasons.status() is ItemStatus.CLEAN else reasons.status()
    return GradedItem(
        sku=item.sku,
        name=item.name,
        online_qty=item.online_qty,
        offline_qty=item.offline_qty,
        combined_qty=item.combined_qty,
        status=status,
        reasons=reasons.all(),
        final_quantity=new_quantity,
    )


def graded_from_duplicate(item, original_sku: str) -> GradedItem:
    """Build a hard-flagged GradedItem for a duplicate-SKU source row."""
    return GradedItem(
        sku=original_sku,
        name=item.name,
        online_qty=item.quantity if item.pool is Pool.ONLINE else None,
        offline_qty=item.quantity if item.pool is Pool.OFFLINE else None,
        combined_qty=None,
        status=ItemStatus.FLAGGED_HARD,
        reasons=[
            f"SKU '{original_sku}' appears more than once in the "
            f"{item.pool.value} source (row {item.row}); only one row per SKU "
            f"is allowed."
        ],
    )
