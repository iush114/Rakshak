"""
test_github_checks.py
=====================
Tests for Phase 3A — GitHub PR Check Run Integration.

Covers:
  A.  Check Run creation succeeds.
  B.  Check Run creation returns check_run_id.
  C.  Correct owner/repo used in API URL.
  D.  Correct PR head SHA used.
  E.  Correct check name used.
  F.  Initial status is in_progress.
  G.  Check Run completion succeeds.
  H.  Conclusion is "success" when critical_count == 0.
  I.  Conclusion is "failure" when critical_count > 0.
  J.  Output contains total findings.
  K.  Output contains critical/high/medium/low counts.
  L.  Output contains risk score.
  M.  Output contains Rakshak scan ID.
  N.  GitHub API 401 is handled (CheckRunError raised).
  O.  GitHub API 403 is handled.
  P.  GitHub API 404 is handled.
  Q.  GitHub API 422 is handled.
  R.  GitHub API 429 is handled.
  S.  GitHub 5xx is handled.
  T.  Check Run API failure does NOT fail the PostgreSQL scan.
  U.  Existing Phase 1 tests still pass (regression import).
  V.  Existing Phase 2 tests still pass (regression import).
  W.  Manual GitHub scanning still works (endpoint regression).
  X.  OAuth still works (endpoint regression).

No real GitHub API calls are made.  All HTTP is mocked via unittest.mock.

Run with:
    .\\venv\\Scripts\\python.exe -m pytest test_github_checks.py -v
  or:
    .\\venv\\Scripts\\python.exe test_github_checks.py
"""

import hashlib
import hmac
import json
import os
import sys
import unittest
from datetime import datetime, timezone
from io import BytesIO
from unittest.mock import MagicMock, patch, call

# ---------------------------------------------------------------------------
# Set environment variables BEFORE any app imports.
# These MUST match test_github_webhook.py so both files work in a single pytest
# session (app.main is only imported once; the first file to import it wins).
# ---------------------------------------------------------------------------
os.environ["GITHUB_WEBHOOK_SECRET"] = "test_webhook_secret_123"
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_webhook.db")
os.environ.setdefault("SESSION_SECRET", "test-session-secret")
os.environ.setdefault("CELERY_BROKER_URL", "memory://")
os.environ.setdefault("CELERY_RESULT_BACKEND", "cache+memory://")
# Do NOT set GITHUB_CHECK_RUN_TOKEN globally — individual tests set it as needed.

from fastapi.testclient import TestClient
from app.celery_app import celery_app
celery_app.conf.broker_url = "memory://"
celery_app.conf.result_backend = "cache+memory://"

from app.main import app
from app.github_checks import (
    CheckRunError,
    CHECK_RUN_NAME,
    build_check_run_output,
    create_check_run,
    complete_check_run,
    determine_conclusion,
    get_check_run_token,
)
from app.scan_service import run_github_repository_scan

client = TestClient(app, raise_server_exceptions=False)

# ---------------------------------------------------------------------------
# Helper: build a valid webhook signature
# ---------------------------------------------------------------------------

_WEBHOOK_SECRET = "test_webhook_secret_123"


