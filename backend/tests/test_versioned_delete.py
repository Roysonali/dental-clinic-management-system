"""
Test: Does SQLAlchemy raise ``StaleDataError`` on stale DELETE?

Scenario (real-world):
    1. Session A loads versioned row (lock_version=1).
    2. Session B loads same row, updates it (lock_version → 2), commits.
    3. Session A deletes ITS reference (which carries lock_version=1).
    4. Does A get StaleDataError, or does the delete silently do nothing?

Based on SQLAlchemy 2.x source: ``version_id_col`` adds the version to the
WHERE clause of both UPDATE and DELETE, but SQLAlchemy only *checks*
rowcount (raises ``StaleDataError``) for UPDATE — not for DELETE.

Run::

    python backend/tests/test_versioned_delete.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def test_concurrent_delete_via_session_persistence() -> None:
    """Use separate sessions to hold distinct references.

    Session A starts first, loads row (v1). Session B comes along, updates
    and commits (v2). Session A then deletes its own (now stale) reference.
    """
    from sqlalchemy import Column, Integer, String, create_engine
    from sqlalchemy.orm import declarative_base, sessionmaker
    from sqlalchemy.orm.exc import StaleDataError

    Base = declarative_base()

    class VersionedItem(Base):
        __tablename__ = "versioned_items"
        id = Column(Integer, primary_key=True)
        name = Column(String(50), nullable=False)
        lock_version = Column(Integer, nullable=False, default=1)
        __mapper_args__ = {"version_id_col": lock_version}

    engine = create_engine("sqlite://", echo=False)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)

    # --- Seed ---
    s = Session()
    s.add(VersionedItem(id=1, name="original", lock_version=1))
    s.commit()
    s.close()

    # --- Session A: loads the row (lock_version=1) ---
    session_a = Session()
    plan_a = session_a.get(VersionedItem, 1)
    assert plan_a is not None
    print(f"  [A] Loaded plan: lock_version={plan_a.lock_version}")

    # --- Session B: loads same row, updates it, commits ---
    session_b = Session()
    plan_b = session_b.get(VersionedItem, 1)
    assert plan_b is not None
    assert plan_b.lock_version == 1
    plan_b.name = "updated_by_b"
    session_b.commit()  # DB now has lock_version=2
    print(f"  [B] Updated plan: new lock_version={plan_b.lock_version}")
    session_b.close()

    # --- Session A: deletes its reference (stale lock_version=1) ---
    stale_data_error_raised = False
    try:
        session_a.delete(plan_a)
        session_a.flush()
        print(f"  [A] DELETE flush succeeded — no StaleDataError")
    except StaleDataError as e:
        stale_data_error_raised = True
        print(f"  [A] DELETE flush raised StaleDataError: {e}")

    # --- Verify: does the row still exist? ---
    session_c = Session()
    remaining = session_c.get(VersionedItem, 1)
    if remaining is not None:
        print(f"  [C] Row STILL EXISTS (lock_version={remaining.lock_version})")
        print(f"  → DELETE silently affected 0 rows")
    else:
        print(f"  [C] Row WAS DELETED")
    session_c.close()

    session_a.close()
    return stale_data_error_raised


def test_concurrent_delete_via_two_separate_sessions() -> None:
    """Each session gets a private transaction. Simulates two completely
    independent transactions by not sharing any objects.

    Session A explicitly loads the row and holds the reference.
    Session B updates and commits. A then deletes its stale reference.
    Identical to the above but with fresh sessions to prove isolation.
    """
    from sqlalchemy import Column, Integer, String, create_engine
    from sqlalchemy.orm import declarative_base, sessionmaker
    from sqlalchemy.orm.exc import StaleDataError

    Base = declarative_base()

    class VersionedItem(Base):
        __tablename__ = "versioned_items"
        id = Column(Integer, primary_key=True)
        name = Column(String(50), nullable=False)
        lock_version = Column(Integer, nullable=False, default=1)
        __mapper_args__ = {"version_id_col": lock_version}

    engine = create_engine("sqlite://", echo=False)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)

    # --- Seed ---
    s = Session()
    s.add(VersionedItem(id=1, name="original"))
    s.commit()
    s.close()

    # --- A loads in its own transaction ---
    session_a = Session()
    plan_a = session_a.get(VersionedItem, 1)
    ver_a = plan_a.lock_version

    # --- B loads, updates, commits in a different session ---
    session_b = Session()
    plan_b = session_b.get(VersionedItem, 1)
    plan_b.name = "updated"
    session_b.commit()
    session_b.close()

    # --- A deletes its stale reference ---
    stale_data_error_raised = False
    try:
        session_a.delete(plan_a)
        session_a.flush()
    except StaleDataError:
        stale_data_error_raised = True

    # --- Verify ---
    session_c = Session()
    remaining = session_c.get(VersionedItem, 1)
    session_c.close()
    session_a.close()

    print(f"  A's version at load: {ver_a}")
    print(f"  StaleDataError raised: {stale_data_error_raised}")
    print(f"  Row still exists: {remaining is not None}")
    return stale_data_error_raised, remaining is not None


if __name__ == "__main__":
    print("=" * 60)
    print("Test 1: Concurrent DELETE with stale version_id_col")
    print("(Session holds reference while another updates)")
    print("=" * 60)
    result1 = test_concurrent_delete_via_session_persistence()

    print()
    print("=" * 60)
    print("Test 2: Same scenario, separate fresh sessions")
    print("=" * 60)
    result2_stale, result2_exists = test_concurrent_delete_via_two_separate_sessions()

    print()
    print("-" * 60)
    print("FINDINGS:")
    print(f"  Test 1 (same-session reference): StaleDataError={'YES' if result1 else 'NO'}")
    print(f"  Test 2 (fresh sessions):         StaleDataError={'YES' if result2_stale else 'NO'}, Row exists={'YES' if result2_exists else 'NO'}")
    print()
    if result1 or result2_stale:
        print("CONCLUSION: StaleDataError IS raised on stale DELETE.")
        print("  → No repository code change needed.")
        print("  → Service layer can safely use delete() with version_id_col.")
    else:
        print("CONCLUSION: StaleDataError is NOT raised on stale DELETE.")
        print("  → Repository delete() silently affects 0 rows.")
        print("  → Service layer must verify deletion succeeded.")
    print("-" * 60)
