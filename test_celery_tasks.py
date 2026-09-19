"""
test_celery_tasks.py
====================
Tests for Phase 5 — Durable Scan Queue and Worker (Celery + Redis).

Covers:
  1.  Celery app configuration (JSON serialization, task_acks_late, time limits)
  2.  Task registration and naming
  3.  run_github_repository_scan_task calls scan_service.run_github_repository_scan
  4.  Task forwards all parameters (installation_id, ref, scan flags, etc.)
  5.  Successful task execution return structure
  6.  Transient error handling & retry behavior (URLError, ConnectionError, TimeoutError)
  7.  Permanent error handling (non-transient errors do not retry)
  8.  Webhook endpoint enqueues Celery task via delay()
  9.  Webhook returns HTTP 202 Accepted when scan is queued
  10. Webhook returns task_id in response
  11. Webhook still verifies HMAC signature before queueing
  12. Webhook still extracts installation_id and forwards to Celery task
  13. Push event Celery task enqueue
  14. PR event Celery task enqueue
  15. Tag push ignored (returns 200, scan_queued=False, no Celery task queued)
  16. Unsupported PR action ignored (returns 200, scan_queued=False, no Celery task queued)
  17. Queue error handling: returns HTTP 503 when broker is unreachable
  18. System queue status endpoint: GET /api/system/queue-status (safe telemetry)
"""

import hashlib
import hmac
import json
import os
import urllib.error
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Set test environment variables BEFORE any application imports
# ---------------------------------------------------------------------------
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_webhook.db")
os.environ.setdefault("GITHUB_WEBHOOK_SECRET", "test_webhook_secret_123")
os.environ.setdefault("SESSION_SECRET", "test-session-secret-for-testing")
os.environ.setdefault("CELERY_BROKER_URL", "redis://localhost:6379/0")
os.environ.setdefault("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")

from app.celery_app import celery_app, get_queue_status, is_queue_configured
from app.main import app
from app.tasks import run_github_repository_scan_task

TEST_SECRET = "test_webhook_secret_123"


def _make_signature(body: bytes) -> str:
    digest = hmac.new(
        key=TEST_SECRET.encode("utf-8"),
        msg=body,
        digestmod=hashlib.sha256,
    ).hexdigest()
    return f"sha256={digest}"


# ===========================================================================
# 1. Celery Application Configuration Tests
# ===========================================================================


class TestCeleryAppConfiguration:
    def test_celery_task_serializer_is_json(self):
        assert celery_app.conf.task_serializer == "json"

    def test_celery_result_serializer_is_json(self):
        assert celery_app.conf.result_serializer == "json"

    def test_celery_accept_content_is_json_only(self):
        assert celery_app.conf.accept_content == ["json"]

    def test_celery_acks_late_enabled(self):
        assert celery_app.conf.task_acks_late is True

    def test_celery_time_limits_configured(self):
        assert celery_app.conf.task_time_limit == 1800
        assert celery_app.conf.task_soft_time_limit == 1500

    def test_task_is_registered(self):
        assert "app.tasks.run_github_repository_scan_task" in celery_app.tasks

    def test_is_queue_configured_true(self):
        assert is_queue_configured() is True

    def test_get_queue_status_safe(self):
        status = get_queue_status()
        assert status["configured"] is True
        assert status["task_serializer"] == "json"
        assert status["acks_late"] is True
        # Assert no password or host credentials leaked
        status_str = json.dumps(status)
        assert "redis://" not in status_str
        assert "password" not in status_str


# ===========================================================================
# 2. Celery Scan Task Execution Tests
# ===========================================================================


