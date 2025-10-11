"""Seed test users for development and testing."""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select

from app.db.models import User, UserRole
from app.db.session import SessionLocal


def seed_users():
    """Create test users: designer, writer, and admin."""

    test_users = [
        {
            "id": "designer-1",
            "role": UserRole.DESIGNER,
            "name": "Alice Kim",
            "email": "alice@company.com",
        },
        {
            "id": "writer-1",
            "role": UserRole.WRITER,
            "name": "Bob Lee",
            "email": "bob@company.com",
        },
        {
            "id": "admin-1",
            "role": UserRole.ADMIN,
            "name": "Admin",
            "email": "admin@company.com",
        },
    ]

    with SessionLocal() as session:
        created_count = 0
        updated_count = 0

        for user_data in test_users:
            # Check if user already exists
            stmt = select(User).where(User.id == user_data["id"])
            existing_user = session.execute(stmt).scalar_one_or_none()

            if existing_user:
                # Update existing user
                existing_user.role = user_data["role"]
                existing_user.name = user_data["name"]
                existing_user.email = user_data["email"]
                updated_count += 1
                print(f"Updated user: {user_data['id']} ({user_data['name']}) - {user_data['role'].value}")
            else:
                # Create new user
                user = User(**user_data)
                session.add(user)
                created_count += 1
                print(f"Created user: {user_data['id']} ({user_data['name']}) - {user_data['role'].value}")

        session.commit()

        print(f"\n✓ Seed completed: {created_count} created, {updated_count} updated")


if __name__ == "__main__":
    seed_users()
