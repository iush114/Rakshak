"""
test_github_app.py
==================
Tests for Phase 4 — GitHub App Authentication & Installation Access Tokens.

Covers:
  1.  Missing GITHUB_APP_ID error handling
  2.  Missing GITHUB_APP_PRIVATE_KEY error handling
  3.  Valid RS256 JWT creation
  4.  JWT contains correct issuer (App ID)
  5.  JWT has short expiration and clock skew tolerance
  6.  Installation token success (HTTP 201)
  7.  GitHub HTTP 401 error handling
  8.  GitHub HTTP 403 error handling
  9.  GitHub HTTP 404 error handling
  10. GitHub HTTP 422 error handling
  11. GitHub HTTP 429 error handling
  12. GitHub HTTP 5xx error handling
  13. Network failure (URLError) error handling
  14. Timeout error handling
  15. Installation ID extraction from push payload
  16. Installation ID extraction from PR payload
  17. Webhook scan receives installation ID in background task
  18. Installation token is used for repository download
  19. Check Run uses installation token when available
  20. GITHUB_CHECK_RUN_TOKEN fallback still works when no installation ID
  21. OAuth-based repository scanning still works (manual scan regression)
  22. Security: private key never included in exception strings
  23. Security: installation token / JWT never returned from API endpoint
  24. Security: safe app status endpoint (GET /api/github/app/status)
  25. Security: malformed / missing installation ID handled safely
"""

import hashlib
import hmac
import json
import os
import time
import urllib.error
from unittest.mock import MagicMock, patch

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Set test environment variables BEFORE any application imports
# ---------------------------------------------------------------------------
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_webhook.db")
os.environ.setdefault("GITHUB_WEBHOOK_SECRET", "test_webhook_secret_123")
os.environ.setdefault("SESSION_SECRET", "test-session-secret-for-testing")

from app.github_app import (
    GitHubAppConfigError,
    GitHubAppError,
    generate_github_app_jwt,
    get_github_app_status,
    get_installation_access_token,
    is_github_app_configured,
    load_github_app_config,
)
from app.github_webhook import (
    extract_pull_request_event_metadata,
    extract_push_event_metadata,
)
from app.main import app
from app.scan_service import run_github_repository_scan

# Generate ephemeral test RSA key once
_TEST_KEY_OBJ = rsa.generate_private_key(public_exponent=65537, key_size=2048)
TEST_RSA_PRIVATE_KEY_PEM = _TEST_KEY_OBJ.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption(),
).decode("utf-8")

TEST_APP_ID = "123456"
TEST_SECRET = "test_webhook_secret_123"


def _make_signature(body: bytes) -> str:
    digest = hmac.new(
        key=TEST_SECRET.encode("utf-8"),
        msg=body,
        digestmod=hashlib.sha256,
    ).hexdigest()
    return f"sha256={digest}"


# ===========================================================================
# 1. Configuration & Missing Env Tests
# ===========================================================================


class TestGitHubAppConfig:
    def test_missing_app_id_raises_config_error(self, monkeypatch):
        monkeypatch.setenv("GITHUB_APP_ID", "")
        monkeypatch.setenv("GITHUB_APP_PRIVATE_KEY", TEST_RSA_PRIVATE_KEY_PEM)

        with pytest.raises(GitHubAppConfigError) as exc:
            load_github_app_config()
        assert "GITHUB_APP_ID" in str(exc.value)

    def test_missing_private_key_raises_config_error(self, monkeypatch):
        monkeypatch.setenv("GITHUB_APP_ID", TEST_APP_ID)
        monkeypatch.setenv("GITHUB_APP_PRIVATE_KEY", "")

        with pytest.raises(GitHubAppConfigError) as exc:
            load_github_app_config()
        assert "GITHUB_APP_PRIVATE_KEY" in str(exc.value)

    def test_valid_config_loaded(self, monkeypatch):
        monkeypatch.setenv("GITHUB_APP_ID", TEST_APP_ID)
        monkeypatch.setenv("GITHUB_APP_PRIVATE_KEY", TEST_RSA_PRIVATE_KEY_PEM)
        monkeypatch.setenv("GITHUB_APP_NAME", "Rakshak Security App")

        app_id, key, name = load_github_app_config()
        assert app_id == TEST_APP_ID
        assert "BEGIN PRIVATE KEY" in key
        assert name == "Rakshak Security App"

    def test_key_from_file_path(self, monkeypatch, tmp_path):
        key_file = tmp_path / "app_key.pem"
        key_file.write_text(TEST_RSA_PRIVATE_KEY_PEM, encoding="utf-8")

        monkeypatch.setenv("GITHUB_APP_ID", TEST_APP_ID)
        monkeypatch.setenv("GITHUB_APP_PRIVATE_KEY", str(key_file))

        _, key, _ = load_github_app_config()
        assert "BEGIN PRIVATE KEY" in key

    def test_is_github_app_configured(self, monkeypatch):
        monkeypatch.setenv("GITHUB_APP_ID", "")
        monkeypatch.setenv("GITHUB_APP_PRIVATE_KEY", "")
        assert is_github_app_configured() is False

        monkeypatch.setenv("GITHUB_APP_ID", TEST_APP_ID)
        monkeypatch.setenv("GITHUB_APP_PRIVATE_KEY", TEST_RSA_PRIVATE_KEY_PEM)
        assert is_github_app_configured() is True


