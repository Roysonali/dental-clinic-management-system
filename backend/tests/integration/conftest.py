"""Root conftest for integration tests.

Registers custom markers and provides shared configuration.
"""

import pytest


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "postgres: marks tests that require a real PostgreSQL database"
    )


def pytest_collection_modifyitems(config, items):
    """Skip postgres-marked tests if PG is not available."""
    try:
        import psycopg2
        conn = psycopg2.connect(
            "postgresql://postgres:1234@localhost:5432/denscare_test"
        )
        conn.close()
        pg_available = True
    except Exception:
        pg_available = False

    if not pg_available:
        skip_postgres = pytest.mark.skip(
            reason="PostgreSQL not available at localhost:5432"
        )
        for item in items:
            if "postgres" in item.keywords:
                item.add_marker(skip_postgres)
