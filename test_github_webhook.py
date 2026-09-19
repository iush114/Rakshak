"""
test_github_webhook.py
======================
Tests for the GitHub Webhook Foundation (Phase 1).

Covers:
  - HMAC-SHA256 signature verification (unit tests for app.github_webhook module)
  - FastAPI endpoint behaviour: ping / push / pull_request / unsupported / bad JSON / no sig / bad sig
  - Regression checks: existing /health, /api/auth/me, /api/summary endpoints still respond

Run with:
    .\\venv\\Scripts\\python.exe -m pytest test_github_webhook.py -v
  or:
    .\\venv\\Scripts\\python.exe test_github_webhook.py
"""

import hashlib
import hmac
import json
import os
import sys
import unittest

# ---------------------------------------------------------------------------
# Make sure the project root is on sys.path so we can import app.*
# ---------------------------------------------------------------------------
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Set the webhook secret BEFORE importing the app so dotenv doesn't override it
TEST_SECRET = "test_webhook_secret_123"
os.environ["GITHUB_WEBHOOK_SECRET"] = TEST_SECRET

# Prevent DB / scanner imports from failing in CI where Postgres may not be running
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_webhook.db")
os.environ.setdefault("CELERY_BROKER_URL", "memory://")
os.environ.setdefault("CELERY_RESULT_BACKEND", "cache+memory://")

from fastapi.testclient import TestClient

from app.celery_app import celery_app
celery_app.conf.broker_url = "memory://"
celery_app.conf.result_backend = "cache+memory://"

from app.github_webhook import (
    get_webhook_secret,
    verify_github_signature,
    extract_push_event_metadata,
    extract_pull_request_event_metadata,
)
from app.main import app

client = TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sign(body: bytes, secret: str = TEST_SECRET) -> str:
    """Return the sha256=<hex> HMAC for *body* using *secret*."""
    digest = hmac.new(
        key=secret.encode("utf-8"),
        msg=body,
        digestmod=hashlib.sha256,
    ).hexdigest()
    return f"sha256={digest}"


def _post_webhook(
    payload: dict,
    event: str,
    secret: str = TEST_SECRET,
    tamper: bool = False,
    omit_signature: bool = False,
    delivery_id: str | None = None,
) -> object:
    """POST a signed webhook event to /api/github/webhook."""
    import uuid
    body = json.dumps(payload).encode()
    sig = _sign(body, secret)
    if tamper:
        sig = "sha256=" + "0" * 64  # wrong digest
    if delivery_id is None:
        delivery_id = f"test-delivery-{uuid.uuid4().hex[:8]}"
    headers = {"X-GitHub-Event": event, "X-GitHub-Delivery": delivery_id}
    if not omit_signature:
        headers["X-Hub-Signature-256"] = sig
    return client.post("/api/github/webhook", content=body, headers=headers)


# ===========================================================================
# Unit tests for the security module
# ===========================================================================

class TestGetWebhookSecret(unittest.TestCase):

    def test_returns_configured_secret(self):
        secret = get_webhook_secret()
        self.assertEqual(secret, TEST_SECRET)

    def test_raises_when_empty(self):
        original = os.environ.pop("GITHUB_WEBHOOK_SECRET", None)
        try:
            with self.assertRaises(RuntimeError):
                get_webhook_secret()
        finally:
            if original is not None:
                os.environ["GITHUB_WEBHOOK_SECRET"] = original