# ===========================================================================
# 2. JWT Generation Tests
# ===========================================================================


class TestGitHubAppJWT:
    def test_jwt_generation_valid(self, monkeypatch):
        monkeypatch.setenv("GITHUB_APP_ID", TEST_APP_ID)
        monkeypatch.setenv("GITHUB_APP_PRIVATE_KEY", TEST_RSA_PRIVATE_KEY_PEM)

        token = generate_github_app_jwt()
        assert isinstance(token, str)
        assert len(token.split(".")) == 3  # Header.Payload.Signature

    def test_jwt_contains_correct_issuer(self, monkeypatch):
        monkeypatch.setenv("GITHUB_APP_ID", TEST_APP_ID)
        monkeypatch.setenv("GITHUB_APP_PRIVATE_KEY", TEST_RSA_PRIVATE_KEY_PEM)

        token = generate_github_app_jwt()
        # Decode without verification to inspect claims
        claims = jwt.decode(token, options={"verify_signature": False})
        assert claims["iss"] == TEST_APP_ID

    def test_jwt_has_short_expiration_and_clock_skew(self, monkeypatch):
        monkeypatch.setenv("GITHUB_APP_ID", TEST_APP_ID)
        monkeypatch.setenv("GITHUB_APP_PRIVATE_KEY", TEST_RSA_PRIVATE_KEY_PEM)

        now = int(time.time())
        token = generate_github_app_jwt()
        claims = jwt.decode(token, options={"verify_signature": False})

        # iat is roughly 60s in the past
        assert claims["iat"] <= now
        assert claims["iat"] >= now - 70

        # exp is roughly 9 minutes (540s) from now
        assert claims["exp"] > now
        assert claims["exp"] <= now + 600

    def test_invalid_key_raises_error(self, monkeypatch):
        monkeypatch.setenv("GITHUB_APP_ID", TEST_APP_ID)
        monkeypatch.setenv("GITHUB_APP_PRIVATE_KEY", "NOT_A_VALID_PEM_KEY")

        with pytest.raises(GitHubAppError):
            generate_github_app_jwt()


# ===========================================================================
# 3. Installation Token HTTP Handling Tests
# ===========================================================================


class TestInstallationAccessToken:
    def test_get_installation_token_success(self, monkeypatch):
        monkeypatch.setenv("GITHUB_APP_ID", TEST_APP_ID)
        monkeypatch.setenv("GITHUB_APP_PRIVATE_KEY", TEST_RSA_PRIVATE_KEY_PEM)

        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps({
            "token": "ghs_test_installation_token_12345",
            "expires_at": "2026-09-16T15:00:00Z",
        }).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp

        with patch("urllib.request.urlopen", return_value=mock_resp):
            token = get_installation_access_token(98765)
            assert token == "ghs_test_installation_token_12345"

    @pytest.mark.parametrize("status_code", [401, 403, 404, 422, 429, 500, 503])
    def test_get_installation_token_http_errors(self, monkeypatch, status_code):
        monkeypatch.setenv("GITHUB_APP_ID", TEST_APP_ID)
        monkeypatch.setenv("GITHUB_APP_PRIVATE_KEY", TEST_RSA_PRIVATE_KEY_PEM)

        http_error = urllib.error.HTTPError(
            url="https://api.github.com/app/installations/123/access_tokens",
            code=status_code,
            msg=f"HTTP {status_code}",
            hdrs={},
            fp=MagicMock(read=MagicMock(return_value=b'{"message": "error"}')),
        )

        with patch("urllib.request.urlopen", side_effect=http_error):
            with pytest.raises(GitHubAppError) as exc:
                get_installation_access_token(123)
            assert f"HTTP {status_code}" in str(exc.value)

    def test_get_installation_token_network_error(self, monkeypatch):
        monkeypatch.setenv("GITHUB_APP_ID", TEST_APP_ID)
        monkeypatch.setenv("GITHUB_APP_PRIVATE_KEY", TEST_RSA_PRIVATE_KEY_PEM)

        url_error = urllib.error.URLError("DNS resolution failure")
        with patch("urllib.request.urlopen", side_effect=url_error):
            with pytest.raises(GitHubAppError) as exc:
                get_installation_access_token(123)
            assert "Network error" in str(exc.value)

    def test_zero_or_negative_installation_id(self):
        with pytest.raises(GitHubAppError):
            get_installation_access_token(0)