class TestRunGithubRepositoryScanTask:
    def test_task_calls_run_github_repository_scan(self):
        with patch("app.tasks.run_github_repository_scan", return_value="scan-uuid-1234") as mock_scan:
            result = run_github_repository_scan_task.apply(
                kwargs={
                    "owner": "testorg",
                    "repo": "testrepo",
                    "ref": "refs/heads/main",
                    "access_token": None,
                    "code_scanning": True,
                    "dependency_scanning": True,
                    "secret_detection": True,
                    "container_scanning": False,
                    "trigger": "webhook_push",
                    "delivery_id": "del-101",
                    "installation_id": 9999,
                }
            ).get()

            assert result["status"] == "completed"
            assert result["scan_id"] == "scan-uuid-1234"
            assert result["owner"] == "testorg"
            assert result["repo"] == "testrepo"

            mock_scan.assert_called_once()
            call_kwargs = mock_scan.call_args[1]
            assert call_kwargs["owner"] == "testorg"
            assert call_kwargs["repo"] == "testrepo"
            assert call_kwargs["ref"] == "refs/heads/main"
            assert call_kwargs["installation_id"] == 9999
            assert call_kwargs["delivery_id"] == "del-101"

    def test_transient_network_error_triggers_retry(self):
        url_error = urllib.error.URLError("Temporary DNS error")
        with patch("app.tasks.run_github_repository_scan", side_effect=url_error):
            task = run_github_repository_scan_task
            with patch.object(task, "retry", side_effect=RuntimeError("RetryCalled")) as mock_retry:
                with pytest.raises(RuntimeError) as exc:
                    task(
                        owner="retryorg",
                        repo="retryrepo",
                        ref="main",
                    )
                assert "RetryCalled" in str(exc.value)
                mock_retry.assert_called_once()

    def test_permanent_error_raises_without_retry(self):
        value_error = ValueError("Repository invalid configuration")
        with patch("app.tasks.run_github_repository_scan", side_effect=value_error):
            task = run_github_repository_scan_task
            with patch.object(task, "retry") as mock_retry:
                with pytest.raises(ValueError):
                    task(
                        owner="errorkorg",
                        repo="errorrepo",
                        ref="main",
                    )
                mock_retry.assert_not_called()


# ===========================================================================
# 3. Webhook Enqueues Celery Task Tests
# ===========================================================================


# Phase 11A: webhook scans require a resolved Rakshak workspace association.
from conftest import ensure_webhook_workspace  # noqa: E402

ensure_webhook_workspace(
    installation_ids=(12345, 887766),
    repository_full_name="org/celery-repo",
    login="webhook-test-org",
)