class TestVerifyGithubSignature(unittest.TestCase):

    BODY = b'{"ref":"refs/heads/main"}'

    def test_valid_signature_returns_true(self):
        sig = _sign(self.BODY)
        self.assertTrue(verify_github_signature(self.BODY, sig, secret=TEST_SECRET))

    def test_missing_signature_returns_false(self):
        self.assertFalse(verify_github_signature(self.BODY, None, secret=TEST_SECRET))

    def test_empty_signature_returns_false(self):
        self.assertFalse(verify_github_signature(self.BODY, "", secret=TEST_SECRET))

    def test_wrong_secret_returns_false(self):
        sig = _sign(self.BODY, secret="wrong_secret")
        self.assertFalse(verify_github_signature(self.BODY, sig, secret=TEST_SECRET))

    def test_tampered_body_returns_false(self):
        sig = _sign(self.BODY)
        self.assertFalse(verify_github_signature(b"tampered", sig, secret=TEST_SECRET))

    def test_bad_prefix_returns_false(self):
        digest = hmac.new(TEST_SECRET.encode(), self.BODY, hashlib.sha256).hexdigest()
        self.assertFalse(verify_github_signature(self.BODY, f"sha1={digest}", secret=TEST_SECRET))

    def test_wrong_hex_digest_returns_false(self):
        self.assertFalse(verify_github_signature(self.BODY, "sha256=" + "a" * 64, secret=TEST_SECRET))


class TestExtractPushEventMetadata(unittest.TestCase):

    PAYLOAD = {
        "ref": "refs/heads/main",
        "before": "abc",
        "after": "def",
        "pusher": {"name": "alice"},
        "commits": [{}, {}],
        "repository": {
            "id": 42,
            "full_name": "alice/myrepo",
            "name": "myrepo",
            "default_branch": "main",
            "owner": {"login": "alice"},
        },
    }

    def test_extracts_all_fields(self):
        meta = extract_push_event_metadata(self.PAYLOAD, "delivery-xyz")
        self.assertEqual(meta["event"], "push")
        self.assertEqual(meta["delivery_id"], "delivery-xyz")
        self.assertEqual(meta["repository_full_name"], "alice/myrepo")
        self.assertEqual(meta["owner"], "alice")
        self.assertEqual(meta["ref"], "refs/heads/main")
        self.assertEqual(meta["commits_count"], 2)
        self.assertEqual(meta["pusher"], "alice")

    def test_empty_payload_safe(self):
        meta = extract_push_event_metadata({}, None)
        self.assertEqual(meta["event"], "push")
        self.assertIsNone(meta["delivery_id"])
        self.assertIsNone(meta["repository_full_name"])
        self.assertEqual(meta["commits_count"], 0)


class TestExtractPullRequestEventMetadata(unittest.TestCase):

    PAYLOAD = {
        "number": 7,
        "action": "opened",
        "pull_request": {
            "title": "Fix critical bug",
            "state": "open",
            "draft": False,
            "head": {"ref": "feature/fix", "sha": "aabbcc"},
            "base": {"ref": "main"},
        },
        "repository": {
            "id": 42,
            "full_name": "alice/myrepo",
            "name": "myrepo",
            "owner": {"login": "alice"},
        },
    }

    def test_extracts_all_fields(self):
        meta = extract_pull_request_event_metadata(self.PAYLOAD, "delivery-abc")
        self.assertEqual(meta["event"], "pull_request")
        self.assertEqual(meta["pr_number"], 7)
        self.assertEqual(meta["action"], "opened")
        self.assertEqual(meta["base_branch"], "main")
        self.assertEqual(meta["head_branch"], "feature/fix")
        self.assertEqual(meta["head_sha"], "aabbcc")
        self.assertEqual(meta["pr_title"], "Fix critical bug")
        self.assertFalse(meta["draft"])

    def test_empty_payload_safe(self):
        meta = extract_pull_request_event_metadata({}, None)
        self.assertEqual(meta["event"], "pull_request")
        self.assertIsNone(meta["pr_number"])
        self.assertFalse(meta["draft"])


# ===========================================================================
# Integration tests for the FastAPI webhook endpoint
# ===========================================================================

PING_PAYLOAD = {"zen": "Keep it logically awesome.", "hook_id": 123}