# ===========================================================================
# 4. Webhook Payload Metadata Extraction Tests
# ===========================================================================


class TestWebhookInstallationExtraction:
    def test_push_extracts_installation_id(self):
        payload = {
            "ref": "refs/heads/main",
            "repository": {"name": "test-repo", "owner": {"login": "octocat"}},
            "installation": {"id": 112233},
        }
        metadata = extract_push_event_metadata(payload, "del-1")
        assert metadata.get("installation_id") == 112233

    def test_push_without_installation_id(self):
        payload = {
            "ref": "refs/heads/main",
            "repository": {"name": "test-repo", "owner": {"login": "octocat"}},
        }
        metadata = extract_push_event_metadata(payload, "del-2")
        assert metadata.get("installation_id") is None

    def test_pr_extracts_installation_id(self):
        payload = {
            "action": "opened",
            "number": 42,
            "pull_request": {
                "head": {"sha": "abcd1234", "ref": "feat-1"},
                "base": {"ref": "main"},
            },
            "repository": {"name": "test-repo", "owner": {"login": "octocat"}},
            "installation": {"id": 998877},
        }
        metadata = extract_pull_request_event_metadata(payload, "del-3")
        assert metadata.get("installation_id") == 998877

    def test_pr_without_installation_id(self):
        payload = {
            "action": "opened",
            "number": 42,
            "pull_request": {
                "head": {"sha": "abcd1234", "ref": "feat-1"},
                "base": {"ref": "main"},
            },
            "repository": {"name": "test-repo", "owner": {"login": "octocat"}},
        }
        metadata = extract_pull_request_event_metadata(payload, "del-4")
        assert metadata.get("installation_id") is None


# ===========================================================================
# 5. Integration in Scan Pipeline & Token Priority
# ===========================================================================


class TestScanPipelineInstallationToken:
    def test_installation_token_used_for_download_and_checks(self, monkeypatch):
        monkeypatch.setenv("GITHUB_APP_ID", TEST_APP_ID)
        monkeypatch.setenv("GITHUB_APP_PRIVATE_KEY", TEST_RSA_PRIVATE_KEY_PEM)

        # Mock get_installation_access_token
        fake_inst_token = "ghs_installation_token_xyz"
        mock_get_token = MagicMock(return_value=fake_inst_token)

        # Mock download_repository
        mock_temp = MagicMock()
        mock_download = MagicMock(return_value=(mock_temp, "/tmp/fake_repo"))

        # Mock Check Runs
        mock_create_cr = MagicMock(return_value=999)
        mock_complete_cr = MagicMock()

        # Mock Scanners
        mock_db = MagicMock()

        with patch("app.scan_service.get_installation_access_token", mock_get_token), \
             patch("app.scan_service.download_repository", mock_download), \
             patch("app.scan_service.create_check_run", mock_create_cr), \
             patch("app.scan_service.complete_check_run", mock_complete_cr), \
             patch("app.scan_service.run_code_scan", return_value=[]), \
             patch("app.scan_service.run_dependency_scan", return_value=[]), \
             patch("app.scan_service.run_secret_scan", return_value=[]):

            scan_id = run_github_repository_scan(
                db=mock_db,
                owner="octocat",
                repo="hello-world",
                ref="abcd1234",
                access_token=None,  # Webhook scan has no OAuth token
                installation_id=45678,
                pr_head_sha="abcd1234",
            )

            # Assert installation token was generated
            mock_get_token.assert_called_once_with(45678)

            # Assert installation token was passed to download_repository
            mock_download.assert_called_once_with(fake_inst_token, "octocat", "hello-world", "abcd1234")

            # Assert installation token was used to create and complete check run
            mock_create_cr.assert_called_once_with(
                owner="octocat",
                repo="hello-world",
                head_sha="abcd1234",
                access_token=fake_inst_token,
            )
            mock_complete_cr.assert_called_once()
            assert mock_complete_cr.call_args[1]["access_token"] == fake_inst_token

    def test_github_check_run_token_env_fallback_when_no_installation_id(self, monkeypatch):
        monkeypatch.setenv("GITHUB_CHECK_RUN_TOKEN", "ghp_env_check_token_fallback")

        mock_temp = MagicMock()
        mock_download = MagicMock(return_value=(mock_temp, "/tmp/fake_repo"))
        mock_create_cr = MagicMock(return_value=123)
        mock_complete_cr = MagicMock()
        mock_db = MagicMock()

        with patch("app.scan_service.download_repository", mock_download), \
             patch("app.scan_service.create_check_run", mock_create_cr), \
             patch("app.scan_service.complete_check_run", mock_complete_cr), \
             patch("app.scan_service.run_code_scan", return_value=[]), \
             patch("app.scan_service.run_dependency_scan", return_value=[]), \
             patch("app.scan_service.run_secret_scan", return_value=[]):

            run_github_repository_scan(
                db=mock_db,
                owner="octocat",
                repo="hello-world",
                ref="abcd1234",
                access_token=None,
                installation_id=None,
                pr_head_sha="abcd1234",
            )

            # Env token fallback used for check run
            mock_create_cr.assert_called_once_with(
                owner="octocat",
                repo="hello-world",
                head_sha="abcd1234",
                access_token="ghp_env_check_token_fallback",
            )


