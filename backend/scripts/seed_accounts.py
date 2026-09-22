"""
Run this once after applying db/schema.sql to create working officer/admin
login accounts (since schema.sql only seeds vehicles, not hashed passwords).

Usage:
    cd backend
    python -m scripts.seed_accounts
"""
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app import models
from app.core.security import hash_password


def seed():
    db = SessionLocal()
    try:
        if not db.query(models.User).filter(models.User.email == "admin@echallan.gov.in").first():
            admin = models.User(
                full_name="System Admin",
                email="admin@echallan.gov.in",
                password_hash=hash_password("Admin@123"),
                role=models.UserRole.admin,
                is_verified=True,
            )
            db.add(admin)
            print("Created admin: admin@echallan.gov.in / Admin@123")

        if not db.query(models.User).filter(models.User.email == "officer1@echallan.gov.in").first():
            officer_user = models.User(
                full_name="Officer Ramesh Patil",
                email="officer1@echallan.gov.in",
                mobile_number="9876543210",
                password_hash=hash_password("Officer@123"),
                role=models.UserRole.officer,
                is_verified=True,
            )
            db.add(officer_user)
            db.flush()

            officer_profile = models.Officer(
                user_id=officer_user.id,
                badge_number="MH-PUN-0042",
                station="Pune City Traffic Division",
                jurisdiction="Pune",
            )
            db.add(officer_profile)
            print("Created officer: officer1@echallan.gov.in / Officer@123")

        db.commit()
        print("Seeding complete.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
