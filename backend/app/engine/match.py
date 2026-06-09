"""Match source items by SKU across every source.

The output is one ``MatchedItem`` per distinct SKU, carrying whichever pools
contributed to it. A SKU that appears in only one source is still emitted (it
just has one empty pool) — the quality gate later decides whether a
single-source SKU is fine or worth a glance.

Duplicate SKUs *within the same source* are a data error: the matcher keeps the
first occurrence and records the duplicates so the quality gate can flag them.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .models import MatchedItem, Pool, SourceItem


@dataclass
class MatchResult:
    """Matched items plus any structural problems found while matching."""

    items: list[MatchedItem] = field(default_factory=list)
    # sku -> list of source rows that duplicated an already-seen SKU in a pool
    duplicate_skus: dict[str, list[SourceItem]] = field(default_factory=dict)
    # source items that had no SKU at all (cannot be matched)
    missing_skus: list[SourceItem] = field(default_factory=list)


def _pick_name(*items: SourceItem | None) -> str:
    """Prefer the first non-empty name across the contributing sources."""
    for item in items:
        if item and item.name:
            return item.name
    return ""


def match_by_sku(*source_lists: list[SourceItem]) -> MatchResult:
    """Group every source item by its (case-insensitive) SKU.

    Accepts any number of source lists (Excel, Shopify, future sources). Items
    are keyed by ``sku.upper()`` so matching is case-insensitive, while the
    original SKU casing from the first-seen item is preserved for display.
    """

    result = MatchResult()
    # key -> MatchedItem under construction
    by_key: dict[str, MatchedItem] = {}
    # track which pools we've already filled for a key, to catch dupes
    seen_pool: dict[tuple[str, Pool], SourceItem] = {}

    for source in source_lists:
        for item in source:
            if not item.sku:
                result.missing_skus.append(item)
                continue

            key = item.sku.upper()
            matched = by_key.get(key)
            if matched is None:
                matched = MatchedItem(sku=item.sku, name="")
                by_key[key] = matched
                result.items.append(matched)

            pool_key = (key, item.pool)
            if pool_key in seen_pool:
                # Second row for the same SKU+pool: a duplicate.
                result.duplicate_skus.setdefault(item.sku, []).append(item)
                continue
            seen_pool[pool_key] = item

            if item.pool is Pool.ONLINE:
                matched.online = item
            else:
                matched.offline = item

    # Fill in display names now that all pools are attached.
    for matched in result.items:
        matched.name = _pick_name(matched.online, matched.offline)

    return result
