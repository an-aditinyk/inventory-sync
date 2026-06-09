"""Connections (Shopify / destination) and settings (thresholds + Excel mapping)."""

from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db.models import Connection, ConnectionType, Setting, User
from ..db.session import get_session
from ..deps import get_current_user
from ..security import encrypt_secret

router = APIRouter(tags=["connections"])


# --------------------------------------------------------------------------- #
# Connections
# --------------------------------------------------------------------------- #

class ConnectionResponse(BaseModel):
    id: int
    type: str
    connected: bool
    config: dict


class DestinationConnectRequest(BaseModel):
    type: str = "mock"           # "mock" | "zoho"
    credentials: Optional[dict] = None  # e.g. {"access_token": "...", "organization_id": "..."}
    config: dict = {}            # e.g. {"region": "us"}


def _to_response(conn: Connection) -> ConnectionResponse:
    return ConnectionResponse(
        id=conn.id,
        type=conn.type.value,
        connected=bool(conn.credentials_encrypted) or conn.type == ConnectionType.OTHER,
        config=json.loads(conn.config_json or "{}"),
    )


@router.get("/connections", response_model=list[ConnectionResponse])
def list_connections(
    user: User = Depends(get_current_user), session: Session = Depends(get_session)
) -> list[ConnectionResponse]:
    conns = session.exec(select(Connection).where(Connection.owner_id == user.id)).all()
    return [_to_response(c) for c in conns]


@router.post("/connections/destination", response_model=ConnectionResponse)
def connect_destination(
    body: DestinationConnectRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ConnectionResponse:
    """Save (or replace) the user's destination connection, creds encrypted."""
    try:
        conn_type = ConnectionType(body.type)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown destination type: {body.type}")

    conn = session.exec(
        select(Connection).where(
            Connection.owner_id == user.id, Connection.type == conn_type
        )
    ).first() or Connection(owner_id=user.id, type=conn_type)

    if body.credentials:
        conn.credentials_encrypted = encrypt_secret(json.dumps(body.credentials))
    conn.config_json = json.dumps(body.config or {})
    session.add(conn)
    session.commit()
    session.refresh(conn)
    return _to_response(conn)


class ShopifyConnectStartRequest(BaseModel):
    store_url: str


class ShopifyConnectStartResponse(BaseModel):
    authorize_url: str


@router.post("/connections/shopify/start", response_model=ShopifyConnectStartResponse)
def shopify_connect_start(
    body: ShopifyConnectStartRequest,
    user: User = Depends(get_current_user),
) -> ShopifyConnectStartResponse:
    """Begin the 'Connect with Shopify' OAuth flow.

    Stub: returns the URL the user would be redirected to on Shopify to approve
    the app. The real flow needs an app client id/secret and a registered
    callback that exchanges the code for a token and stores it encrypted.
    """
    store = body.store_url.replace("https://", "").replace("http://", "").strip("/")
    authorize_url = (
        f"https://{store}/admin/oauth/authorize"
        "?client_id=SHOPIFY_CLIENT_ID"
        "&scope=read_products,read_inventory"
        "&redirect_uri=http://localhost:8000/connections/shopify/callback"
        f"&state=user-{user.id}"
    )
    return ShopifyConnectStartResponse(authorize_url=authorize_url)


# --------------------------------------------------------------------------- #
# Settings (thresholds + Excel mapping)
# --------------------------------------------------------------------------- #

class SettingsBody(BaseModel):
    max_quantity: Optional[int] = 10_000
    max_swing_abs: Optional[int] = None
    max_swing_pct: Optional[float] = 0.75
    flag_single_source: bool = False
    flag_missing_name: bool = True
    excel_sku_col: str = "sku"
    excel_name_col: str = "name"
    excel_quantity_col: str = "quantity"


def _get_or_create_settings(session: Session, user_id: int) -> Setting:
    setting = session.exec(
        select(Setting).where(
            Setting.owner_id == user_id, Setting.connection_id == None  # noqa: E711
        )
    ).first()
    if setting is None:
        setting = Setting(owner_id=user_id)
        session.add(setting)
        session.commit()
        session.refresh(setting)
    return setting


@router.get("/settings", response_model=SettingsBody)
def get_settings_route(
    user: User = Depends(get_current_user), session: Session = Depends(get_session)
) -> SettingsBody:
    s = _get_or_create_settings(session, user.id)
    return SettingsBody(**{k: getattr(s, k) for k in SettingsBody.model_fields})


@router.put("/settings", response_model=SettingsBody)
def update_settings_route(
    body: SettingsBody,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> SettingsBody:
    s = _get_or_create_settings(session, user.id)
    for field, value in body.model_dump().items():
        setattr(s, field, value)
    session.add(s)
    session.commit()
    return body