class TestWebhookCeleryEnqueue:
    # Hardcoded delivery IDs used across this class
    _DELIVERY_IDS = [
        "del-celery-push-1",
        "del-celery-pr-1",
        "del-celery-tag-1",
        "del-celery-closed-1",
        "del-broker-fail-1",
    ]

    def setup_method(self, method):
        """Reset delivery dedup state before each test (pytest-style)."""
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

    def test_push_webhook_enqueues_celery_task_and_returns_202(self):
        client = TestClient(app)
        payload = {
            "ref": "refs/heads/main",
            "after": "abc1234",
            "repository": {
                "name": "celery-repo",
                "full_name": "org/celery-repo",
                "owner": {"login": "org"},
            },
            "commits": [{"id": "abc1234"}],
            "installation": {"id": 12345},
        }
        body = json.dumps(payload).encode("utf-8")
        sig = _make_signature(body)

        mock_task = MagicMock()
        mock_task.id = "celery-task-id-555"

        with patch("app.main.run_github_repository_scan_task.delay", return_value=mock_task) as mock_delay:
            res = client.post(
                "/api/github/webhook",
                content=body,
                headers={
                    "X-GitHub-Event": "push",
                    "X-Hub-Signature-256": sig,
                    "X-GitHub-Delivery": "del-celery-push-1",
                    "Content-Type": "application/json",
                },
            )
            assert res.status_code == 202
            data = res.json()
            assert data["status"] == "accepted"
            assert data["scan_queued"] is True
            assert data["task_id"] == "celery-task-id-555"

            mock_delay.assert_called_once()
            kwargs = mock_delay.call_args[1]
            assert kwargs["owner"] == "org"
            assert kwargs["repo"] == "celery-repo"
            assert kwargs["ref"] == "abc1234"
            assert kwargs["installation_id"] == 12345
            assert kwargs["trigger"] == "push"

    def test_pr_webhook_enqueues_celery_task_and_returns_202(self):
        client = TestClient(app)
        payload = {
            "action": "opened",
            "number": 7,
            "pull_request": {
                "head": {"sha": "sha-pr-celery", "ref": "feat-queue"},
                "base": {"ref": "main"},
            },
            "repository": {
                "name": "celery-repo",
                "full_name": "org/celery-repo",
                "owner": {"login": "org"},
            },
            "installation": {"id": 887766},
        }
        body = json.dumps(payload).encode("utf-8")
        sig = _make_signature(body)

        mock_task = MagicMock()
        mock_task.id = "celery-pr-task-777"

        with patch("app.main.run_github_repository_scan_task.delay", return_value=mock_task) as mock_delay:
            res = client.post(
                "/api/github/webhook",
                content=body,
                headers={
                    "X-GitHub-Event": "pull_request",
                    "X-Hub-Signature-256": sig,
                    "X-GitHub-Delivery": "del-celery-pr-1",
                    "Content-Type": "application/json",
                },
            )
            assert res.status_code == 202
            data = res.json()
            assert data["status"] == "accepted"
            assert data["scan_queued"] is True
            assert data["task_id"] == "celery-pr-task-777"

            mock_delay.assert_called_once()
            kwargs = mock_delay.call_args[1]
            assert kwargs["owner"] == "org"
            assert kwargs["repo"] == "celery-repo"
            assert kwargs["pr_head_sha"] == "sha-pr-celery"
            assert kwargs["installation_id"] == 887766
            assert kwargs["trigger"] == "pull_request"

    def test_tag_push_not_queued_returns_200(self):
        client = TestClient(app)
        payload = {
            "ref": "refs/tags/v2.0.0",
            "repository": {
                "name": "celery-repo",
                "full_name": "org/celery-repo",
                "owner": {"login": "org"},
            },
        }
        body = json.dumps(payload).encode("utf-8")
        sig = _make_signature(body)

        with patch("app.main.run_github_repository_scan_task.delay") as mock_delay:
            res = client.post(
                "/api/github/webhook",
                content=body,
                headers={
                    "X-GitHub-Event": "push",
                    "X-Hub-Signature-256": sig,
                    "X-GitHub-Delivery": "del-celery-tag-1",
                    "Content-Type": "application/json",
                },
            )
            assert res.status_code == 200
            assert res.json()["scan_queued"] is False
            mock_delay.assert_not_called()

    def test_closed_pr_not_queued_returns_200(self):
        client = TestClient(app)
        payload = {
            "action": "closed",
            "number": 9,
            "pull_request": {"head": {"sha": "sha-closed"}},
            "repository": {
                "name": "celery-repo",
                "full_name": "org/celery-repo",
                "owner": {"login": "org"},
            },
        }
        body = json.dumps(payload).encode("utf-8")
        sig = _make_signature(body)

        with patch("app.main.run_github_repository_scan_task.delay") as mock_delay:
            res = client.post(
                "/api/github/webhook",
                content=body,
                headers={
                    "X-GitHub-Event": "pull_request",
                    "X-Hub-Signature-256": sig,
                    "X-GitHub-Delivery": "del-celery-closed-1",
                    "Content-Type": "application/json",
                },
            )
            assert res.status_code == 200
            assert res.json()["scan_queued"] is False
            mock_delay.assert_not_called()

    def test_broker_down_returns_503(self):
        client = TestClient(app)
        payload = {
            "ref": "refs/heads/main",
            "after": "abc1234",
            "repository": {
                "name": "celery-repo",
                "full_name": "org/celery-repo",
                "owner": {"login": "org"},
            },
        }
        body = json.dumps(payload).encode("utf-8")
        sig = _make_signature(body)

        with patch(
            "app.main.run_github_repository_scan_task.delay",
            side_effect=ConnectionError("Cannot connect to Redis broker"),
        ):
            res = client.post(
                "/api/github/webhook",
                content=body,
                headers={
                    "X-GitHub-Event": "push",
                    "X-Hub-Signature-256": sig,
                    "X-GitHub-Delivery": "del-broker-fail-1",
                    "Content-Type": "application/json",
                },
            )
            assert res.status_code == 503
            assert "unavailable" in res.json()["detail"].lower()


# ===========================================================================
# 4. System Queue Status Endpoint Tests
# ===========================================================================


class TestSystemQueueStatusEndpoint:
    def test_queue_status_returns_200(self):
        client = TestClient(app)
        res = client.get("/api/system/queue-status")
        assert res.status_code == 200
        data = res.json()
        assert data["configured"] is True
        assert data["task_serializer"] == "json"
        assert data["acks_late"] is True
