"""Sprint 12A.3.1 — OpenAPI Audit Script (ASCII-safe)."""

import json, sys
from fastapi import FastAPI
from app.modules.billing.routers import billing_router

app = FastAPI(title="DensCare Audit")
app.include_router(billing_router)
schema = app.openapi()

AUTH_USER_ID_FIELDS = {
    "created_by", "updated_by", "changed_by", "reviewed_by", "printed_by",
    "issued_by", "cancelled_by", "approved_by", "generated_by", "processed_by",
}

TRANSITION_SCHEMAS = [
    "InvoiceStatusTransitionResponse", "PaymentStatusTransitionResponse",
    "ReceiptStatusTransitionResponse", "RefundStatusTransitionResponse",
    "ReceiptPrintMetadata",
]

READ_SCHEMAS = [
    "InvoiceRead", "PaymentRead", "ReceiptRead", "RefundRead", "CreditNoteRead",
]

issues = []
comps = schema.get("components", {}).get("schemas", {})

def ok(msg):
    print(f"  [OK] {msg}")

def fail(msg):
    print(f"  [FAIL] {msg}")
    issues.append(msg)

def check_field_type(schema_name, field_name, field_def):
    """Check that a field's type is integer (or nullable integer)."""
    ftype = field_def.get("type")
    if ftype == "integer":
        return True
    # Handle nullable: oneOf with type "null" and type "integer"
    one_of = field_def.get("oneOf", [])
    types = [s.get("type") for s in one_of if s.get("type")]
    if "integer" in types:
        return True
    fail(f"{schema_name}.{field_name}: type='{ftype}' (expected integer)")
    return False

# --- 1. CreatorSummary ---
print("--- CreatorSummary ---")
if "CreatorSummary" in comps:
    cs_id = comps["CreatorSummary"].get("properties", {}).get("id", {})
    check_field_type("CreatorSummary", "id", cs_id)
    examples = cs_id.get("examples", [])
    for ex in examples:
        if isinstance(ex, int):
            ok(f"CreatorSummary.id example={ex} is integer")
        else:
            fail(f"CreatorSummary.id example={ex} is not integer")
else:
    fail("CreatorSummary not found in OpenAPI schema")

# --- 2. Read schemas with AuditMixin ---
print("--- Read Schema Audit Fields ---")
for name in READ_SCHEMAS:
    if name not in comps:
        continue
    props = comps[name].get("properties", {})
    for field in ["created_by", "updated_by"]:
        if field in props:
            check_field_type(name, field, props[field])

# --- 3. Transition / Metadata schemas ---
print("--- Transition & Metadata Fields ---")
for name in TRANSITION_SCHEMAS:
    if name not in comps:
        continue
    props = comps[name].get("properties", {})
    for field in ["changed_by", "printed_by", "reviewed_by"]:
        if field in props:
            check_field_type(name, field, props[field])

# --- 4. Example payload audit ---
print("--- Example Payload Audit ---")
for name, comp_schema in comps.items():
    if "properties" not in comp_schema:
        continue
    for field_name, field_def in comp_schema["properties"].items():
        if field_name not in AUTH_USER_ID_FIELDS:
            continue
        examples = field_def.get("examples", [])
        for ex in examples:
            if isinstance(ex, str) and len(ex) == 36 and ex.count("-") == 4:
                fail(f"{name}.{field_name}: example='{ex}' looks like UUID, expected int")
        example = field_def.get("example", None)
        if isinstance(example, str) and len(example) == 36 and example.count("-") == 4:
            fail(f"{name}.{field_name}: example='{example}' looks like UUID, expected int")

# --- 5. Endpoint enumeration ---
print("--- Billing Endpoints ---")
billing_paths = [(p, m) for p, m in schema["paths"].items() if p.startswith("/billing")]
for path, methods in sorted(billing_paths):
    for method, details in methods.items():
        tags = details.get("tags", [])
        summary = details.get("summary", "")
        print(f"  {method.upper():6s} {path:45s} [{', '.join(tags)}]")

print(f"\n  Total billing endpoints: {len(billing_paths)}")

# --- Summary ---
print("=" * 60)
if issues:
    print(f"ISSUES FOUND: {len(issues)}")
    for i in issues:
        print(f"  {i}")
    sys.exit(1)
else:
    print("ALL CHECKS PASSED - No Auth user ID type issues found")
    sys.exit(0)