# ===========================================================================
# 6. Webhook Background Task Receives Installation ID
# ===========================================================================


# Phase 11A: webhook scans are only queued when the installation/repository is
# associated with a Rakshak workspace. Seed the mappings for the test payloads.
from conftest import ensure_webhook_workspace  # noqa: E402

ensure_webhook_workspace(
    installation_ids=(556677, 778899),
    repository_full_name="octocat/rakshak-private",
    login="webhook-test-octocat",
)


class TestWebhookPassesInstallationId:
    _DELIVERY_IDS = ["del-push-inst-1", "del-pr-inst-1"]

    def setup_method(self, method):
        """Reset delivery dedup state before each test."""
        import app.main as main_module
        from app.database import SessionLocal
        from app.models import GitHubWebhookDelivery

        if hasattr(main_module, "_processed_deliveries"):
            main_module._processed_deliveries = set()

        db = SessionLocal()
        try:
            db.query(GitHubWebhookDelivery).filter(
                GitHubWebhookDelivery.delivery_id.in_(self._DELIVERY_IDS)
            ).delete(synchronize_session=False)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()

    def test_push_webhook_queues_with_installation_id(self):
        client = TestClient(app)
        payload = {
            "ref": "refs/heads/main",
            "after": "c0ffee1234",
            "repository": {
                "name": "rakshak-private",
                "full_name": "octocat/rakshak-private",
                "owner": {"login": "octocat"},
            },
            "commits": [{"id": "c0ffee1234"}],
            "installation": {"id": 556677},
        }
        body = json.dumps(payload).encode("utf-8")
        sig = _make_signature(body)

        mock_task = MagicMock()
        mock_task.id = "task-push-1"
        with patch("app.main.run_github_repository_scan_task.delay", return_value=mock_task) as mock_task_delay:
            res = client.post(
                "/api/github/webhook",
                content=body,
                headers={
                    "X-GitHub-Event": "push",
                    "X-Hub-Signature-256": sig,
                    "X-GitHub-Delivery": "del-push-inst-1",
                    "Content-Type": "application/json",
                },
            )
            assert res.status_code in (200, 202)
            assert res.json()["scan_queued"] is True

            # Verify task was queued with installation_id=556677
            mock_task_delay.assert_called_once()
            kwargs = mock_task_delay.call_args[1]
            assert kwargs.get("installation_id") == 556677

    def test_pr_webhook_queues_with_installation_id(self):
        client = TestClient(app)
        payload = {
            "action": "opened",
            "number": 10,
            "pull_request": {
                "head": {"sha": "sha999", "ref": "feature-x"},
                "base": {"ref": "main"},
            },
            "repository": {
                "name": "rakshak-private",
                "full_name": "octocat/rakshak-private",
                "owner": {"login": "octocat"},
            },
            "installation": {"id": 778899},
        }
        body = json.dumps(payload).encode("utf-8")
        sig = _make_signature(body)

        mock_task = MagicMock()
        mock_task.id = "task-pr-1"
        with patch("app.main.run_github_repository_scan_task.delay", return_value=mock_task) as mock_task_delay:
            res = client.post(
                "/api/github/webhook",
                content=body,
                headers={
                    "X-GitHub-Event": "pull_request",
                    "X-Hub-Signature-256": sig,
                    "X-GitHub-Delivery": "del-pr-inst-1",
                    "Content-Type": "application/json",
                },
            )
            assert res.status_code in (200, 202)
            assert res.json()["scan_queued"] is True

            # Verify task was queued with installation_id=778899 and pr_head_sha
            mock_task_delay.assert_called_once()
            kwargs = mock_task_delay.call_args[1]
            assert kwargs.get("installation_id") == 778899
            assert kwargs.get("pr_head_sha") == "sha999"


