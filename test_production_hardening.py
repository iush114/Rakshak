import io
import json
import os
import zipfile
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_webhook.db")
os.environ.setdefault("SESSION_SECRET", "test-session-secret-for-testing")
os.environ.setdefault("GITHUB_WEBHOOK_SECRET", "test_webhook_secret_123")
os.environ.setdefault("CORS_ALLOWED_ORIGINS", "http://localhost:5173")

from app.github_service import _safe_extract
from app.github_app import get_github_app_status
from app.main import GitHubScanRequest, ScanRequest, app


client = TestClient(app)


def test_zip_path_traversal_is_blocked(tmp_path):
    archive_bytes = io.BytesIO()
    with zipfile.ZipFile(archive_bytes, "w") as archive:
        archive.writestr("../../outside.txt", "blocked")
    archive_bytes.seek(0)
    with zipfile.ZipFile(archive_bytes) as archive:
        with pytest.raises(RuntimeError, match="unsafe path"):
            _safe_extract(archive, tmp_path)
    assert not (tmp_path.parent.parent / "outside.txt").exists()


def test_input_validation_rejects_paths_and_shell_metacharacters():
    with pytest.raises(ValueError):
        ScanRequest(target_path="../../etc", code_scanning=True)
    with pytest.raises(ValueError):
        ScanRequest(target_path=".", container_scanning=True, container_image="alpine; touch pwned")
    with pytest.raises(ValueError):
        GitHubScanRequest(owner="octo/evil", repo="repo")
    with pytest.raises(ValueError):
        GitHubScanRequest(owner="octo", repo="repo", ref="feature\nmalicious")


def test_security_headers_and_cors_are_present():
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    disallowed = client.get("/health", headers={"Origin": "https://unconfigured.example"})
    assert "access-control-allow-origin" not in disallowed.headers


def test_ready_and_app_status_do_not_expose_secrets():
    ready = client.get("/ready")
    assert ready.status_code == 200
    status = get_github_app_status()
    assert "private_key" not in json.dumps(status).lower()
    assert "token" not in json.dumps(status).lower()


def test_github_repository_route_rejects_malicious_name():
    response = client.get("/api/github/repos/octo%2Fevil/repo")
    assert response.status_code in (404, 422)
