import sys
import os
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine
from sqlalchemy import text
import json


def sync():
    now = datetime.now(timezone.utc)
    with engine.begin() as conn:
        # Get all citizen/owner users from public.users
        users = conn.execute(
            text("SELECT id, email, full_name, mobile_number, role FROM public.users WHERE role IN ('citizen', 'owner')")
        ).mappings().fetchall()

        # Get existing auth.users emails and ids
        auth_users = conn.execute(text("SELECT id, email FROM auth.users")).mappings().fetchall()
        auth_emails = {u["email"].lower(): u["id"] for u in auth_users if u["email"]}
        auth_ids = {u["id"] for u in auth_users}

        users_to_sync = list(users)

        # Also add shripadbalang@gmail.com alias if shripatbalang exists
        shripat = next((u for u in users if u["email"] == "shripatbalang@gmail.com"), None)
        if shripat and "shripadbalang@gmail.com" not in auth_emails:
            users_to_sync.append({
                "id": uuid.uuid4(),
                "email": "shripadbalang@gmail.com",
                "full_name": shripat["full_name"],
                "mobile_number": shripat["mobile_number"],
                "role": "citizen"
            })

        for u in users_to_sync:
            u_email = (u["email"] or "").strip().lower()
            if not u_email:
                continue

            if u_email in auth_emails:
                print(f"Skipping already synced: {u_email}")
                continue

            u_id = u["id"]
            if u_id in auth_ids:
                u_id = uuid.uuid4()

            meta = {
                "sub": str(u_id),
                "email": u_email,
                "full_name": u["full_name"],
                "mobile_number": u["mobile_number"],
                "role": "owner",
                "email_verified": True,
                "phone_verified": False,
            }
            app_meta = {"provider": "email", "providers": ["email"]}

            # Insert into auth.users
            conn.execute(
                text("""
                    INSERT INTO auth.users (
                        instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at, is_sso_user, is_anonymous
                    ) VALUES (
                        '00000000-0000-0000-0000-000000000000', :id, 'authenticated', 'authenticated',
                        :email, '$2a$10$NXpskYztT45FHEkgswGfn.MkILLK1IXIJzV7/it84Bo2tVDPFF24e',
                        :confirmed_at, :app_meta, :meta,
                        :created_at, :updated_at, false, false
                    )
                """),
                {
                    "id": u_id,
                    "email": u_email,
                    "confirmed_at": now,
                    "app_meta": json.dumps(app_meta),
                    "meta": json.dumps(meta),
                    "created_at": now,
                    "updated_at": now,
                }
            )

            # Insert into auth.identities
            conn.execute(
                text("""
                    INSERT INTO auth.identities (
                        id, provider_id, user_id, identity_data, provider,
                        last_sign_in_at, created_at, updated_at
                    ) VALUES (
                        gen_random_uuid(), :provider_id, :user_id, :meta, 'email',
                        :now, :now, :now
                    )
                """),
                {
                    "provider_id": str(u_id),
                    "user_id": u_id,
                    "meta": json.dumps(meta),
                    "now": now,
                }
            )

            print(f"Synced user into auth.users: {u_email} ({u['full_name']})")

    print("Sync complete.")


if __name__ == "__main__":
    sync()