# ===========================================================================
# 7. Security Tests
# ===========================================================================


class TestGitHubAppSecurity:
    def test_private_key_never_in_exception_strings(self, monkeypatch):
        monkeypatch.setenv("GITHUB_APP_ID", TEST_APP_ID)
        monkeypatch.setenv("GITHUB_APP_PRIVATE_KEY", TEST_RSA_PRIVATE_KEY_PEM)

        # Trigger an error during token exchange
        http_error = urllib.error.HTTPError(
            url="https://api.github.com/app/installations/999/access_tokens",
            code=401,
            msg="Unauthorized",
            hdrs={},
            fp=MagicMock(read=MagicMock(return_value=b'{"message": "Bad credentials"}')),
        )

        with patch("urllib.request.urlopen", side_effect=http_error):
            with pytest.raises(GitHubAppError) as exc:
                get_installation_access_token(999)

            error_str = str(exc.value)
            assert "BEGIN PRIVATE KEY" not in error_str
            assert TEST_RSA_PRIVATE_KEY_PEM not in error_str

    def test_status_endpoint_never_exposes_private_key_or_token(self, monkeypatch):
        monkeypatch.setenv("GITHUB_APP_ID", TEST_APP_ID)
        monkeypatch.setenv("GITHUB_APP_PRIVATE_KEY", TEST_RSA_PRIVATE_KEY_PEM)
        monkeypatch.setenv("GITHUB_APP_NAME", "Rakshak Enterprise App")

        client = TestClient(app)
        res = client.get("/api/github/app/status")
        assert res.status_code == 200

        data = res.json()
        assert data["configured"] is True
        assert data["app_id"] == TEST_APP_ID
        assert data["app_name"] == "Rakshak Enterprise App"

        # Assert no sensitive fields in response
        raw_response = res.text
        assert "BEGIN PRIVATE KEY" not in raw_response
        assert "private_key" not in data
        assert "token" not in data
        assert "jwt" not in data

    def test_status_endpoint_when_not_configured(self, monkeypatch):
        monkeypatch.setenv("GITHUB_APP_ID", "")
        monkeypatch.setenv("GITHUB_APP_PRIVATE_KEY", "")
        monkeypatch.setenv("GITHUB_APP_NAME", "")

        status = get_github_app_status()
        assert status["configured"] is False
        assert status["app_id"] is None
        assert status["app_name"] is None


# ===========================================================================
# 8. Regressions (OAuth, Health Check, Ping)
# ===========================================================================


class TestPhase4Regressions:
    def test_health_check_still_returns_200(self):
        client = TestClient(app)
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json().get("status") == "healthy"

    def test_oauth_flow_still_requires_auth(self):
        client = TestClient(app)
        res = client.get("/api/github/repos")
        assert res.status_code == 401

    def test_manual_scan_requires_auth(self):
        client = TestClient(app)
        res = client.post("/api/github/scan", json={"owner": "o", "repo": "r"})
        assert res.status_code == 401

    def test_webhook_ping_still_accepted(self):
        client = TestClient(app)
        payload = {"zen": "Mind your words, they become actions."}
        body = json.dumps(payload).encode("utf-8")
        sig = _make_signature(body)

        res = client.post(
            "/api/github/webhook",
            content=body,
            headers={
                "X-GitHub-Event": "ping",
                "X-Hub-Signature-256": sig,
                "Content-Type": "application/json",
            },
        )
        assert res.status_code == 200
        assert res.json()["status"] == "ok"
