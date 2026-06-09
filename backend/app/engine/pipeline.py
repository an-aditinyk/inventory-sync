"""The run-preview orchestrator: raw sources in, graded items + summary out.

This is the single entry point the API layer calls for a preview. It writes
nothing to the destination — it only reads, matches, combines, and grades. The
caller is responsible for persisting the returned items and summary.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Mapping, Optional

from .match import match_by_sku
from .models import GradedItem, ItemStatus, SourceItem
from .quality import QualityThresholds, grade_matched, graded_from_duplicate


@dataclass
class RunSummary:
    """Headline counts for the preview screen's summary cards."""

    total: int = 0
    clean: int = 0
    flagged_hard: int = 0
    flagged_suspicious: int = 0

    @property
    def flagged(self) -> int:
        return self.flagged_hard + self.flagged_suspicious

    @property
    def will_sync(self) -> int:
        """Items eligible to sync right now (clean only, before any fixes)."""
        return self.clean


@dataclass
class PreviewResult:
    items: list[GradedItem] = field(default_factory=list)
    summary: RunSummary = field(default_factory=RunSummary)


def run_preview(
    *,
    online_items: list[SourceItem],
    offline_items: list[SourceItem],
    thresholds: Optional[QualityThresholds] = None,
    last_sync_quantities: Optional[Mapping[str, int]] = None,
) -> PreviewResult:
    """Match → combine → grade the two source pools into a preview.

    ``online_items`` and ``offline_items`` are already-normalized ``SourceItem``
    lists (produced by the readers). Returns graded items plus summary counts.
    """

    thresholds = thresholds or QualityThresholds.defaults()
    match_result = match_by_sku(online_items, offline_items)

    items: list[GradedItem] = [
        grade_matched(
            matched,
            thresholds=thresholds,
            last_sync_quantities=last_sync_quantities,
        )
        for matched in match_result.items
    ]

    # Surface structural problems found during matching as hard-flagged items.
    for sku, dupes in match_result.duplicate_skus.items():
        for dupe in dupes:
            items.append(graded_from_duplicate(dupe, sku))

    for orphan in match_result.missing_skus:
        items.append(
            GradedItem(
                sku="",
                name=orphan.name,
                online_qty=orphan.quantity if orphan.pool.value == "online" else None,
                offline_qty=orphan.quantity if orphan.pool.value == "offline" else None,
                combined_qty=None,
                status=ItemStatus.FLAGGED_HARD,
                reasons=[
                    f"A {orphan.pool.value} row (row {orphan.row}) has no SKU, "
                    f"so it can't be matched or synced."
                ],
            )
        )

    summary = _summarize(items)
    return PreviewResult(items=items, summary=summary)


def _summarize(items: list[GradedItem]) -> RunSummary:
    summary = RunSummary(total=len(items))
    for item in items:
        if item.status is ItemStatus.CLEAN:
            summary.clean += 1
        elif item.status is ItemStatus.FLAGGED_HARD:
            summary.flagged_hard += 1
        elif item.status is ItemStatus.FLAGGED_SUSPICIOUS:
            summary.flagged_suspicious += 1
    return summary
