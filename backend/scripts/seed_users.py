#!/usr/bin/env python3
"""Seed test users for development and testing."""

import sys
from pathlib import Path

# Add backend to path
backend_root = Path(__file__).parent.parent
sys.path.insert(0, str(backend_root))

from app.db import session_scope, models


def seed_test_users():
    """Create test users for development."""
    users = [
        models.User(
            id="designer-1",
            role=models.UserRole.DESIGNER,
            name="Test Designer",
            email="designer@example.com"
        ),
        models.User(
            id="writer-1",
            role=models.UserRole.WRITER,
            name="Test Writer",
            email="writer@example.com"
        ),
        models.User(
            id="admin-1",
            role=models.UserRole.ADMIN,
            name="Test Admin",
            email="admin@example.com"
        ),
    ]
    
    with session_scope() as session:
        for user in users:
            session.merge(user)
        print(f"Seeded {len(users)} test users")


if __name__ == "__main__":
    seed_test_users()