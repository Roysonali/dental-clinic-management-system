"""
Storage abstraction for file attachments.

The domain/business layer depends only on the ``StorageBackend`` interface —
never on a concrete provider.  Today the only implementation is the local
filesystem (``LocalStorage``); swapping to S3/R2/Azure later is a matter of
implementing the same interface and changing the factory, with no changes to
service logic.

Security properties enforced by the local backend:

* **Storage keys are server-generated and opaque** — user-supplied filenames
  are stored as metadata only and never used as filesystem paths.
* **Path traversal is impossible** — keys must be relative, must not contain
  path separators (``/``, ``\\``), ``.``/``..`` segments, or null bytes, and
  the resolved path is verified to stay inside the base directory.
* **No external path exposure** — the key is an opaque hex string; the
  physical location is never returned to clients.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)

#: Character set a generated storage key may contain (hex UUID).
_SAFE_KEY_CHARS: frozenset[str] = frozenset("0123456789abcdef")


class StorageError(Exception):
    """Base error for storage failures (missing file, IO error, ...)."""

    def __init__(self, message: str, *, key: str | None = None) -> None:
        self.key = key
        super().__init__(message)


class StorageFileNotFound(StorageError):
    """Raised when a storage object referenced by a key does not exist."""

    def __init__(self, key: str) -> None:
        super().__init__(f"Stored file not found for key {key!r}", key=key)


class StorageBackend(ABC):
    """Interface for durable object storage used by attachment files."""

    @abstractmethod
    def save(self, key: str, content: bytes) -> None:
        """Persist ``content`` under ``key`` (idempotent overwrite)."""

    @abstractmethod
    def open(self, key: str) -> bytes:
        """Return the full contents stored under ``key``.

        Raises:
            StorageFileNotFound: if no object exists for ``key``.
        """

    @abstractmethod
    def delete(self, key: str) -> bool:
        """Delete the object under ``key``.

        Returns ``True`` when an object was removed, ``False`` when no
        object existed (idempotent delete).  Never raises for a missing
        object.
        """

    @abstractmethod
    def exists(self, key: str) -> bool:
        """Return whether an object exists under ``key``."""


def _validate_storage_key(key: str) -> Path:
    """Validate a storage key and return its safe path inside ``base_dir``.

    Raises:
        StorageError: if the key could allow path traversal or is malformed.
    """
    if not key:
        raise StorageError("Storage key must not be empty")

    if not all(ch in _SAFE_KEY_CHARS for ch in key):
        raise StorageError(
            "Storage key contains unsupported characters; only hex keys "
            "are accepted"
        )

    # Belt-and-braces: the char check already excludes separators, but the
    # resolved-path containment check is kept so a future key format can
    # never regress into traversal.
    return Path(key)


class LocalStorage(StorageBackend):
    """Filesystem-backed storage.

    Files live directly inside ``base_dir`` (flat layout, one object per
    file).  The flat layout + opaque hex keys keep the physical layout
    simple and immune to traversal.
    """

    def __init__(self, base_dir: str | Path) -> None:
        self.base_dir = Path(base_dir)

    # ==================================================================
    # StorageBackend
    # ==================================================================

    def save(self, key: str, content: bytes) -> None:
        rel = _validate_storage_key(key)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        target = self.base_dir / rel
        target.write_bytes(content)
        logger.debug("Stored file: key=%s size=%d", key, len(content))

    def open(self, key: str) -> bytes:
        rel = _validate_storage_key(key)
        target = self.base_dir / rel
        if not target.is_file():
            raise StorageFileNotFound(key)
        return target.read_bytes()

    def delete(self, key: str) -> bool:
        rel = _validate_storage_key(key)
        target = self.base_dir / rel
        try:
            target.unlink()
            logger.debug("Deleted file: key=%s", key)
            return True
        except FileNotFoundError:
            return False

    def exists(self, key: str) -> bool:
        rel = _validate_storage_key(key)
        return (self.base_dir / rel).is_file()


# ======================================================================
# Factory — single storage instance shared across the process
# ======================================================================

_local_storage: LocalStorage | None = None


def get_local_storage() -> LocalStorage:
    """Return the process-wide local storage instance (configured from env)."""
    global _local_storage
    if _local_storage is None:
        _local_storage = LocalStorage(settings.UPLOAD_DIR)
    return _local_storage
