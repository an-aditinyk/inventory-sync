"""Standard shapes used throughout the engine.

Every reader normalizes its source into ``SourceItem`` objects. The matcher
groups them by SKU into ``MatchedItem`` objects. The quality gate annotates
each matched item with a status and human-readable reasons, producing a
``GradedItem``.

These are plain dataclasses with no database or framework dependencies so the
engine stays pure and trivially testable.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class Pool(str, Enum):
    """Which stock pool a quantity belongs to.

    Online and offline are *separate piles* that add together, so we keep them
    distinct all the way through combine.
    """

    ONLINE = "online"   # Shopify
    OFFLINE = "offline"  # Excel


class ItemStatus(str, Enum):
    """Lifecycle status of a single item within a run.

    Mirrors the ``run_items.status`` values in the data model.
    """

    CLEAN = "clean"
    FLAGGED_HARD = "flagged-hard"            # a real error: cannot sync as-is
    FLAGGED_SUSPICIOUS = "flagged-suspicious"  # looks off, wants a human glance
    FIXED = "fixed"
    APPROVED = "approved"
    SKIPPED = "skipped"
    SYNCED = "synced"
    FAILED = "failed"

    @property
    def is_flagged(self) -> bool:
        return self in (ItemStatus.FLAGGED_HARD, ItemStatus.FLAGGED_SUSPICIOUS)

    @property
    def will_sync(self) -> bool:
        """Statuses that are eligible to be pushed to the destination."""
        return self in (
            ItemStatus.CLEAN,
            ItemStatus.FIXED,
            ItemStatus.APPROVED,
        )


@dataclass
class SourceItem:
    """A single row read from one source, normalized to the standard shape.

    ``quantity`` may be ``None`` when the source value was missing or could not
    be parsed; the quality gate decides what that means. ``raw_quantity`` keeps
    the original cell/string so we can explain a parse failure to the user.
    """

    sku: str
    name: str
    pool: Pool
    quantity: Optional[int]
    raw_quantity: object = None  # what the source literally provided
    row: Optional[int] = None    # source row number, for error messages

    def __post_init__(self) -> None:
        # Normalize SKUs so "abc " and "ABC" match. Names are left as-is.
        self.sku = (self.sku or "").strip()


@dataclass
class MatchedItem:
    """One SKU after grouping across every source.

    ``online`` and ``offline`` hold the contributing source items (if any).
    A SKU present online-only or offline-only is still a valid matched item.
    """

    sku: str
    name: str
    online: Optional[SourceItem] = None
    offline: Optional[SourceItem] = None

    @property
    def online_qty(self) -> Optional[int]:
        return self.online.quantity if self.online else None

    @property
    def offline_qty(self) -> Optional[int]:
        return self.offline.quantity if self.offline else None


@dataclass
class GradedItem:
    """A matched item after combine + quality gate.

    ``combined_qty`` is the sum of the two pools (the value that would be
    synced). ``reasons`` are plain-language explanations attached to any flag.
    ``final_quantity`` is what will actually be used once a human has
    fixed/approved it; it starts equal to ``combined_qty``.
    """

    sku: str
    name: str
    online_qty: Optional[int]
    offline_qty: Optional[int]
    combined_qty: Optional[int]
    status: ItemStatus
    reasons: list[str] = field(default_factory=list)
    final_quantity: Optional[int] = None

    def __post_init__(self) -> None:
        if self.final_quantity is None:
            self.final_quantity = self.combined_qty
