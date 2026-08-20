"""
Unit tests for the LocalStorage storage backend.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

import pytest

from app.core.storage import (
    LocalStorage,
    StorageError,
    StorageFileNotFound,
)


@pytest.fixture
def storage(tmp_path: Path) -> LocalStorage:
    return LocalStorage(tmp_path / "uploads")


class TestLocalStorage:
    def test_save_open_round_trip(self, storage: LocalStorage):
        storage.save("abc123", b"file content")
        assert storage.open("abc123") == b"file content"
        assert storage.exists("abc123") is True

    def test_save_creates_base_dir_lazily(self, tmp_path: Path):
        base = tmp_path / "a" / "b" / "c"
        storage = LocalStorage(base)
        storage.save("abc123", b"x")
        assert base.is_dir()
        assert (base / "abc123").read_bytes() == b"x"

    def test_delete_removes_object(self, storage: LocalStorage):
        storage.save("abc123", b"x")
        assert storage.delete("abc123") is True
        assert storage.exists("abc123") is False

    def test_delete_missing_is_idempotent(self, storage: LocalStorage):
        assert storage.delete("a" * 32) is False

    def test_open_missing_raises(self, storage: LocalStorage):
        with pytest.raises(StorageFileNotFound):
            storage.open("a" * 32)

    def test_overwrite_is_allowed(self, storage: LocalStorage):
        storage.save("abc123", b"old")
        storage.save("abc123", b"new")
        assert storage.open("abc123") == b"new"

    def test_path_traversal_keys_are_rejected(self, storage: LocalStorage):
        for evil in [
            "../escape",
            "..",
            ".",
            "",
            "a/b",
            "a\\b",
            "/absolute",
            "..\\..\\etc\\passwd",
            "a b",
            "key\x00nul",
            "UPPER",
        ]:
            with pytest.raises(StorageError):
                storage.save(evil, b"x")
            with pytest.raises(StorageError):
                storage.open(evil)
            with pytest.raises(StorageError):
                storage.delete(evil)

    def test_never_writes_outside_base_dir(self, tmp_path: Path):
        base = tmp_path / "uploads"
        outside = tmp_path / "outside"
        storage = LocalStorage(base)
        storage.save("a" * 32, b"content")
        # Only the opaque key file exists inside base; nothing leaked out.
        assert list(base.iterdir()) == [base / ("a" * 32)]
        assert not outside.exists()