PUSH_PAYLOAD = {
    "ref": "refs/heads/main",
    "before": "0000000",
    "after": "abcdef1",
    "pusher": {"name": "bob"},
    "commits": [{"id": "abcdef1", "message": "Add feature"}],
    "repository": {
        "id": 99,
        "full_name": "bob/proj",
        "name": "proj",
        "default_branch": "main",
        "owner": {"login": "bob"},
    },
}

PR_PAYLOAD = {
    "number": 3,
    "action": "opened",
    "pull_request": {
        "title": "My PR",
        "state": "open",
        "draft": False,
        "head": {"ref": "feature/x", "sha": "111aaa"},
        "base": {"ref": "main"},
    },
    "repository": {
        "id": 99,
        "full_name": "bob/proj",
        "name": "proj",
        "owner": {"login": "bob"},
    },
}


class TestWebhookEndpoint(unittest.TestCase):

    def setUp(self):
        """Reset delivery dedup set before each test."""
        import app.main as main_module
        if hasattr(main_module, "_processed_deliveries"):
            main_module._processed_deliveries = set()

    def test_missing_signature_returns_401(self):
        r = _post_webhook(PING_PAYLOAD, "ping", omit_signature=True)
        self.assertEqual(r.status_code, 401)

    def test_invalid_signature_returns_401(self):
        r = _post_webhook(PING_PAYLOAD, "ping", tamper=True)
        self.assertEqual(r.status_code, 401)

    # --- ping ---

    def test_ping_returns_200_ok(self):
        r = _post_webhook(PING_PAYLOAD, "ping")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["event"], "ping")
        self.assertEqual(data["zen"], PING_PAYLOAD["zen"])
        self.assertEqual(data["hook_id"], PING_PAYLOAD["hook_id"])

    # --- push ---

    def test_push_returns_200_accepted(self):
        r = _post_webhook(PUSH_PAYLOAD, "push")
        self.assertIn(r.status_code, [200, 202])
        data = r.json()
        self.assertEqual(data["status"], "accepted")
        self.assertEqual(data["event"], "push")
        self.assertEqual(data["repository"], "bob/proj")
        self.assertEqual(data["ref"], "refs/heads/main")
        self.assertEqual(data["commits"], 1)

    # --- pull_request ---

    def test_pull_request_returns_200_accepted(self):
        r = _post_webhook(PR_PAYLOAD, "pull_request")
        self.assertIn(r.status_code, [200, 202])
        data = r.json()
        self.assertEqual(data["status"], "accepted")
        self.assertEqual(data["event"], "pull_request")
        self.assertEqual(data["repository"], "bob/proj")
        self.assertEqual(data["pr_number"], 3)
        self.assertEqual(data["action"], "opened")

    # --- unsupported events ---

    def test_unsupported_event_returns_200_ignored(self):
        r = _post_webhook({"foo": "bar"}, "release")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["status"], "ignored")
        self.assertEqual(data["event"], "release")

    def test_unknown_event_empty_header_returns_200_ignored(self):
        body = json.dumps({"foo": "bar"}).encode()
        sig = _sign(body)
        r = client.post(
            "/api/github/webhook",
            content=body,
            headers={"X-Hub-Signature-256": sig},  # no X-GitHub-Event header
        )
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["status"], "ignored")

    # --- malformed JSON ---

    def test_malformed_json_returns_400(self):
        bad_body = b"not-valid-json{"
        sig = _sign(bad_body)
        r = client.post(
            "/api/github/webhook",
            content=bad_body,
            headers={
                "X-GitHub-Event": "push",
                "X-Hub-Signature-256": sig,
                "Content-Type": "application/json",
            },
        )
        self.assertEqual(r.status_code, 400)


# ===========================================================================
# Regression tests — existing endpoints must still be reachable
# ===========================================================================

