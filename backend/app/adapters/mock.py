"""An in-memory destination used for local development and tests.

Behaves like a real destination: idempotent upserts keyed by SKU, so re-running
a sync never creates duplicates. Inspect ``store`` to see what was pushed.
"""

from __future__ import annotations

from typing import Sequence

from .base import DestinationItem, DestinationAdapter, PushOutcome, PushResult


class MockAdapter(DestinationAdapter):
    type = "mock"

    def __init__(self) -> None:
        # sku -> quantity, the destination's current state.
        self.store: dict[str, int] = {}

    def test_connection(self) -> bool:
        return True

    def push(self, items: Sequence[DestinationItem]) -> list[PushResult]:
        results: list[PushResult] = []
        for item in items:
            existed = item.sku in self.store
            self.store[item.sku] = item.quantity  # upsert: create or update
            results.append(
                PushResult(
                    sku=item.sku,
                    outcome=PushOutcome.UPDATED if existed else PushOutcome.CREATED,
                )
            )
        return results
