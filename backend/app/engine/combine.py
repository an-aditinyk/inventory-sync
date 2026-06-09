"""Combine the two stock pools into a single on-hand quantity.

Online and offline are separate piles, so the combined quantity is simply their
sum (e.g. 30 offline + 50 online = 80 on hand). A pool that is absent
contributes nothing; a pool present but with an *unparseable* quantity makes the
whole combine indeterminate (``None``), which the quality gate treats as a hard
error rather than silently assuming zero.
"""

from __future__ import annotations

from typing import Optional

from .models import MatchedItem


def combine_quantity(matched: MatchedItem) -> Optional[int]:
    """Return online_qty + offline_qty, treating a *missing* pool as 0.

    Returns ``None`` when a pool is present (the SKU exists in that source) but
    its quantity could not be parsed — we must not invent a number for stock we
    failed to read. Distinguishing "pool absent" (fine, contributes 0) from
    "pool present but unreadable" (not fine) is the whole point of this function.
    """

    total = 0

    if matched.online is not None:
        if matched.online.quantity is None:
            return None
        total += matched.online.quantity

    if matched.offline is not None:
        if matched.offline.quantity is None:
            return None
        total += matched.offline.quantity

    return total