class TestExistingEndpointsRegression(unittest.TestCase):

    def test_health_endpoint_still_works(self):
        r = client.get("/health")
        self.assertIn(r.status_code, [200, 404])  # may or may not exist; must not crash

    def test_api_auth_me_does_not_500(self):
        r = client.get("/api/auth/me")
        # Unauthenticated → 401 or 403; never a 500
        self.assertNotEqual(r.status_code, 500)

    def test_api_summary_does_not_500(self):
        r = client.get("/api/summary")
        self.assertNotEqual(r.status_code, 500)

    def test_webhook_does_not_affect_scan_endpoint(self):
        r = client.post(
            "/api/github/scan",
            json={"owner": "x", "repo": "y", "token": "tok"},
        )
        # Should not be 405 or 500 (may be 422/401/400 due to auth, which is fine)
        self.assertNotIn(r.status_code, [405, 500])


# ===========================================================================
# Phase 2 — Automatic Scanning Tests
# ===========================================================================
#
# All GitHub network calls and scanner subprocess calls are mocked.
# No real GitHub API requests are made.
# No real scanners (trivy/gitleaks) are invoked.
# ===========================================================================

import importlib
from unittest.mock import MagicMock, patch

# Import scan_service for unit testing
from app.scan_service import run_github_repository_scan


# ---------------------------------------------------------------------------
# Helpers shared by Phase 2 tests
# ---------------------------------------------------------------------------

def _make_mock_db():
    """Create a minimal mock SQLAlchemy session."""
    db = MagicMock()
    db.add = MagicMock()
    db.commit = MagicMock()
    db.rollback = MagicMock()
    db.close = MagicMock()
    return db


def _fake_download(*args, **kwargs):
    """Return a fake temp-dir + path (avoids real filesystem/network)."""
    import tempfile, os
    td = tempfile.TemporaryDirectory()
    # Create a minimal dummy file so scanners don't error on empty dir
    dummy = os.path.join(td.name, "dummy.py")
    open(dummy, "w").write("x = 1\n")
    return td, td.name


PUSH_PAYLOAD_P2 = {
    "ref": "refs/heads/main",
    "before": "0000000",
    "after": "abcdef1234567890abcdef1234567890abcdef12",
    "pusher": {"name": "dev"},
    "commits": [{"id": "abcdef1234567890abcdef1234567890abcdef12", "message": "fix bug"}],
    "repository": {
        "id": 1,
        "full_name": "dev/myapp",
        "name": "myapp",
        "default_branch": "main",
        "owner": {"login": "dev"},
    },
}

PR_PAYLOAD_OPENED = {
    "number": 5,
    "action": "opened",
    "pull_request": {
        "title": "Add feature",
        "state": "open",
        "draft": False,
        "head": {"ref": "feature/awesome", "sha": "deadbeef" * 5},
        "base": {"ref": "main"},
    },
    "repository": {
        "id": 1,
        "full_name": "dev/myapp",
        "name": "myapp",
        "owner": {"login": "dev"},
    },
}

PR_PAYLOAD_SYNCHRONIZE = dict(PR_PAYLOAD_OPENED, action="synchronize")
PR_PAYLOAD_REOPENED = dict(PR_PAYLOAD_OPENED, action="reopened")
PR_PAYLOAD_CLOSED = dict(PR_PAYLOAD_OPENED, action="closed")

# Phase 11A: webhook scans are only queued when the repository/installation is
# associated with a Rakshak workspace. Seed the mapping for the test repository.
from conftest import ensure_webhook_workspace  # noqa: E402

ensure_webhook_workspace(repository_full_name="dev/myapp")
# PUSH_PAYLOAD / PR_PAYLOAD (module-level fixtures) use bob/proj.
ensure_webhook_workspace(repository_full_name="bob/proj", login="webhook-test-owner-bob")


# ---------------------------------------------------------------------------
# A. Valid push queues scan
# ---------------------------------------------------------------------------

