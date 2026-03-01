"""
encryption.py — Encrypt/Decrypt API keys for BYOK storage
Uses Fernet symmetric encryption with a secret derived from env var.
"""

import os
import base64
import hashlib
from cryptography.fernet import Fernet

_KEY = os.getenv("ENCRYPTION_KEY", "")


def _get_fernet() -> Fernet:
    """Derive a Fernet key from the ENCRYPTION_KEY env variable."""
    secret = _KEY or "default-change-me-in-production"
    # Fernet needs 32 url-safe base64 bytes
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())
    return Fernet(key)


def encrypt_value(plain_text: str) -> str:
    """Encrypt a plaintext string, return base64 cipher."""
    f = _get_fernet()
    return f.encrypt(plain_text.encode()).decode()


def decrypt_value(cipher_text: str) -> str:
    """Decrypt a cipher string back to plaintext."""
    f = _get_fernet()
    return f.decrypt(cipher_text.encode()).decode()


def mask_key(key: str) -> str:
    """Return masked version of an API key for display (e.g., sk-***...xYz)."""
    if len(key) <= 8:
        return "****"
    return key[:4] + "****" + key[-4:]
