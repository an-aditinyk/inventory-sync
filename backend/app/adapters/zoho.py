"""Zoho Inventory adapter — the first real destination.

Stubbed for now: the HTTP calls to Zoho's Items API are sketched but not wired,
since live calls need real OAuth credentials and a region host. The shape is
what matters — it shows exactly where a real implementation slots in behind the
``DestinationAdapter`` interface without the rest of the app changing.

Zoho specifics to fill in later:
* Auth: OAuth2 refresh-token flow; region picks the host
  (``www.zohoapis.com`` / ``.eu`` / ``.in`` / ``.com.au``).
* Upsert: look up the item by SKU, then POST (create) or PUT (update) its
  ``stock_on_hand`` / ``initial_stock``.
"""

from __future__ import annotations

from typing import Sequence

from .base import DestinationItem, DestinationAdapter, PushOutcome, PushResult

_REGION_HOSTS = {
    "us": "https://www.zohoapis.com",
    "eu": "https://www.zohoapis.eu",
    "in": "https://www.zohoapis.in",
    "au": "https://www.zohoapis.com.au",
}


class ZohoAdapter(DestinationAdapter):
    type = "zoho"

    def __init__(self, *, access_token: str, organization_id: str, region: str = "us"):
        self.access_token = access_token
        self.organization_id = organization_id
        self.host = _REGION_HOSTS.get(region, _REGION_HOSTS["us"])

    def test_connection(self) -> bool:
        # TODO: GET {host}/inventory/v1/organizations and check the token works.
        raise NotImplementedError("Zoho live connection not yet implemented")

    def push(self, items: Sequence[DestinationItem]) -> list[PushResult]:
        # TODO: per item, find by SKU then create/update stock_on_hand.
        raise NotImplementedError("Zoho push not yet implemented")