def _sign(body: bytes) -> str:
    digest = hmac.new(
        _WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()
    return f"sha256={digest}"


def _post_webhook(payload: dict, event: str, delivery: str = "cr-test-001"):
    body = json.dumps(payload).encode()
    return client.post(
        "/api/github/webhook",
        content=body,
        headers={
            "X-GitHub-Event": event,
            "X-Hub-Signature-256": _sign(body),
            "X-GitHub-Delivery": delivery,
        },
    )


# ---------------------------------------------------------------------------
# Fake HTTP response for mocking urllib.request.urlopen
# ---------------------------------------------------------------------------

class _FakeHTTPResponse:
    """Minimal fake to replace the object returned by urllib.request.urlopen."""

    def __init__(self, body: dict, status: int = 200):
        self._data = json.dumps(body).encode("utf-8")
        self.status = status

    def read(self):
        return self._data

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass


# ===========================================================================
# A / B / C / D / E / F  — create_check_run unit tests
# ===========================================================================

class TestCreateCheckRun(unittest.TestCase):

    def _mock_create(self, response_body: dict):
        """Return a context-manager patch for urlopen that yields a fake response."""
        return patch(
            "app.github_checks.urllib.request.urlopen",
            return_value=_FakeHTTPResponse(response_body),
        )

    def _capture_request(self, response_body: dict):
        """Patch urlopen AND capture the Request object passed to it."""
        captured = {}

        def fake_urlopen(req, timeout=30):
            captured["req"] = req
            return _FakeHTTPResponse(response_body)

        patcher = patch(
            "app.github_checks.urllib.request.urlopen",
            side_effect=fake_urlopen,
        )
        return patcher, captured

    # A. Creation succeeds (no exception)
    def test_create_check_run_succeeds(self):
        with self._mock_create({"id": 42, "name": CHECK_RUN_NAME}):
            check_id = create_check_run(
                owner="dev", repo="myapp",
                head_sha="abc123", access_token="tok",
            )
        self.assertIsNotNone(check_id)

    # B. Creation returns check_run_id
    def test_create_check_run_returns_id(self):
        with self._mock_create({"id": 999, "name": CHECK_RUN_NAME}):
            check_id = create_check_run(
                owner="dev", repo="myapp",
                head_sha="abc123", access_token="tok",
            )
        self.assertEqual(check_id, 999)

    # C. Correct owner/repo in API URL
    def test_create_check_run_uses_correct_owner_repo(self):
        patcher, captured = self._capture_request({"id": 1})
        with patcher:
            create_check_run(
                owner="alice", repo="project",
                head_sha="sha1", access_token="tok",
            )
        self.assertIn("/repos/alice/project/check-runs", captured["req"].full_url)

    # D. Correct head SHA in request body
    def test_create_check_run_uses_correct_head_sha(self):
        patcher, captured = self._capture_request({"id": 2})
        with patcher:
            create_check_run(
                owner="alice", repo="project",
                head_sha="deadbeef1234", access_token="tok",
            )
        body = json.loads(captured["req"].data.decode())
        self.assertEqual(body["head_sha"], "deadbeef1234")

    # E. Correct check name in request body
    def test_create_check_run_uses_correct_check_name(self):
        patcher, captured = self._capture_request({"id": 3})
        with patcher:
            create_check_run(
                owner="alice", repo="project",
                head_sha="sha", access_token="tok",
            )
        body = json.loads(captured["req"].data.decode())
        self.assertEqual(body["name"], CHECK_RUN_NAME)
        self.assertEqual(body["name"], "Rakshak Security Scan")

    # F. Initial status is in_progress
    def test_create_check_run_status_is_in_progress(self):
        patcher, captured = self._capture_request({"id": 4})
        with patcher:
            create_check_run(
                owner="alice", repo="project",
                head_sha="sha", access_token="tok",
            )
        body = json.loads(captured["req"].data.decode())
        self.assertEqual(body["status"], "in_progress")


# ===========================================================================
# G — complete_check_run unit tests
# ===========================================================================

class TestCompleteCheckRun(unittest.TestCase):

    def _mock_complete(self, response_body: dict = None):
        return patch(
            "app.github_checks.urllib.request.urlopen",
            return_value=_FakeHTTPResponse(response_body or {"id": 10}),
        )

    def _capture_complete(self, response_body: dict = None):
        captured = {}

        def fake_urlopen(req, timeout=30):
            captured["req"] = req
            return _FakeHTTPResponse(response_body or {"id": 10})

        patcher = patch(
            "app.github_checks.urllib.request.urlopen",
            side_effect=fake_urlopen,
        )
        return patcher, captured

    # G. Completion succeeds
    def test_complete_check_run_succeeds(self):
        with self._mock_complete():
            complete_check_run(
                owner="dev", repo="myapp", check_run_id=10,
                scan_id="scan-uuid-001",
                total_findings=3, critical_count=0, high_count=1,
                medium_count=2, low_count=0, overall_risk=45.5,
                access_token="tok",
            )  # must not raise

    # Correct URL contains check_run_id
    def test_complete_check_run_uses_correct_url(self):
        patcher, captured = self._capture_complete()
        with patcher:
            complete_check_run(
                owner="dev", repo="myapp", check_run_id=77,
                scan_id="scan-uuid-002",
                total_findings=0, critical_count=0, high_count=0,
                medium_count=0, low_count=0, overall_risk=0.0,
                access_token="tok",
            )
        self.assertIn("/check-runs/77", captured["req"].full_url)
        self.assertEqual(captured["req"].get_method(), "PATCH")

    def test_complete_status_is_completed(self):
        patcher, captured = self._capture_complete()
        with patcher:
            complete_check_run(
                owner="dev", repo="myapp", check_run_id=1,
                scan_id="s", total_findings=0, critical_count=0,
                high_count=0, medium_count=0, low_count=0, overall_risk=0.0,
                access_token="tok",
            )
        body = json.loads(captured["req"].data.decode())
        self.assertEqual(body["status"], "completed")


# ===========================================================================
# H / I — determine_conclusion unit tests
# ===========================================================================

class TestDetermineConclusion(unittest.TestCase):

    # H. success when critical == 0
    def test_conclusion_success_when_no_critical(self):
        self.assertEqual(determine_conclusion(0), "success")

    def test_conclusion_success_with_only_high(self):
        # High findings alone do NOT trigger failure in Phase 3A policy
        self.assertEqual(determine_conclusion(0), "success")

    # I. failure when critical > 0
    def test_conclusion_failure_when_critical_1(self):
        self.assertEqual(determine_conclusion(1), "failure")

    def test_conclusion_failure_when_critical_many(self):
        self.assertEqual(determine_conclusion(10), "failure")

    def test_conclusion_failure_not_affected_by_others(self):
        # Even with critical=1 it is always failure
        self.assertEqual(determine_conclusion(1), "failure")


# ===========================================================================
# J / K / L / M — build_check_run_output unit tests
# ===========================================================================

class TestBuildCheckRunOutput(unittest.TestCase):

    def _output(self, critical=0, high=0, medium=0, low=0,
                total=0, risk=0.0, conclusion="success",
                scan_id="test-scan-id"):
        return build_check_run_output(
            scan_id=scan_id,
            total_findings=total,
            critical_count=critical,
            high_count=high,
            medium_count=medium,
            low_count=low,
            overall_risk=risk,
            conclusion=conclusion,
        )

    # J. Output contains total findings
    def test_output_contains_total_findings(self):
        out = self._output(total=8)
        self.assertIn("8", out["summary"])

    # K. Output contains severity counts
    def test_output_contains_critical_count(self):
        out = self._output(critical=3)
        self.assertIn("3", out["summary"])

    def test_output_contains_high_count(self):
        out = self._output(high=2)
        self.assertIn("2", out["summary"])

    def test_output_contains_medium_count(self):
        out = self._output(medium=4)
        self.assertIn("4", out["summary"])

    def test_output_contains_low_count(self):
        out = self._output(low=1)
        self.assertIn("1", out["summary"])

    # L. Output contains risk score
    def test_output_contains_risk_score(self):
        out = self._output(risk=67.89)
        self.assertIn("67.89", out["summary"])

    # M. Output contains Rakshak scan ID
    def test_output_contains_scan_id(self):
        out = self._output(scan_id="6a225712-3403-44d6-83a5-e1d3de5779a4")
        self.assertIn("6a225712-3403-44d6-83a5-e1d3de5779a4", out["summary"])

    def test_output_title_is_check_run_name(self):
        out = self._output()
        self.assertEqual(out["title"], CHECK_RUN_NAME)

    def test_output_failure_summary_mentions_critical(self):
        out = self._output(critical=2, conclusion="failure")
        self.assertIn("critical", out["summary"].lower())

    def test_output_success_summary_no_critical_issues(self):
        out = self._output(critical=0, conclusion="success")
        self.assertIn("No critical", out["summary"])


# ===========================================================================
# N / O / P / Q / R / S — HTTP error handling unit tests
# ===========================================================================

class TestCheckRunHTTPErrors(unittest.TestCase):

    def _make_http_error(self, code: int):
        """Build a fake urllib.error.HTTPError."""
        import urllib.error
        return urllib.error.HTTPError(
            url="https://api.github.com/repos/x/y/check-runs",
            code=code,
            msg=f"HTTP {code}",
            hdrs=None,
            fp=BytesIO(b'{"message": "error"}'),
        )

    def _patch_urlopen_error(self, code: int):
        exc = self._make_http_error(code)
        return patch(
            "app.github_checks.urllib.request.urlopen",
            side_effect=exc,
        )

    def _assert_check_run_error(self, code: int):
        with self._patch_urlopen_error(code):
            with self.assertRaises(CheckRunError):
                create_check_run(
                    owner="x", repo="y",
                    head_sha="sha", access_token="tok",
                )

    # N. 401
    def test_401_raises_check_run_error(self):
        self._assert_check_run_error(401)

    # O. 403
    def test_403_raises_check_run_error(self):
        self._assert_check_run_error(403)

    # P. 404
    def test_404_raises_check_run_error(self):
        self._assert_check_run_error(404)

    # Q. 422
    def test_422_raises_check_run_error(self):
        self._assert_check_run_error(422)

    # R. 429
    def test_429_raises_check_run_error(self):
        self._assert_check_run_error(429)

    # S. 500
    def test_500_raises_check_run_error(self):
        self._assert_check_run_error(500)

    def test_503_raises_check_run_error(self):
        self._assert_check_run_error(503)

    def test_network_error_raises_check_run_error(self):
        import urllib.error
        exc = urllib.error.URLError("connection refused")
        with patch("app.github_checks.urllib.request.urlopen", side_effect=exc):
            with self.assertRaises(CheckRunError):
                create_check_run(
                    owner="x", repo="y",
                    head_sha="sha", access_token="tok",
                )


# ===========================================================================
# T — Check Run failure does NOT fail the PostgreSQL scan
# ===========================================================================

# ---------------------------------------------------------------------------
# Module-level fake download (avoid self-arg issues in @patch side_effect)
# ---------------------------------------------------------------------------

def _fake_download_checks(*args, **kwargs):
    import tempfile
    td = tempfile.TemporaryDirectory()
    import os as _os
    dummy = _os.path.join(td.name, "dummy.py")
    open(dummy, "w").write("x = 1\n")
    return td, td.name


class TestCheckRunFailureDoesNotFailScan(unittest.TestCase):

    def _make_finding(self):
        return {
            "vulnerability_id": "TEST-001",
            "title": "Test finding",
            "description": "desc",
            "tool": "test_scanner",
            "severity": "low",
            "priority": "low",
            "risk_score": 1.0,
            "exploitability": 0.1,
            "target": "file.py",
            "package_name": "",
            "installed_version": "",
            "fixed_version": "",
            "fix_available": False,
            "production": False,
            "affected_packages": None,
        }

    @patch("app.scan_service.create_check_run", side_effect=CheckRunError("create failed"))
    @patch("app.scan_service.download_repository", side_effect=_fake_download_checks)
    @patch("app.scan_service.run_code_scan")
    @patch("app.scan_service.run_dependency_scan", return_value=[])
    @patch("app.scan_service.run_secret_scan", return_value=[])
    @patch("app.scan_service.get_check_run_token", return_value="fake-token")
    def test_check_run_create_failure_does_not_fail_scan(
        self, mock_token, mock_secret, mock_dep, mock_code, mock_dl, mock_cr
    ):
        """When create_check_run raises CheckRunError, the scan must still complete."""
        from app.database import SessionLocal, Base, engine
        from app.models import Scan

        Base.metadata.create_all(bind=engine)
        mock_code.return_value = [self._make_finding()]

        db = SessionLocal()
        try:
            scan_id = run_github_repository_scan(
                db=db,
                owner="failcr", repo="failrepo",
                ref="abc", access_token=None,
                code_scanning=True, dependency_scanning=False,
                secret_detection=False,
                trigger="pull_request",
                pr_head_sha="deadbeef",
                check_run_access_token="fake-token",
            )

            scan = db.query(Scan).filter(Scan.id == scan_id).first()
            self.assertIsNotNone(scan)
            self.assertEqual(scan.status, "completed")
        finally:
            db.close()

    @patch("app.scan_service.complete_check_run", side_effect=CheckRunError("complete failed"))
    @patch("app.scan_service.create_check_run", return_value=999)
    @patch("app.scan_service.download_repository", side_effect=_fake_download_checks)
    @patch("app.scan_service.run_code_scan", return_value=[])
    @patch("app.scan_service.run_dependency_scan", return_value=[])
    @patch("app.scan_service.run_secret_scan", return_value=[])
    @patch("app.scan_service.get_check_run_token", return_value="fake-token")
    def test_check_run_complete_failure_does_not_fail_scan(
        self, mock_token, mock_secret, mock_dep, mock_code, mock_dl, mock_cr_create, mock_cr_complete
    ):
        """When complete_check_run raises CheckRunError, the scan record stays completed."""
        from app.database import SessionLocal, Base, engine
        from app.models import Scan

        Base.metadata.create_all(bind=engine)

        db = SessionLocal()
        try:
            scan_id = run_github_repository_scan(
                db=db,
                owner="failcr2", repo="failrepo2",
                ref="abc", access_token=None,
                code_scanning=True, dependency_scanning=False,
                secret_detection=False,
                trigger="pull_request",
                pr_head_sha="deadbeef",
                check_run_access_token="fake-token",
            )

            scan = db.query(Scan).filter(Scan.id == scan_id).first()
            self.assertIsNotNone(scan)
            self.assertEqual(scan.status, "completed")
        finally:
            db.close()



# ===========================================================================
# get_check_run_token unit tests
# ===========================================================================

class TestGetCheckRunToken(unittest.TestCase):

    def test_explicit_token_returned(self):
        self.assertEqual(get_check_run_token("my-token"), "my-token")

    def test_env_token_used_when_no_explicit(self):
        with patch.dict(os.environ, {"GITHUB_CHECK_RUN_TOKEN": "env-token"}):
            self.assertEqual(get_check_run_token(None), "env-token")

    def test_returns_none_when_no_token(self):
        env = {k: v for k, v in os.environ.items() if k != "GITHUB_CHECK_RUN_TOKEN"}
        with patch.dict(os.environ, env, clear=True):
            result = get_check_run_token(None)
        self.assertIsNone(result)

    def test_explicit_token_takes_priority_over_env(self):
        with patch.dict(os.environ, {"GITHUB_CHECK_RUN_TOKEN": "env-token"}):
            self.assertEqual(get_check_run_token("explicit"), "explicit")


# ===========================================================================
# W / X — Manual scan + OAuth endpoint regressions
# ===========================================================================

# Phase 11A: webhook scans require a resolved Rakshak workspace association.
from conftest import ensure_webhook_workspace  # noqa: E402

ensure_webhook_workspace(repository_full_name="dev/app", login="webhook-test-dev")


class TestPhase3ARegressions(unittest.TestCase):

    _DELIVERY_IDS = ["ping-cr-001", "pr-cr-001"]

    def setUp(self):
        from unittest.mock import MagicMock, patch
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

        # Patch Celery delay so webhook tests don't hang waiting for a broker.
        mock_task = MagicMock()
        mock_task.id = "test-task-regression"
        self._delay_patcher = patch(
            "app.main.run_github_repository_scan_task.delay",
            return_value=mock_task,
        )
        self._delay_patcher.start()

    def tearDown(self):
        self._delay_patcher.stop()

    # W. Manual scan endpoint still returns 401 without auth (not 404/405/500)
    def test_manual_scan_requires_auth(self):
        r = client.post("/api/github/scan", json={"owner": "x", "repo": "y"})
        self.assertEqual(r.status_code, 401)

    def test_manual_scan_endpoint_not_removed(self):
        r = client.post("/api/github/scan", json={"owner": "x", "repo": "y"})
        self.assertNotIn(r.status_code, [404, 405])

    # X. OAuth endpoints still present
    def test_health_still_200(self):
        r = client.get("/health")
        self.assertEqual(r.status_code, 200)

    def test_auth_me_does_not_500(self):
        r = client.get("/api/auth/me")
        self.assertNotIn(r.status_code, [500])

    def test_webhook_ping_still_works(self):
        ping = {"zen": "keep it simple", "hook_id": 1}
        r = _post_webhook(ping, "ping", delivery="ping-cr-001")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["status"], "ok")

    def test_pr_webhook_still_accepted(self):
        pr_payload = {
            "number": 99,
            "action": "opened",
            "pull_request": {
                "title": "feat",
                "state": "open",
                "draft": False,
                "head": {"ref": "feat/x", "sha": "aaabbb"},
                "base": {"ref": "main"},
            },
            "repository": {
                "id": 1,
                "full_name": "dev/app",
                "name": "app",
                "owner": {"login": "dev"},
            },
        }
        r = _post_webhook(pr_payload, "pull_request", delivery="pr-cr-001")
        self.assertIn(r.status_code, [200, 202])
        data = r.json()
        self.assertEqual(data["status"], "accepted")
        self.assertTrue(data["scan_queued"])


# ===========================================================================
# U / V — Phase 1 + Phase 2 regression markers
#           (imported to ensure they are still collected by pytest)
# ===========================================================================

class TestPhase1Phase2RegressionImport(unittest.TestCase):

    def test_github_webhook_module_importable(self):
        """Phase 1: webhook module must still be importable and functional."""
        from app.github_webhook import (
            verify_github_signature,
            get_webhook_secret,
            extract_push_event_metadata,
            extract_pull_request_event_metadata,
        )
        self.assertTrue(callable(verify_github_signature))

    def test_scan_service_module_importable(self):
        """Phase 2: scan_service module must still be importable."""
        from app.scan_service import (
            run_github_repository_scan,
            run_github_repository_scan_background,
        )
        self.assertTrue(callable(run_github_repository_scan))

    def test_github_checks_module_importable(self):
        """Phase 3A: github_checks module is importable."""
        from app.github_checks import (
            create_check_run,
            complete_check_run,
            determine_conclusion,
            build_check_run_output,
            get_check_run_token,
            CheckRunError,
        )
        self.assertTrue(callable(create_check_run))


# ---------------------------------------------------------------------------
# Entry-point for plain python execution
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromModule(sys.modules[__name__])
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