class TestPushQueuesScan(unittest.TestCase):

    def setUp(self):
        import app.main as main_module
        main_module._processed_deliveries = set()

    def test_push_response_has_scan_queued_true(self):
        r = _post_webhook(PUSH_PAYLOAD_P2, "push")
        self.assertIn(r.status_code, [200, 202])
        data = r.json()
        self.assertEqual(data["status"], "accepted")
        self.assertEqual(data["event"], "push")
        self.assertTrue(data["scan_queued"])

    def test_push_tag_does_not_queue_scan(self):
        """refs/tags/* should NOT trigger scanning."""
        tag_payload = dict(PUSH_PAYLOAD_P2, ref="refs/tags/v1.0.0")
        tag_payload["repository"] = PUSH_PAYLOAD_P2["repository"]
        r = _post_webhook(tag_payload, "push")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        # scan_queued should be False for tags
        self.assertFalse(data.get("scan_queued", True))

    def test_push_contains_correct_repository(self):
        r = _post_webhook(PUSH_PAYLOAD_P2, "push")
        data = r.json()
        self.assertEqual(data["repository"], "dev/myapp")

    def test_push_contains_correct_ref(self):
        r = _post_webhook(PUSH_PAYLOAD_P2, "push")
        data = r.json()
        self.assertEqual(data["ref"], "refs/heads/main")


# ---------------------------------------------------------------------------
# B/C/D. PR opened/synchronize/reopened queue scan
# E. Closed PR does not queue scan
# ---------------------------------------------------------------------------

class TestPullRequestScanQueueing(unittest.TestCase):

    def setUp(self):
        import app.main as main_module
        main_module._processed_deliveries = set()

    def _pr_response(self, payload):
        return _post_webhook(payload, "pull_request")

    def test_pr_opened_queues_scan(self):
        r = self._pr_response(PR_PAYLOAD_OPENED)
        self.assertIn(r.status_code, [200, 202])
        data = r.json()
        self.assertEqual(data["status"], "accepted")
        self.assertTrue(data["scan_queued"])

    def test_pr_synchronize_queues_scan(self):
        r = self._pr_response(PR_PAYLOAD_SYNCHRONIZE)
        self.assertIn(r.status_code, [200, 202])
        self.assertTrue(r.json()["scan_queued"])

    def test_pr_reopened_queues_scan(self):
        r = self._pr_response(PR_PAYLOAD_REOPENED)
        self.assertIn(r.status_code, [200, 202])
        self.assertTrue(r.json()["scan_queued"])

    def test_pr_closed_does_not_queue_scan(self):
        r = self._pr_response(PR_PAYLOAD_CLOSED)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertFalse(data.get("scan_queued", True))

    def test_pr_labeled_does_not_queue_scan(self):
        labeled = dict(PR_PAYLOAD_OPENED, action="labeled")
        r = self._pr_response(labeled)
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json().get("scan_queued", True))


# ---------------------------------------------------------------------------
# F/G. Invalid/missing signature does not queue scan
# ---------------------------------------------------------------------------

class TestInvalidSignatureNoScan(unittest.TestCase):

    def setUp(self):
        import app.main as main_module
        main_module._processed_deliveries = set()

    def test_invalid_signature_push_not_queued(self):
        r = _post_webhook(PUSH_PAYLOAD_P2, "push", tamper=True)
        self.assertEqual(r.status_code, 401)

    def test_missing_signature_push_not_queued(self):
        r = _post_webhook(PUSH_PAYLOAD_P2, "push", omit_signature=True)
        self.assertEqual(r.status_code, 401)

    def test_invalid_signature_pr_not_queued(self):
        r = _post_webhook(PR_PAYLOAD_OPENED, "pull_request", tamper=True)
        self.assertEqual(r.status_code, 401)


# ---------------------------------------------------------------------------
# H. Repository metadata is passed correctly
# ---------------------------------------------------------------------------

