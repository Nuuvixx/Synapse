"""
Tests for Synapse API
"""
import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app


@pytest.fixture
def client():
    """Create a test client"""
    return TestClient(app)


class TestHealthCheck:
    """Tests for health check endpoint"""
    
    def test_health_check(self, client):
        """Test that health check returns 200"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data


class TestAPI:
    """Tests for main API endpoint"""
    
    def test_api_root(self, client):
        """Test API root returns service info"""
        response = client.get("/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "Synapse API"


class TestAuth:
    """Tests for authentication endpoints"""
    
    def test_register_missing_fields(self, client):
        """Test registration fails with missing fields"""
        response = client.post("/api/auth/register", json={})
        assert response.status_code == 422  # Validation error


class TestItems:
    """Tests for items endpoints"""
    
    def test_get_items(self, client):
        """Test getting items list"""
        response = client.get("/api/items")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
