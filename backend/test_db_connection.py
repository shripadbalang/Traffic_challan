import os
import psycopg2
from dotenv import load_dotenv

# Load variables from .env
load_dotenv()

print("==========================================")
print("       SUPABASE DATABASE TEST")
print("==========================================")

host = os.getenv("DB_HOST")
port = os.getenv("DB_PORT")
database = os.getenv("DB_NAME")
user = os.getenv("DB_USER")
password = os.getenv("DB_PASSWORD")
sslmode = os.getenv("DB_SSLMODE", "require")

print(f"Host     : {host}")
print(f"Port     : {port}")
print(f"Database : {database}")
print(f"User     : {user}")
print(f"SSL      : {sslmode}")
print("Password : ********")
print("------------------------------------------")

try:
    print("Connecting to Supabase...")

    connection = psycopg2.connect(
        host=host,
        port=port,
        database=database,
        user=user,
        password=password,
        sslmode=sslmode,
        connect_timeout=15
    )

    print()
    print("CONNECTED SUCCESSFULLY!")
    print("Supabase PostgreSQL connection is working.")

    # Test a simple SQL query
    cursor = connection.cursor()
    cursor.execute("SELECT NOW();")

    result = cursor.fetchone()

    print(f"Database server time: {result[0]}")

    cursor.close()
    connection.close()

    print()
    print("Connection closed successfully.")

except Exception as e:
    print()
    print("DATABASE CONNECTION FAILED")
    print("------------------------------------------")
    print("Error type:", type(e).__name__)
    print("Error message:", e)