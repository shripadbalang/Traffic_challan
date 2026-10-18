import os
import sys
from urllib.parse import urlparse, parse_qs
import psycopg2
from dotenv import load_dotenv

# Ensure backend root is on sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
root_dir = os.path.dirname(backend_dir)
sys.path.insert(0, backend_dir)

# Load variables from backend/.env or root .env
backend_env = os.path.join(backend_dir, ".env")
root_env = os.path.join(root_dir, ".env")
if os.path.exists(backend_env):
    load_dotenv(dotenv_path=backend_env)
elif os.path.exists(root_env):
    load_dotenv(dotenv_path=root_env)
else:
    load_dotenv()

print("=" * 60)
print("         SUPABASE DATABASE DIAGNOSTIC & HEALTH TEST")
print("=" * 60)

database_url = os.getenv("DATABASE_URL")
host = os.getenv("DB_HOST")
port = os.getenv("DB_PORT")
database = os.getenv("DB_NAME")
user = os.getenv("DB_USER")
password = os.getenv("DB_PASSWORD")
sslmode = os.getenv("DB_SSLMODE", "require")

# If individual parameters are missing but DATABASE_URL exists, parse it
if database_url and (not host or not user or not password):
    try:
        parsed = urlparse(database_url)
        host = host or parsed.hostname
        port = port or (str(parsed.port) if parsed.port else "6543")
        user = user or parsed.username
        password = password or parsed.password
        database = database or (parsed.path.lstrip("/") if parsed.path else "postgres")
        query_params = parse_qs(parsed.query)
        if "sslmode" in query_params:
            sslmode = query_params["sslmode"][0]
    except Exception as parse_err:
        print(f"[!] Warning: Could not parse DATABASE_URL: {parse_err}")

print(f"Target Host : {host}")
print(f"Target Port : {port}")
print(f"Database    : {database}")
print(f"Username    : {user}")
print(f"SSL Mode    : {sslmode}")
print(f"Password    : {'*' * 8 if password else 'NOT SET'}")
if database_url:
    masked_url = database_url
    if password and password in masked_url:
        masked_url = masked_url.replace(password, "********")
    print(f"Database URI: {masked_url}")
print("-" * 60)

# -------------------------------------------------------------
# 1. Raw Driver Connection via psycopg2
# -------------------------------------------------------------
print("\n[Step 1/2] Testing Low-Level PostgreSQL Driver (psycopg2)...")
try:
    if database_url:
        conn = psycopg2.connect(database_url, connect_timeout=15)
    else:
        conn = psycopg2.connect(
            host=host,
            port=port,
            database=database,
            user=user,
            password=password,
            sslmode=sslmode,
            connect_timeout=15,
        )

    cursor = conn.cursor()
    cursor.execute("SELECT NOW();")
    server_time = cursor.fetchone()[0]

    cursor.execute("SELECT version();")
    server_version = cursor.fetchone()[0]

    print("  [+] SUCCESS: Successfully connected to Supabase PostgreSQL!")
    print(f"  [+] Server Time   : {server_time}")
    print(f"  [+] Engine Version: {server_version.split(',')[0]}")
    cursor.close()
    conn.close()
except Exception as e:
    print("  [-] FAILED: Low-level psycopg2 connection failed!")
    print(f"  [-] Error Type   : {type(e).__name__}")
    print(f"  [-] Error Message: {e}")
    sys.exit(1)

# -------------------------------------------------------------
# 2. SQLAlchemy ORM & Schema Table Verification
# -------------------------------------------------------------
print("\n[Step 2/2] Testing SQLAlchemy ORM Engine & Schema Models...")
try:
    from app.database import engine
    from sqlalchemy import inspect, text

    with engine.connect() as db_conn:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        print(f"  [+] Connected to SQLAlchemy Engine successfully.")
        print(f"  [+] Tables found in public schema ({len(tables)}): {', '.join(sorted(tables))}")

        expected_tables = [
            "users",
            "vehicles",
            "officers",
            "violation_types",
            "challans",
            "evidence",
            "payments",
            "notifications",
            "otp_codes",
        ]

        print("\n  --- Supabase Table Row Counts ---")
        for table in expected_tables:
            if table in tables:
                cnt = db_conn.execute(text(f"SELECT count(*) FROM {table}")).scalar()
                print(f"    - {table:<16} : {cnt:>4} rows")
            else:
                print(f"    - {table:<16} : [MISSING - run db/schema.sql]")

    print("\n" + "=" * 60)
    print("  [SUCCESS] All Supabase database checks passed!")
    print("=" * 60)

except Exception as e:
    print("  [-] FAILED: SQLAlchemy ORM / Schema verification failed!")
    print(f"  [-] Error Type   : {type(e).__name__}")
    print(f"  [-] Error Message: {e}")
    sys.exit(1)