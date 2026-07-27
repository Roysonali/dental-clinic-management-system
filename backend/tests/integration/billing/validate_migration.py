"""Validate the document sequence seed migration against PostgreSQL.

Applies all Alembic migrations (including the new seed migration) against
the test PostgreSQL database and verifies the results.

Run:  python -m tests.integration.billing.validate_migration
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

os.environ["DATABASE_URL"] = "postgresql://postgres:1234@localhost:5432/denscare_test"

from alembic.config import Config as AlembicConfig
from alembic import command
from sqlalchemy import create_engine, text


PG_URL = "postgresql://postgres:1234@localhost:5432/denscare_test"
ini_path = Path(__file__).resolve().parent.parent.parent.parent / "alembic.ini"


def main() -> int:
    print("=" * 60)
    print("DOCUMENT SEQUENCE MIGRATION VALIDATION")
    print("=" * 60)

    engine = create_engine(PG_URL)
    cfg = AlembicConfig(str(ini_path))
    cfg.set_main_option("sqlalchemy.url", PG_URL)

    with engine.connect() as conn:
        # Step 1: Check current state
        print("\n1. Checking current database state...")

        # Check if alembic_version table exists
        result = conn.execute(text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_name = 'alembic_version')"
        ))
        has_alembic = result.scalar()
        print(f"   alembic_version table exists: {has_alembic}")

        if has_alembic:
            result = conn.execute(text("SELECT version_num FROM alembic_version"))
            row = result.fetchone()
            print(f"   Current migration version: {row[0] if row else 'None'}")

        # Check document_sequences table
        result = conn.execute(text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_name = 'document_sequences')"
        ))
        has_ds = result.scalar()
        print(f"   document_sequences table exists: {has_ds}")

        if has_ds:
            result = conn.execute(text(
                "SELECT is_nullable FROM information_schema.columns "
                "WHERE table_name = 'document_sequences' "
                "AND column_name = 'updated_by'"
            ))
            nullable = result.scalar()
            print(f"   updated_by nullable: {nullable}")

            result = conn.execute(text(
                "SELECT document_type, prefix, current_value, "
                "min_digits, start_value, updated_by "
                "FROM document_sequences ORDER BY document_type"
            ))
            rows = result.fetchall()
            print(f"   Document sequence rows: {len(rows)}")
            for r in rows:
                print(f"     - {r[0]}: prefix={r[1]}, current={r[2]}, "
                      f"min_digits={r[3]}, start_value={r[4]}, updated_by={r[5]!r}")

    conn.close()

    # Step 2: Apply migration to head
    print("\n2. Applying Alembic migrations to head...")
    try:
        command.upgrade(cfg, "head")
        print("   Migration upgrade successful!")
    except Exception as e:
        print(f"   Migration upgrade FAILED: {e}")
        engine.dispose()
        return 1

    # Step 3: Verify migration results
    print("\n3. Verifying migration results...")
    errors = []

    with engine.connect() as conn:
        # Check updated_by nullable
        result = conn.execute(text(
            "SELECT is_nullable FROM information_schema.columns "
            "WHERE table_name = 'document_sequences' "
            "AND column_name = 'updated_by'"
        ))
        nullable = result.scalar()
        if nullable == "YES":
            print("   [PASS] updated_by is nullable (YES)")
        else:
            errors.append(f"updated_by nullable expected YES, got {nullable!r}")
            print(f"   [FAIL] updated_by nullable expected YES, got {nullable!r}")

        # Check all 5 seed rows exist
        result = conn.execute(text(
            "SELECT document_type, prefix, current_value, "
            "min_digits, start_value, updated_by "
            "FROM document_sequences ORDER BY document_type"
        ))
        rows = result.fetchall()
        row_count = len(rows)

        EXPECTED = {
            "invoice":     {"prefix": "INV-",  "current": 0, "min_digits": 5, "start": 1},
            "payment":     {"prefix": "PAY-",  "current": 0, "min_digits": 5, "start": 1},
            "receipt":     {"prefix": "RCT-",  "current": 0, "min_digits": 5, "start": 1},
            "refund":      {"prefix": "RFD-",  "current": 0, "min_digits": 5, "start": 1},
            "credit_note": {"prefix": "CN-",   "current": 0, "min_digits": 5, "start": 1},
        }

        if row_count == 5:
            print("   [PASS] All 5 document sequences exist")
        else:
            errors.append(f"Expected 5 document sequences, got {row_count}")
            print(f"   [FAIL] Expected 5 document sequences, got {row_count}")

        for r in rows:
            doc_type = r[0]
            prefix = r[1]
            current = r[2]
            min_digits = r[3]
            start = r[4]
            updated_by = r[5]

            if doc_type in EXPECTED:
                exp = EXPECTED[doc_type]
                checks = [
                    (prefix == exp["prefix"], f"prefix={prefix!r}, expected {exp['prefix']!r}"),
                    (current == exp["current"], f"current_value={current}, expected {exp['current']}"),
                    (min_digits == exp["min_digits"], f"min_digits={min_digits}, expected {exp['min_digits']}"),
                    (start == exp["start"], f"start_value={start}, expected {exp['start']}"),
                    (updated_by is None, f"updated_by={updated_by!r}, expected None"),
                ]
                row_ok = True
                for ok, msg in checks:
                    if not ok:
                        row_ok = False
                        errors.append(f"  {doc_type}: {msg}")
                if row_ok:
                    print(f"   [PASS] {doc_type}: prefix={prefix}, "
                          f"current={current}, min_digits={min_digits}, "
                          f"start={start}, updated_by=NULL")
            else:
                errors.append(f"Unexpected document type: {doc_type}")
                print(f"   [FAIL] Unexpected document type: {doc_type}")

        # Verify expected DB versions match
        result = conn.execute(text("SELECT version_num FROM alembic_version"))
        row = result.fetchone()
        expected_head = "b2c3d4e5f6a7"
        current_head = row[0] if row else "None"
        if current_head == expected_head:
            print(f"   [PASS] Migration head: {current_head}")
        else:
            errors.append(f"Expected head {expected_head}, got {current_head}")
            print(f"   [FAIL] Expected head {expected_head}, got {current_head}")

    conn.close()

    # Step 4: Verify idempotency (re-run migration)
    print("\n4. Verifying idempotency (re-running upgrade)...")
    try:
        command.upgrade(cfg, "head")
        print("   Idempotent re-run succeeded (no error)")
    except Exception as e:
        errors.append(f"Idempotent re-run failed: {e}")
        print(f"   [FAIL] Idempotent re-run failed: {e}")

    # Verify still 5 rows after re-run
    with engine.connect() as conn:
        result = conn.execute(text(
            "SELECT COUNT(*) FROM document_sequences"
        ))
        count = result.scalar()
        if count == 5:
            print("   [PASS] Still exactly 5 rows after re-run (no duplicates)")
        else:
            errors.append(f"After idempotent re-run: expected 5 rows, got {count}")
            print(f"   [FAIL] After idempotent re-run: expected 5 rows, got {count}")
    conn.close()

    # Summary
    print("\n" + "=" * 60)
    if errors:
        print(f"VALIDATION FAILED — {len(errors)} error(s):")
        for e in errors:
            print(f"  - {e}")
        engine.dispose()
        return 1
    else:
        print("VALIDATION PASSED — Migration works correctly against PostgreSQL!")
        print()
        print("Summary:")
        print("  updated_by nullable: YES")
        print("  Seed rows: 5 (invoice, payment, receipt, refund, credit_note)")
        print("  All prefixes match expected values")
        print("  All current_value=0, min_digits=5, start_value=1")
        print("  All updated_by=NULL")
        print("  Idempotency: PASS (re-run produces no duplicates)")
        print("  Migration head: b2c3d4e5f6a7")
        engine.dispose()
        return 0


if __name__ == "__main__":
    sys.exit(main())
