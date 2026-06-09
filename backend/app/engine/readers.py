"""Readers turn a raw source into the standard ``SourceItem`` shape.

A reader's only job is normalization. It does *not* decide whether a value is
"good" — that is the quality gate's job. So a reader will happily emit an item
with ``quantity=None`` or a negative number; it just records what it saw.
"""

from __future__ import annotations

from typing import Any, Iterable, Mapping, Optional, Sequence

from .models import Pool, SourceItem


def _parse_quantity(value: Any) -> Optional[int]:
    """Best-effort parse of a quantity cell into an int.

    Returns ``None`` if the value is blank or not interpretable as a whole
    number. We deliberately keep this permissive (e.g. ``"30"``, ``30.0`` and
    ``" 30 "`` all parse) and let the quality gate reject anything odd. A
    float with a fractional part is treated as unparseable, since inventory
    units are whole.
    """

    if value is None:
        return None
    if isinstance(value, bool):  # bool is a subclass of int; never a quantity
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value) if value.is_integer() else None
    text = str(value).strip()
    if text == "":
        return None
    try:
        # Allow "30.0" style strings but reject "30.5".
        as_float = float(text)
    except ValueError:
        return None
    return int(as_float) if as_float.is_integer() else None


class ExcelReader:
    """Reads offline stock from an uploaded spreadsheet.

    ``column_map`` maps the engine's logical fields to the user's actual column
    headers, e.g. ``{"sku": "Item Code", "name": "Product", "quantity": "Qty"}``.
    This mirrors the per-connection Excel mapping in settings.

    The reader is fed already-parsed rows (a list of header->value dicts) so it
    has no hard dependency on a specific spreadsheet library; the API layer is
    responsible for turning an .xlsx upload into rows.
    """

    REQUIRED_FIELDS = ("sku", "name", "quantity")

    def __init__(self, column_map: Mapping[str, str]):
        missing = [f for f in self.REQUIRED_FIELDS if f not in column_map]
        if missing:
            raise ValueError(f"column_map is missing fields: {', '.join(missing)}")
        self.column_map = dict(column_map)

    def read(self, rows: Iterable[Mapping[str, Any]]) -> list[SourceItem]:
        sku_col = self.column_map["sku"]
        name_col = self.column_map["name"]
        qty_col = self.column_map["quantity"]

        items: list[SourceItem] = []
        for index, row in enumerate(rows, start=1):
            raw_qty = row.get(qty_col)
            items.append(
                SourceItem(
                    sku=str(row.get(sku_col, "") or ""),
                    name=str(row.get(name_col, "") or "").strip(),
                    pool=Pool.OFFLINE,
                    quantity=_parse_quantity(raw_qty),
                    raw_quantity=raw_qty,
                    row=index,
                )
            )
        return items


class ShopifyReader:
    """Reads online stock from Shopify's inventory representation.

    Shopify exposes inventory per variant; each variant carries a ``sku`` and an
    ``inventory_quantity`` (summed across locations by the API layer before it
    reaches here, since the MVP treats all online stock as one pool). We accept
    a list of simplified variant dicts so the reader stays decoupled from the
    Shopify SDK / GraphQL response envelope.

    Expected variant shape::

        {"sku": "ABC-1", "title": "Blue Mug", "inventory_quantity": 50}
    """

    def __init__(
        self,
        *,
        sku_key: str = "sku",
        name_key: str = "title",
        quantity_key: str = "inventory_quantity",
    ):
        self.sku_key = sku_key
        self.name_key = name_key
        self.quantity_key = quantity_key

    def read(self, variants: Sequence[Mapping[str, Any]]) -> list[SourceItem]:
        items: list[SourceItem] = []
        for index, variant in enumerate(variants, start=1):
            raw_qty = variant.get(self.quantity_key)
            items.append(
                SourceItem(
                    sku=str(variant.get(self.sku_key, "") or ""),
                    name=str(variant.get(self.name_key, "") or "").strip(),
                    pool=Pool.ONLINE,
                    quantity=_parse_quantity(raw_qty),
                    raw_quantity=raw_qty,
                    row=index,
                )
            )
        return items
