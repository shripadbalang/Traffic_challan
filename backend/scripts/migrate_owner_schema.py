import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sqlalchemy as sa
from app.database import engine

def run_migration():
    print("[*] Running Owner Dashboard Schema Migration...")
    with engine.connect() as conn:
        # 1. Add 'owner' to user_role enum if not present
        try:
            conn.execute(sa.text("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner';"))
            conn.commit()
            print("  [+] Added 'owner' to user_role enum.")
        except Exception as e:
            print(f"  [!] Note on user_role enum: {e}")

        # 2. Add registered_mobile to vehicles if not present
        try:
            conn.execute(sa.text("ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS registered_mobile VARCHAR;"))
            conn.commit()
            print("  [+] Added registered_mobile column to vehicles table.")
        except Exception as e:
            print(f"  [!] Note on registered_mobile: {e}")

        # 3. Add email column to otp_codes if not present, and attempts integer
        try:
            conn.execute(sa.text("ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS email VARCHAR;"))
            conn.execute(sa.text("ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS attempts INT DEFAULT 0;"))
            conn.commit()
            print("  [+] Added email and attempts columns to otp_codes table.")
        except Exception as e:
            print(f"  [!] Note on otp_codes columns: {e}")

        # 4. Set registered_mobile on existing vehicles
        conn.execute(sa.text("""
            UPDATE vehicles SET registered_mobile = '7001336011' WHERE plate_number IN ('MH37AB0949', 'MH27BU6590') AND registered_mobile IS NULL;
            UPDATE vehicles SET registered_mobile = '9307716594' WHERE plate_number = 'MH37AB0940' AND registered_mobile IS NULL;
            UPDATE vehicles SET registered_mobile = '7385553065' WHERE plate_number = 'MH28AT2037' AND registered_mobile IS NULL;
        """))
        conn.commit()

        # 5. Insert test/demo vehicles into RTO registry if not already present
        # MH27XY1234 and MH31CD5678 as mentioned in prompt
        conn.execute(sa.text("""
            INSERT INTO vehicles (plate_number, vehicle_type, model, rto_code, registered_mobile)
            VALUES 
                ('MH27XY1234', 'motorcycle', 'Yamaha FZ-S', 'MH27', '7001336011'),
                ('MH31CD5678', 'car', 'Maruti Suzuki Baleno', 'MH31', '7001336011'),
                ('MH12AB1234', 'motorcycle', 'Honda Activa 6G', 'MH12', '9822012345')
            ON CONFLICT (plate_number) DO UPDATE 
            SET registered_mobile = EXCLUDED.registered_mobile;
        """))
        conn.commit()

        # 6. Ensure challans exist for MH27XY1234 and MH37AB0949 matching prompt specs if needed
        # Check violation types
        vt_helmet = conn.execute(sa.text("SELECT id FROM violation_types WHERE code = 'NO_HELMET'")).scalar()
        vt_triple = conn.execute(sa.text("SELECT id FROM violation_types WHERE code = 'TRIPLE_RIDING'")).scalar()
        vt_wrong = conn.execute(sa.text("SELECT id FROM violation_types WHERE code = 'WRONG_SIDE_DRIVING'")).scalar()

        v_mh27xy = conn.execute(sa.text("SELECT id FROM vehicles WHERE plate_number = 'MH27XY1234'")).scalar()
        v_mh37ab = conn.execute(sa.text("SELECT id FROM vehicles WHERE plate_number = 'MH37AB0949'")).scalar()

        if v_mh27xy and vt_wrong:
            # Check if challan exists
            ch_exists = conn.execute(sa.text(f"SELECT id FROM challans WHERE vehicle_id = '{v_mh27xy}'")).first()
            if not ch_exists:
                conn.execute(sa.text(f"""
                    INSERT INTO challans (vehicle_id, violation_type_id, detection_source, fine_amount, status, location)
                    VALUES ('{v_mh27xy}', '{vt_wrong}', 'ai', 1000.00, 'pending', 'Amravati Road, Wardha')
                """))
                conn.commit()
                print("  [+] Added demo challan for MH27XY1234.")

        if v_mh37ab and vt_triple:
            # Check if triple riding challan exists
            ch_exists = conn.execute(sa.text(f"SELECT id FROM challans WHERE vehicle_id = '{v_mh37ab}' AND violation_type_id = '{vt_triple}'")).first()
            if not ch_exists:
                conn.execute(sa.text(f"""
                    INSERT INTO challans (vehicle_id, violation_type_id, detection_source, fine_amount, status, location)
                    VALUES ('{v_mh37ab}', '{vt_triple}', 'ai', 1000.00, 'paid', 'Washim Naka, Akola')
                """))
                conn.commit()
                print("  [+] Added paid demo challan for MH37AB0949.")

        print("[+] Migration finished successfully!")

if __name__ == "__main__":
    run_migration()
