"""The pluggable destination interface.

A destination is anything we can push final quantities into (Zoho first, any
inventory app later). Adapters must be **idempotent**: pushing the same SKU
twice updates rather than duplicating — create if the SKU is new, update if it
exists. The engine and API depend only on this interface, never on a vendor SDK.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Protocol, Sequence


@dataclass
class DestinationItem:
    """One SKU + final quantity to push to the destination."""

    sku: str
    name: str
    quantity: int


class PushOutcome(str, Enum):
    CREATED = "created"
    UPDATED = "updated"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class PushResult:
    sku: str
    outcome: PushOutcome
    message: str = ""

    @property
    def ok(self) -> bool:
        return self.outcome in (PushOutcome.CREATED, PushOutcome.UPDATED)


class DestinationAdapter(Protocol):
    """Implement this to add a new destination.

    ``test_connection`` lets the UI show a green/red connection status.
    ``push`` performs the idempotent upsert and returns a per-item result.
    """

    type: str

    def test_connection(self) -> bool: ...

    def push(self, items: Sequence[DestinationItem]) -> list[PushResult]: ...
