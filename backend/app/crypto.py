import base64
import os
from secrets import token_bytes

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import get_settings


class PIIEncryptor:
    def __init__(self) -> None:
        settings = get_settings()
        if settings.encryption_kek_b64:
            key = base64.b64decode(settings.encryption_kek_b64)
        else:
            # Dev fallback key when env is not set.
            key = token_bytes(32)
        if len(key) != 32:
            raise ValueError("Encryption key must be exactly 32 bytes")
        self._aes = AESGCM(key)
        self._key_version = settings.encryption_key_version

    def encrypt(self, plaintext: str) -> str:
        nonce = os.urandom(12)
        cipher = self._aes.encrypt(nonce, plaintext.encode("utf-8"), None)
        return f"{self._key_version}:{base64.b64encode(nonce + cipher).decode('utf-8')}"

    def decrypt(self, value: str | None) -> str | None:
        if not value:
            return None
        _key_version, encoded = value.split(":", maxsplit=1)
        raw = base64.b64decode(encoded)
        nonce = raw[:12]
        cipher = raw[12:]
        plain = self._aes.decrypt(nonce, cipher, None)
        return plain.decode("utf-8")