class TestMetadataPassedCorrectly(unittest.TestCase):

    def setUp(self):
        import app.main as main_module
        main_module._processed_deliveries = set()

    def test_push_response_includes_commit_count(self):
        r = _post_webhook(PUSH_PAYLOAD_P2, "push")
        data = r.json()
        self.assertEqual(data["commits"], 1)

    def test_pr_response_includes_pr_number_and_action(self):
        r = _post_webhook(PR_PAYLOAD_OPENED, "pull_request")
        data = r.json()
        self.assertEqual(data["pr_number"], 5)
        self.assertEqual(data["action"], "opened")

    def test_pr_response_includes_repository(self):
        r = _post_webhook(PR_PAYLOAD_OPENED, "pull_request")
        self.assertEqual(r.json()["repository"], "dev/myapp")


# ---------------------------------------------------------------------------
# I. Correct commit SHA / ref is passed to repository download
# ---------------------------------------------------------------------------

class TestCorrectRefPassedToDownload(unittest.TestCase):
    """
    Verify that run_github_repository_scan is called with the commit SHA
    for push events and head SHA for PR events.
    """

    @patch("app.scan_service.download_repository", side_effect=_fake_download)
    @patch("app.scan_service.run_code_scan", return_value=[])
    @patch("app.scan_service.run_dependency_scan", return_value=[])
    @patch("app.scan_service.run_secret_scan", return_value=[])
    def test_push_uses_commit_sha_as_ref(
        self, mock_secret, mock_dep, mock_code, mock_dl
    ):
        db = _make_mock_db()
        # Patch Scan so we don't need real DB
        with patch("app.scan_service.Scan") as MockScan, \
             patch("app.scan_service.Finding"), \
             patch("app.scan_service.analyze_finding", return_value={"severity": "low", "risk_score": 0}):
            mock_scan_instance = MagicMock()
            MockScan.return_value = mock_scan_instance

            commit_sha = PUSH_PAYLOAD_P2["after"]

            try:
                run_github_repository_scan(
                    db=db,
                    owner="dev",
                    repo="myapp",
                    ref=commit_sha,
                    access_token=None,
                    trigger="push",
                    delivery_id="test-delivery-push",
                )
            except Exception:
                pass  # DB mock may raise; we only care about download call

            mock_dl.assert_called_once()
            call_kwargs = mock_dl.call_args
            # ref arg should be the commit SHA
            self.assertEqual(call_kwargs.args[3], commit_sha)

    @patch("app.scan_service.download_repository", side_effect=_fake_download)
    @patch("app.scan_service.run_code_scan", return_value=[])
    @patch("app.scan_service.run_dependency_scan", return_value=[])
    @patch("app.scan_service.run_secret_scan", return_value=[])
    def test_pr_uses_head_sha_as_ref(
        self, mock_secret, mock_dep, mock_code, mock_dl
    ):
        db = _make_mock_db()
        head_sha = PR_PAYLOAD_OPENED["pull_request"]["head"]["sha"]

        with patch("app.scan_service.Scan") as MockScan, \
             patch("app.scan_service.Finding"), \
             patch("app.scan_service.analyze_finding", return_value={"severity": "low", "risk_score": 0}):
            mock_scan_instance = MagicMock()
            MockScan.return_value = mock_scan_instance

            try:
                run_github_repository_scan(
                    db=db,
                    owner="dev",
                    repo="myapp",
                    ref=head_sha,
                    access_token=None,
                    trigger="pull_request",
                    delivery_id="test-delivery-pr",
                )
            except Exception:
                pass

            mock_dl.assert_called_once()
            call_kwargs = mock_dl.call_args
            self.assertEqual(call_kwargs.args[3], head_sha)


# ---------------------------------------------------------------------------
# J/K/L. Background scan creates Scan + Finding records; status → completed
# ---------------------------------------------------------------------------

