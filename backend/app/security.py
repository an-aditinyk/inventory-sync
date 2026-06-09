"""Password hashing, credential encryption, and session tokens.

Kept dependency-light on purpose: passwords use PBKDF2 from the stdlib (no
native bcrypt build needed for local dev), credentials are encrypted with
Fernet (AES) so secrets are never stored in plaintext, and session tokens are
signed with an itsdangerous serializer.

NOTE: the encryption key is derived from ``SECRET_KEY``. Rotating that key makes
existing encrypted credentials unreadable — fine for local dev, but a real
deployment should manage a dedicated, stable key.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from .config import get_settings

_PBKDF2_ROUNDS = 240_000


# --------------------------------------------------------------------------- #
# Passwords
# --------------------------------------------------------------------------- #

def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ROUNDS)
    return f"pbkdf2_sha256${_PBKDF2_ROUNDS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, rounds, salt_hex, hash_hex = stored.split("$")
        assert algo == "pbkdf2_sha256"
        dk = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), int(rounds)
        )
        return hmac.compare_digest(dk.hex(), hash_hex)
    except (ValueError, AssertionError):
        return False


# --------------------------------------------------------------------------- #
# Credential encryption
# --------------------------------------------------------------------------- #

def _fernet() -> Fernet:
    # Derive a stable 32-byte key from the configured secret.
    digest = hashlib.sha256(get_settings().secret_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_secret(ciphertext: Optional[str]) -> Optional[str]:
    if not ciphertext:
        return None
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        return None


# --------------------------------------------------------------------------- #
# Session tokens
# --------------------------------------------------------------------------- #

def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(get_settings().secret_key, salt="session")


def create_session_token(user_id: int) -> str:
    return _serializer().dumps({"uid": user_id})


def read_session_token(token: str) -> Optional[int]:
    try:
        data = _serializer().loads(token, max_age=get_settings().token_ttl_seconds)
        return int(data["uid"])
    except (BadSignature, SignatureExpired, KeyError, ValueError):
        return None
