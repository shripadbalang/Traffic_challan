import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine
from sqlalchemy import inspect, text

inspector = inspect(engine)
print("=================== TABLES & COLUMNS ===================")
for table_name in inspector.get_table_names():
    print(f"\n--- {table_name} ---")
    for col in inspector.get_columns(table_name):
        print(f"  {col['name']}: {col['type']}")

with engine.connect() as conn:
    print("\n=================== RLS POLICIES ===================")
    policies = conn.execute(text("SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public';")).fetchall()
    if not policies:
        print("No RLS policies defined in public schema.")
    for p in policies:
        print(f"Table: {p[1]} | Policy: {p[2]} | Permissive: {p[3]} | Roles: {p[4]} | Cmd: {p[5]}")
        print(f"  Qual: {p[6]}")
        print(f"  With Check: {p[7]}")

    print("\n=================== USERS SAMPLE ===================")
    users = conn.execute(text("SELECT id, full_name, email, role, is_verified FROM users;")).fetchall()
    for u in users:
        print(u)

    print("\n=================== FUNCTIONS ===================")
    funcs = conn.execute(text("SELECT proname, prosrc FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE nspname = 'public';")).fetchall()
    for f in funcs:
        print(f"Function: {f[0]}")
        print(f"Body:\n{f[1]}")
        print("-" * 30)

    print("\n=================== SYSTEM SETTINGS ===================")
    settings = conn.execute(text("SELECT * FROM system_settings;")).fetchall()
    for s in settings:
        print(s)

    print("\n=================== AUDIT LOGS COUNT ===================")
    audit_count = conn.execute(text("SELECT count(*) FROM audit_logs;")).scalar()
    print("Audit log count:", audit_count)

    print("\n=================== ADMIN CREDENTIALS CHECK ===================")
    from app.core.security import verify_password
    row = conn.execute(text("SELECT id, full_name, email, password_hash, role, is_verified FROM users WHERE email = 'admin@echallan.gov.in';")).first()
    print("Admin row:", row)
    if row and row[3]:
        print("Password matches Admin@123:", verify_password("Admin@123", row[3]))