class TestScanRecordPersistence(unittest.TestCase):
    """
    Test run_github_repository_scan with real SQLAlchemy against SQLite.
    Uses the same DATABASE_URL=sqlite:///./test_webhook.db set at module top.
    """

    @classmethod
    def setUpClass(cls):
        from app.database import Base, engine
        Base.metadata.create_all(bind=engine)

    def _make_finding(self):
        """Return a minimal finding dict that analyze_finding can process."""
        return {
            "vulnerability_id": "TEST-001",
            "title": "Test finding",
            "description": "A test vulnerability",
            "tool": "test_scanner",
            "severity": "high",
            "priority": "high",
            "risk_score": 7.5,
            "exploitability": 0.6,
            "target": "test_file.py",
            "package_name": "",
            "installed_version": "",
            "fixed_version": "",
            "fix_available": False,
            "production": False,
            "affected_packages": None,
        }

    @patch("app.scan_service.download_repository", side_effect=_fake_download)
    @patch("app.scan_service.run_dependency_scan", return_value=[])
    @patch("app.scan_service.run_secret_scan", return_value=[])
    @patch("app.scan_service.run_code_scan")
    def test_scan_creates_scan_record(self, mock_code, *_):
        from app.database import SessionLocal
        from app.models import Scan

        mock_code.return_value = [self._make_finding()]

        db = SessionLocal()
        try:
            scan_id = run_github_repository_scan(
                db=db,
                owner="testowner",
                repo="testrepo",
                ref="abc123",
                access_token=None,
                code_scanning=True,
                dependency_scanning=False,
                secret_detection=False,
                trigger="push",
                delivery_id="delivery-j",
            )

            scan = db.query(Scan).filter(Scan.id == scan_id).first()
            self.assertIsNotNone(scan)
            self.assertEqual(scan.target_path, "github.com/testowner/testrepo")
        finally:
            db.close()

    @patch("app.scan_service.download_repository", side_effect=_fake_download)
    @patch("app.scan_service.run_dependency_scan", return_value=[])
    @patch("app.scan_service.run_secret_scan", return_value=[])
    @patch("app.scan_service.run_code_scan")
    def test_scan_creates_finding_records(self, mock_code, *_):
        from app.database import SessionLocal
        from app.models import Finding, Scan

        mock_code.return_value = [self._make_finding(), self._make_finding()]

        db = SessionLocal()
        try:
            scan_id = run_github_repository_scan(
                db=db,
                owner="testowner2",
                repo="testrepo2",
                ref="abc456",
                access_token=None,
                code_scanning=True,
                dependency_scanning=False,
                secret_detection=False,
                trigger="push",
                delivery_id="delivery-k",
            )

            findings = db.query(Finding).filter(Finding.scan_id == scan_id).all()
            self.assertEqual(len(findings), 2)
        finally:
            db.close()

    @patch("app.scan_service.download_repository", side_effect=_fake_download)
    @patch("app.scan_service.run_dependency_scan", return_value=[])
    @patch("app.scan_service.run_secret_scan", return_value=[])
    @patch("app.scan_service.run_code_scan", return_value=[])
    def test_successful_scan_status_is_completed(self, *_):
        from app.database import SessionLocal
        from app.models import Scan

        db = SessionLocal()
        try:
            scan_id = run_github_repository_scan(
                db=db,
                owner="testowner3",
                repo="testrepo3",
                ref="abc789",
                access_token=None,
                code_scanning=True,
                dependency_scanning=False,
                secret_detection=False,
                trigger="push",
                delivery_id="delivery-l",
            )

            scan = db.query(Scan).filter(Scan.id == scan_id).first()
            self.assertEqual(scan.status, "completed")
            self.assertIsNotNone(scan.completed_at)
        finally:
            db.close()


# ---------------------------------------------------------------------------
# M. Failed background scan status → failed
# ---------------------------------------------------------------------------

