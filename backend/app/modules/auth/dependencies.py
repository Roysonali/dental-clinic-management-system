"""
Backward-compatibility re-exports.

The authoritative ``require_admin`` dependency is now defined in
:mod:`app.modules.rbac.permissions`. This module re-exports it so that
imports from ``app.modules.auth.dependencies`` continue to work without
modification.

New code should import directly from ``app.modules.rbac.permissions``.
"""

from app.modules.rbac.permissions import require_admin  # noqa: F401

__all__ = ["require_admin"]
