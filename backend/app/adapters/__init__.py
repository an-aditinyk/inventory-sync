"""Destination adapters. Add a new inventory app by implementing
``DestinationAdapter`` and registering it in ``get_adapter``."""

from __future__ import annotations

from .base import (
    DestinationAdapter,
    DestinationItem,
    PushOutcome,
    PushResult,
)
from .mock import MockAdapter

__all__ = [
    "DestinationAdapter",
    "DestinationItem",
    "PushOutcome",
    "PushResult",
    "MockAdapter",
    "get_adapter",
]


def get_adapter(conn_type: str, **kwargs) -> DestinationAdapter:
    """Resolve a destination type to a configured adapter instance."""
    if conn_type == "mock":
        return MockAdapter()
    if conn_type == "zoho":
        from .zoho import ZohoAdapter

        return ZohoAdapter(**kwargs)
    raise ValueError(f"Unknown destination type: {conn_type!r}")