class TestScanFailureStatus(unittest.TestCase):

    @patch("app.scan_service.download_repository", side_effect=RuntimeError("network error"))
    def test_failed_scan_status_is_failed(self, _):
        from app.database import SessionLocal
        from app.models import Scan

        db = SessionLocal()
        try:
            with self.assertRaises(RuntimeError):
                scan_id = run_github_repository_scan(
                    db=db,
                    owner="failowner",
                    repo="failrepo",
                    ref="badbranch",
                    access_token=None,
                    code_scanning=True,
                    dependency_scanning=False,
                    secret_detection=False,
                    trigger="push",
                    delivery_id="delivery-m",
                )

            # The scan record should exist with status = failed
            failed_scan = (
                db.query(Scan)
                .filter(Scan.target_path == "github.com/failowner/failrepo")
                .order_by(Scan.started_at.desc())
                .first()
            )
            self.assertIsNotNone(failed_scan)
            self.assertEqual(failed_scan.status, "failed")
            self.assertIsNotNone(failed_scan.completed_at)
        finally:
            db.close()


# ---------------------------------------------------------------------------
# Delivery ID deduplication
# ---------------------------------------------------------------------------

class TestDeliveryIdDeduplication(unittest.TestCase):

    def setUp(self):
        """Reset the in-process delivery set and test delivery record before each test."""
        import app.main as main_module
        from app.database import SessionLocal
        from app.models import GitHubWebhookDelivery

        main_module._processed_deliveries = set()
        db = SessionLocal()
        try:
            db.query(GitHubWebhookDelivery).filter(
                GitHubWebhookDelivery.delivery_id == "dedup-delivery-001"
            ).delete()
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()

    def test_duplicate_delivery_is_deduplicated(self):
        body = json.dumps(PUSH_PAYLOAD_P2).encode()
        sig = _sign(body)
        headers = {
            "X-GitHub-Event": "push",
            "X-Hub-Signature-256": sig,
            "X-GitHub-Delivery": "dedup-delivery-001",
        }

        # First request
        r1 = client.post("/api/github/webhook", content=body, headers=headers)
        self.assertIn(r1.status_code, [200, 202])
        self.assertNotEqual(r1.json().get("status"), "duplicate")

        # Second request with SAME delivery ID
        r2 = client.post("/api/github/webhook", content=body, headers=headers)
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.json()["status"], "duplicate")


# ---------------------------------------------------------------------------
# N. Manual POST /api/github/scan still works (mocked auth)
# ---------------------------------------------------------------------------

class TestManualScanRegression(unittest.TestCase):

    def test_manual_scan_requires_auth(self):
        """Without a session token, /api/github/scan must return 401."""
        r = client.post(
            "/api/github/scan",
            json={"owner": "dev", "repo": "myapp"},
        )
        self.assertEqual(r.status_code, 401)

    def test_manual_scan_endpoint_exists(self):
        """Endpoint must not be 404 or 405."""
        r = client.post(
            "/api/github/scan",
            json={"owner": "dev", "repo": "myapp"},
        )
        self.assertNotIn(r.status_code, [404, 405])


# ---------------------------------------------------------------------------
# O/P/Q. Existing OAuth / repos / health regression
# ---------------------------------------------------------------------------

class TestFullRegressionSuite(unittest.TestCase):

    def test_oauth_start_redirects(self):
        r = client.get("/api/auth/github", follow_redirects=False)
        # Should redirect to GitHub; never 500
        self.assertIn(r.status_code, [302, 307, 500])
        if r.status_code == 500:
            # Only acceptable 500 if env var missing, not a code error
            self.assertIn("OAuth", r.json().get("detail", ""))

    def test_api_github_repos_requires_auth(self):
        r = client.get("/api/github/repos")
        self.assertIn(r.status_code, [401, 403])

    def test_health_still_returns_200(self):
        r = client.get("/health")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["status"], "healthy")


# ---------------------------------------------------------------------------
# Entry-point for plain python execution
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    loader = unittest.TestLoader()
    suite = loader.discover(start_dir=".", pattern="test_github_webhook.py")
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
