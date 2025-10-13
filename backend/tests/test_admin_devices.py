"""Tests for admin device taxonomy API."""

import pytest
from fastapi.testclient import TestClient

from app.db.models import DeviceTaxonomy


def test_list_devices_empty(client_admin):
    """Test listing devices when none exist."""
    response = client_admin.get("/v1/admin/devices")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_create_device(client_admin, test_session):
    """Test creating a new device."""
    payload = {
        "id": "smart_tv",
        "display_name_ko": "스마트 TV",
        "display_name_en": "Smart TV",
        "category": "entertainment",
    }
    response = client_admin.post("/v1/admin/devices", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["id"] == "smart_tv"
    assert data["display_name_ko"] == "스마트 TV"
    assert data["active"] is True

    # Verify in database
    device = test_session.get(DeviceTaxonomy, "smart_tv")
    assert device is not None
    assert device.display_name_ko == "스마트 TV"


def test_create_device_duplicate(client_admin, test_session):
    """Test creating duplicate device returns conflict."""
    # Create first device
    device = DeviceTaxonomy(
        id="robot_vacuum",
        display_name_ko="로봇 청소기",
        display_name_en="Robot Vacuum",
    )
    test_session.add(device)
    test_session.commit()

    # Try to create duplicate
    payload = {
        "id": "robot_vacuum",
        "display_name_ko": "다른 이름",
        "display_name_en": "Different Name",
    }
    response = client_admin.post("/v1/admin/devices", json=payload)
    assert response.status_code == 409


def test_create_device_invalid_id_format(client_admin):
    """Test creating device with invalid ID format."""
    payload = {
        "id": "Invalid-ID",  # Should be snake_case
        "display_name_ko": "테스트",
        "display_name_en": "Test",
    }
    response = client_admin.post("/v1/admin/devices", json=payload)
    assert response.status_code == 422  # Validation error


def test_update_device(client_admin, test_session):
    """Test updating an existing device."""
    # Create device
    device = DeviceTaxonomy(
        id="air_conditioner",
        display_name_ko="에어컨",
        display_name_en="Air Conditioner",
    )
    test_session.add(device)
    test_session.commit()

    # Update device
    payload = {
        "display_name_ko": "냉방기",
        "category": "cooling",
    }
    response = client_admin.put("/v1/admin/devices/air_conditioner", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["display_name_ko"] == "냉방기"
    assert data["category"] == "cooling"


def test_update_device_not_found(client_admin):
    """Test updating non-existent device."""
    payload = {"display_name_ko": "테스트"}
    response = client_admin.put("/v1/admin/devices/nonexistent", json=payload)
    assert response.status_code == 404


def test_delete_device_soft(client_admin, test_session):
    """Test soft delete (deactivate) device."""
    # Create device
    device = DeviceTaxonomy(
        id="test_device",
        display_name_ko="테스트",
        display_name_en="Test",
        active=True,
    )
    test_session.add(device)
    test_session.commit()

    # Soft delete
    response = client_admin.delete("/v1/admin/devices/test_device")
    assert response.status_code == 204

    # Verify still in DB but inactive
    device = test_session.get(DeviceTaxonomy, "test_device")
    assert device is not None
    assert device.active is False


def test_delete_device_hard(client_admin, test_session):
    """Test hard delete device."""
    # Create device
    device = DeviceTaxonomy(
        id="test_device_hard",
        display_name_ko="테스트",
        display_name_en="Test",
    )
    test_session.add(device)
    test_session.commit()

    # Hard delete
    response = client_admin.delete("/v1/admin/devices/test_device_hard?hard_delete=true")
    assert response.status_code == 204

    # Verify removed from DB
    device = test_session.get(DeviceTaxonomy, "test_device_hard")
    assert device is None


def test_list_devices_exclude_inactive(client_admin, test_session):
    """Test listing devices excludes inactive by default."""
    # Create active and inactive devices
    active = DeviceTaxonomy(id="active", display_name_ko="활성", display_name_en="Active", active=True)
    inactive = DeviceTaxonomy(id="inactive", display_name_ko="비활성", display_name_en="Inactive", active=False)
    test_session.add_all([active, inactive])
    test_session.commit()

    response = client_admin.get("/v1/admin/devices")
    assert response.status_code == 200
    data = response.json()
    device_ids = [d["id"] for d in data]
    assert "active" in device_ids
    assert "inactive" not in device_ids

    # Test with include_inactive
    response = client_admin.get("/v1/admin/devices?include_inactive=true")
    data = response.json()
    device_ids = [d["id"] for d in data]
    assert "active" in device_ids
    assert "inactive" in device_ids
