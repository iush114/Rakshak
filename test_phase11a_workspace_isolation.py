"""Phase 11A — workspace isolation, ownership and server-side authorization.

Covers:
  * GitHub identity (stable ``github_user_id`` upsert, no duplicates)
  * Session carrying the INTERNAL Rakshak ``User.id`` only
  * Workspace scoping of scans / findings / summary / lifecycle counts
  * Object-by-ID authorization (scan detail, security gate, finding, AI)
  * Ownership stamping on /api/scan and /api/github/scan
  * Webhook installation -> workspace resolution (no ownerless scans)
"""

import base64
import hashlib
import hmac
import json
import os
import sys
import tempfile
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from itsdangerous import TimestampSigner

os.environ.setdefault("SESSION_SECRET", "test-session-secret-for-testing")
os.environ.setdefault("GITHUB_WEBHOOK_SECRET", "test_webhook_secret_123")

if os.path.dirname(os.path.abspath(__file__)) not in sys.path:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal  # noqa: E402
from app.main import app, upsert_github_user, _resolve_webhook_workspace  # noqa: E402
from app.models import (  # noqa: E402
    Finding,
    Scan,
    User,
    UserInstallation,
    UserRepository,
)
from conftest import authenticate_client, create_workspace_user  # noqa: E402

SESSION_SECRET = os.environ["SESSION_SECRET"]


def _cleanup(*scan_ids):
    db = SessionLocal()
    try:
        if scan_ids:
            db.query(Finding).filter(Finding.scan_id.in_(scan_ids)).delete(synchronize_session=False)
            db.query(Scan).filter(Scan.id.in_(scan_ids)).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def _map_repository(user_id, repository_full_name, installation_id=None):
    """Associate a repository (and optionally an installation) with a workspace."""
    now = datetime.utcnow()
    db = SessionLocal()
    try:
        existing = (
            db.query(UserRepository)
            .filter(
                UserRepository.user_id == user_id,
                UserRepository.repository_full_name == repository_full_name,
            )
            .first()
        )
        if existing is None:
            db.add(UserRepository(
                user_id=user_id,
                repository_full_name=repository_full_name,
                installation_id=installation_id,
                created_at=now,
                last_seen_at=now,
            ))
        else:
            existing.installation_id = installation_id or existing.installation_id
            existing.last_seen_at = now
        db.commit()
    finally:
        db.close()


def _map_installation(installation_id, user_id):
    """Map a GitHub App installation to a Rakshak workspace."""
    now = datetime.utcnow()
    db = SessionLocal()
    try:
        existing = (
            db.query(UserInstallation)
            .filter(UserInstallation.installation_id == installation_id)
            .first()
        )
        if existing is None:
            db.add(UserInstallation(
                installation_id=installation_id,
                user_id=user_id,
                created_at=now,
                last_seen_at=now,
            ))
        else:
            existing.user_id = user_id
            existing.last_seen_at = now
        db.commit()
    finally:
        db.close()


def _make_scan(scan_id, user_id, repository="acme/api", status="completed", **kwargs):
    db = SessionLocal()
    now = datetime.utcnow()
    try:
        db.query(Finding).filter(Finding.scan_id == scan_id).delete(synchronize_session=False)
        db.query(Scan).filter(Scan.id == scan_id).delete(synchronize_session=False)
        values = dict(
            id=scan_id,
            target_path=f"github.com/{repository}",
            repository=repository,
            status=status,
            event_type="manual",
            started_at=now,
            completed_at=now,
            user_id=user_id,
        )
        values.update(kwargs)
        db.add(Scan(**values))
        db.commit()
    finally:
        db.close()


def _make_finding(scan_id, vulnerability_id, severity="high", lifecycle_status="open",
                  title="Test finding", tool="trivy", finding_key=None):
    db = SessionLocal()
    try:
        db.add(Finding(
            scan_id=scan_id,
            vulnerability_id=vulnerability_id,
            title=title,
            description="",
            tool=tool,
            severity=severity,
            lifecycle_status=lifecycle_status,
            finding_key=finding_key or f"{scan_id}:{vulnerability_id}",
            scanner_type=tool,
            first_seen_at=datetime.utcnow(),
            last_seen_at=datetime.utcnow(),
        ))
        db.commit()
    finally:
        db.close()


def _session_payload(client):
    """Decode the signed session cookie without trusting its contents."""
    raw = client.cookies.get("session")
    assert raw, "expected a session cookie"
    unsigned = TimestampSigner(SESSION_SECRET).unsign(raw, max_age=3600)
    return json.loads(base64.b64decode(unsigned))


# ===========================================================================
# AUTH / IDENTITY
# ===========================================================================

class TestGitHubIdentity:

    def test_github_user_created_using_stable_github_user_id(self):
        """User.id is an internal PK; github_user_id is the durable identity."""
        db = SessionLocal()
        try:
            user = upsert_github_user(
                db,
                {"id": 910000001, "login": "identity-alpha", "name": "Identity Alpha"},
            )
            assert isinstance(user.id, int)
            assert user.github_user_id == 910000001
            assert user.github_login == "identity-alpha"
        finally:
            db.close()

    def test_github_user_lookup_is_by_stable_id_not_login(self):
        """A renamed login must resolve to the SAME Rakshak user."""
        db = SessionLocal()
        try:
            created = upsert_github_user(
                db, {"id": 910000002, "login": "before-rename", "name": "Rename Me"}
            )
            renamed = upsert_github_user(
                db, {"id": 910000002, "login": "after-rename", "name": "Rename Me"}
            )
            assert renamed.id == created.id
            assert renamed.github_login == "after-rename"
            assert db.query(User).filter(User.github_user_id == 910000002).count() == 1
        finally:
            db.close()

    def test_repeated_oauth_login_does_not_create_duplicate_users(self):
        db = SessionLocal()
        try:
            ids = set()
            for _ in range(3):
                user = upsert_github_user(
                    db, {"id": 910000003, "login": "repeat-login", "name": "Repeat"}
                )
                ids.add(user.id)
            assert len(ids) == 1
            assert db.query(User).filter(User.github_user_id == 910000003).count() == 1
        finally:
            db.close()

    def test_github_login_is_not_used_as_identity_key(self):
        """Two different GitHub ids sharing a login are two distinct workspaces."""
        db = SessionLocal()
        try:
            first = upsert_github_user(db, {"id": 910000004, "login": "shared-login"})
            second = upsert_github_user(db, {"id": 910000005, "login": "shared-login"})
            assert first.id != second.id
        finally:
            db.close()

    def test_session_stores_internal_rakshak_user_id(self):
        user = create_workspace_user(
            github_user_id=911000001,
            github_login="session-owner",
            name="Session Owner",
        )
        client = TestClient(app)
        authenticate_client(client, user)

        payload = _session_payload(client)
        assert payload["user_pk"] == user.id
        assert payload["user_pk"] != user.github_user_id
        assert client.get("/api/auth/me").json()["authenticated"] is True

    def test_session_without_internal_id_is_unauthenticated(self):
        """A session holding only GitHub display data must not authorize."""
        from conftest import signed_session_cookie

        client = TestClient(app)
        client.cookies.set(
            "session",
            signed_session_cookie({"github_user": {"id": 911000002, "login": "no-pk"}}),
        )
        assert client.get("/api/scans").status_code == 401
        assert client.get("/api/summary").status_code == 401

    def test_session_with_unknown_internal_id_is_unauthenticated(self):
        """A forged/foreign internal id must not authorize."""
        from conftest import signed_session_cookie

        client = TestClient(app)
        client.cookies.set("session", signed_session_cookie({"user_pk": 999999999}))
        assert client.get("/api/scans").status_code == 401
        assert client.get("/api/findings").status_code == 401


# ===========================================================================
# OWNERSHIP — scans + findings are scoped to the owning workspace
# ===========================================================================

class TestWorkspaceOwnership:

    @pytest.fixture(autouse=True)
    def workspace_pair(self):
        self.user_a = create_workspace_user(
            github_user_id=912000001, github_login="ws-alpha", name="Workspace Alpha"
        )
        self.user_b = create_workspace_user(
            github_user_id=912000002, github_login="ws-beta", name="Workspace Beta"
        )
        self.client_a = TestClient(app)
        authenticate_client(self.client_a, self.user_a)
        self.client_b = TestClient(app)
        authenticate_client(self.client_b, self.user_b)

        self.scan_a = "p11a-scan-alpha"
        self.scan_b = "p11a-scan-beta"
        self.scan_unowned = "p11a-scan-unowned"

        _make_scan(self.scan_a, self.user_a.id, repository="alpha/only")
        _make_scan(self.scan_b, self.user_b.id, repository="beta/only")
        _make_scan(self.scan_unowned, None, repository="legacy/shared")

        _make_finding(self.scan_a, "CVE-ALPHA-1", title="Alpha finding")
        _make_finding(self.scan_b, "CVE-BETA-1", title="Beta finding")

        yield

        _cleanup(self.scan_a, self.scan_b, self.scan_unowned)

    def test_user_a_sees_only_own_scans(self):
        data = self.client_a.get("/api/scans").json()
        ids = {item["scan_id"] for item in data["items"]}
        assert self.scan_a in ids
        assert self.scan_b not in ids
        assert self.scan_unowned not in ids

    def test_user_b_sees_only_own_scans(self):
        data = self.client_b.get("/api/scans").json()
        ids = {item["scan_id"] for item in data["items"]}
        assert self.scan_b in ids
        assert self.scan_a not in ids
        assert self.scan_unowned not in ids

    def test_user_a_cannot_access_user_b_scan(self):
        assert self.client_a.get("/api/scans/%s" % self.scan_b).status_code == 404

    def test_user_b_cannot_access_user_a_scan(self):
        assert self.client_b.get("/api/scans/%s" % self.scan_a).status_code == 404

    def test_unowned_historical_scan_is_hidden_from_every_workspace(self):
        assert self.client_a.get("/api/scans/%s" % self.scan_unowned).status_code == 404
        assert self.client_b.get("/api/scans/%s" % self.scan_unowned).status_code == 404
        assert self.client_a.get(
            "/api/scans", params={"repository": "legacy/shared"}
        ).json()["total"] == 0

    def test_findings_are_scoped_through_their_scan_owner(self):
        alpha = self.client_a.get("/api/findings").json()
        alpha_ids = {item["vulnerability_id"] for item in alpha}
        assert "CVE-ALPHA-1" in alpha_ids
        assert "CVE-BETA-1" not in alpha_ids

        beta = self.client_b.get("/api/findings").json()
        beta_ids = {item["vulnerability_id"] for item in beta}
        assert "CVE-BETA-1" in beta_ids
        assert "CVE-ALPHA-1" not in beta_ids

    def test_security_gate_is_scoped_to_owner(self):
        assert self.client_a.get(
            "/api/scans/%s/security-gate" % self.scan_a
        ).status_code == 200
        assert self.client_a.get(
            "/api/scans/%s/security-gate" % self.scan_b
        ).status_code == 404

    def test_finding_detail_is_scoped_to_owner(self):
        assert self.client_a.get("/api/findings/CVE-ALPHA-1").status_code == 200
        assert self.client_a.get("/api/findings/CVE-BETA-1").status_code == 404

    def test_ai_analysis_is_scoped_to_owner(self):
        """A foreign workspace must not reach — or mutate — another's finding."""
        assert self.client_a.post("/api/findings/CVE-BETA-1/analyze").status_code == 404

        # The owner's own finding may be analyzed (AI call is stubbed).
        enriched = {
            "ai_explanation": "explanation",
            "potential_impact": "impact",
            "recommended_action": "action",
            "risk_summary": "summary",
        }
        with patch("app.main.analyze_finding", return_value=enriched):
            response = self.client_a.post("/api/findings/CVE-ALPHA-1/analyze")
        assert response.status_code == 200
        assert response.json()["ai_explanation"] == "explanation"


# ===========================================================================
# AUTHENTICATION REQUIRED — every user-owned endpoint
# ===========================================================================

PROTECTED_ENDPOINTS = [
    ("get", "/api/summary", None),
    ("get", "/api/findings", None),
    ("get", "/api/findings/CVE-ANY-1", None),
    ("post", "/api/findings/CVE-ANY-1/analyze", None),
    ("get", "/api/scans", None),
    ("get", "/api/scans/any-scan-id", None),
    ("get", "/api/scans/any-scan-id/security-gate", None),
]


class TestAuthenticationRequired:

    @pytest.mark.parametrize("method,path,payload", PROTECTED_ENDPOINTS)
    def test_anonymous_request_is_unauthorized(self, method, path, payload):
        anonymous = TestClient(app)
        if payload is None:
            response = getattr(anonymous, method)(path)
        else:
            response = getattr(anonymous, method)(path, json=payload)
        assert response.status_code == 401

    def test_local_scan_requires_authentication(self):
        anonymous = TestClient(app)
        response = anonymous.post("/api/scan", json={"target_path": os.getcwd()})
        assert response.status_code == 401

    def test_manual_github_scan_requires_authentication(self):
        anonymous = TestClient(app)
        response = anonymous.post("/api/github/scan", json={"owner": "acme", "repo": "api"})
        assert response.status_code == 401



# ===========================================================================
# SCAN CREATION — ownership is taken from the session, never the request body
# ===========================================================================

_LOCAL_SCAN_OFF = {
    "code_scanning": False,
    "dependency_scanning": False,
    "secret_detection": False,
    "container_scanning": False,
}


class TestScanCreationOwnership:

    def test_local_scan_is_stamped_with_authenticated_owner(self):
        user = create_workspace_user(
            github_user_id=913000001, github_login="local-scan-owner", name="Local Owner"
        )
        client = TestClient(app)
        authenticate_client(client, user)

        target = tempfile.mkdtemp(dir=os.getcwd(), prefix="p11a-target-")
        scan_id = None
        try:
            response = client.post(
                "/api/scan", json=dict({"target_path": target}, **_LOCAL_SCAN_OFF)
            )
            assert response.status_code == 200
            scan_id = response.json()["scan_id"]

            db = SessionLocal()
            try:
                scan = db.query(Scan).filter(Scan.id == scan_id).first()
                assert scan is not None
                assert scan.user_id == user.id
            finally:
                db.close()
        finally:
            if scan_id:
                _cleanup(scan_id)
            try:
                os.rmdir(target)
            except OSError:
                pass
            scan_id = None


# ===========================================================================
# WEBHOOK -> WORKSPACE ASSOCIATION
# ===========================================================================

def _sign(body):
    """Sign using the SAME secret source the app validates with.

    ``get_webhook_secret()`` is resolved per-request, so signing must not
    capture the environment at import time (other test modules legitimately
    mutate ``GITHUB_WEBHOOK_SECRET``).
    """
    from app.github_webhook import get_webhook_secret

    return "sha256=" + hmac.new(
        get_webhook_secret().encode("utf-8"), body, hashlib.sha256
    ).hexdigest()


def _post_webhook(payload, event, delivery):
    body = json.dumps(payload).encode("utf-8")
    return TestClient(app).post(
        "/api/github/webhook",
        content=body,
        headers={
            "X-GitHub-Event": event,
            "X-Hub-Signature-256": _sign(body),
            "X-GitHub-Delivery": delivery,
            "Content-Type": "application/json",
        },
    )


def _push_payload(full_name="acme/api", installation_id=None):
    name = full_name.split("/")[1]
    payload = {
        "ref": "refs/heads/main",
        "after": "d" * 40,
        "repository": {
            "id": 42,
            "name": name,
            "full_name": full_name,
            "default_branch": "main",
            "owner": {"login": full_name.split("/")[0]},
        },
        "commits": [{"id": "d" * 40}],
    }
    if installation_id is not None:
        payload["installation"] = {"id": installation_id}
    return payload


@pytest.fixture(autouse=True)
def _reset_deliveries():
    import app.main as main_module

    if hasattr(main_module, "_processed_deliveries"):
        main_module._processed_deliveries = set()
    yield


class TestWebhookWorkspaceResolution:
    """Unit-level coverage of installation/repository -> workspace resolution."""

    def test_installation_mapping_wins(self):
        user = create_workspace_user(
            github_user_id=914000001, github_login="inst-owner", name="Inst Owner"
        )
        _map_installation(915111999, user.id)
        db = SessionLocal()
        try:
            assert _resolve_webhook_workspace(db, 915111999, "someone/else") == user.id
        finally:
            db.close()

    def test_unambiguous_repository_mapping_is_used(self):
        user = create_workspace_user(
            github_user_id=914000002, github_login="repo-owner", name="Repo Owner"
        )
        _map_repository(user.id, "acme/solo-repo")
        db = SessionLocal()
        try:
            assert _resolve_webhook_workspace(db, None, "acme/solo-repo") == user.id
        finally:
            db.close()

    def test_ambiguous_repository_mapping_is_not_resolved(self):
        """A repository shared by two workspaces must never be guessed."""
        user_a = create_workspace_user(
            github_user_id=914000003, github_login="amb-a", name="Ambiguous A"
        )
        user_b = create_workspace_user(
            github_user_id=914000004, github_login="amb-b", name="Ambiguous B"
        )
        _map_repository(user_a.id, "acme/shared-repo")
        _map_repository(user_b.id, "acme/shared-repo")
        db = SessionLocal()
        try:
            assert _resolve_webhook_workspace(db, None, "acme/shared-repo") is None
        finally:
            db.close()

    def test_unknown_repository_is_not_resolved(self):
        db = SessionLocal()
        try:
            assert _resolve_webhook_workspace(db, None, "nobody/unknown-repo") is None
            assert _resolve_webhook_workspace(db, 999999999, None) is None
        finally:
            db.close()

    def test_github_owner_login_is_never_used_as_identity(self):
        """A login matching nothing in Rakshak must not resolve to a workspace."""
        create_workspace_user(
            github_user_id=914000005, github_login="gh-only-login", name="Login Only"
        )
        db = SessionLocal()
        try:
            assert _resolve_webhook_workspace(db, None, "gh-only-login/repo") is None
        finally:
            db.close()


class TestScanOwnerComesFromSession:
    """The authenticated session decides scan ownership — client input never does."""

    def test_local_scan_rejects_frontend_supplied_owner(self):
        """An owner_user_id in the request body must be ignored."""
        user = create_workspace_user(
            github_user_id=913000002, github_login="body-owner-check", name="Body Owner"
        )
        other = create_workspace_user(
            github_user_id=913000003, github_login="body-owner-other", name="Other Owner"
        )
        client = TestClient(app)
        authenticate_client(client, user)

        target = tempfile.mkdtemp(dir=os.getcwd(), prefix="p11a-target-")
        scan_id = None
        try:
            response = client.post(
                "/api/scan",
                json=dict({"target_path": target, "owner_user_id": other.id}, **_LOCAL_SCAN_OFF),
            )
            assert response.status_code == 200
            scan_id = response.json()["scan_id"]

            db = SessionLocal()
            try:
                scan = db.query(Scan).filter(Scan.id == scan_id).first()
                assert scan.user_id == user.id
                assert scan.user_id != other.id
            finally:
                db.close()
        finally:
            if scan_id:
                _cleanup(scan_id)
            try:
                os.rmdir(target)
            except OSError:
                pass

    def test_github_scan_owner_comes_from_session(self):
        """run_github_repository_scan() receives the session owner's User.id."""
        user = create_workspace_user(
            github_user_id=913000004, github_login="gh-scan-owner", name="GH Owner"
        )
        other = create_workspace_user(
            github_user_id=913000005, github_login="gh-scan-other", name="GH Other"
        )
        client = TestClient(app)
        authenticate_client(client, user)

        with patch("app.main.get_repository", return_value={"default_branch": "main"}), \
             patch("app.main.run_github_repository_scan", return_value="p11a-gh-scan") as scanned, \
             patch("app.main._link_manual_scan_workspace"):
            response = client.post(
                "/api/github/scan",
                json={"owner": "acme", "repo": "api", "owner_user_id": other.id},
            )

        assert response.status_code == 200
        scanned.assert_called_once()
        assert scanned.call_args.kwargs["owner_user_id"] == user.id
        assert scanned.call_args.kwargs["owner_user_id"] != other.id
        # The scanned repository identity still comes from the request, not GitHub.
        assert scanned.call_args.kwargs["owner"] == "acme"
        assert scanned.call_args.kwargs["repo"] == "api"

    def test_github_scan_requires_github_access_token(self):
        """A Rakshak session without a GitHub token cannot start a repo scan."""
        from conftest import signed_session_cookie

        user = create_workspace_user(
            github_user_id=913000006, github_login="no-token-user", name="No Token"
        )
        client = TestClient(app)
        client.cookies.set("session", signed_session_cookie({"user_pk": user.id}))
        response = client.post("/api/github/scan", json={"owner": "acme", "repo": "api"})
        assert response.status_code == 401
        assert response.status_code == 401
        # No GitHub access token in session → cannot start a repository scan.
        assert response.status_code == 401



# ===========================================================================
# WEBHOOK SCAN CREATION — never ownerless
# ===========================================================================

class TestWebhookOwnedScanCreation:

    def test_known_installation_queues_correctly_owned_scan(self):
        user = create_workspace_user(
            github_user_id=914000010, github_login="inst-scan-owner", name="Inst Scan"
        )
        _map_installation(916222111, user.id)

        task = MagicMock()
        task.id = "p11a-task-1"
        with patch("app.main.run_github_repository_scan_task.delay", return_value=task) as delay:
            response = _post_webhook(
                _push_payload("acme/api", installation_id=916222111),
                "push",
                "p11a-del-known-inst",
            )

        assert response.status_code == 202
        assert response.json()["scan_queued"] is True
        delay.assert_called_once()
        assert delay.call_args.kwargs["owner_user_id"] == user.id
        assert delay.call_args.kwargs["installation_id"] == 916222111

    def test_known_repository_queues_correctly_owned_scan(self):
        user = create_workspace_user(
            github_user_id=914000011, github_login="repo-scan-owner", name="Repo Scan"
        )
        _map_repository(user.id, "acme/repo-owned")

        task = MagicMock()
        task.id = "p11a-task-2"
        with patch("app.main.run_github_repository_scan_task.delay", return_value=task) as delay:
            response = _post_webhook(
                _push_payload("acme/repo-owned"), "push", "p11a-del-known-repo"
            )

        assert response.status_code == 202
        delay.assert_called_once()
        assert delay.call_args.kwargs["owner_user_id"] == user.id

    def test_unknown_installation_does_not_create_ownerless_scan(self):
        with patch("app.main.run_github_repository_scan_task.delay") as delay:
            response = _post_webhook(
                _push_payload("acme/unmapped-inst", installation_id=917333222),
                "push",
                "p11a-del-unknown-inst",
            )

        assert response.status_code == 200
        assert response.json()["status"] == "ignored"
        assert response.json()["scan_queued"] is False
        delay.assert_not_called()

    def test_unmapped_repository_does_not_create_ownerless_scan(self):
        with patch("app.main.run_github_repository_scan_task.delay") as delay:
            response = _post_webhook(
                _push_payload("acme/totally-unmapped"), "push", "p11a-del-unmapped-repo"
            )

        assert response.status_code == 200
        assert response.json()["scan_queued"] is False
        delay.assert_not_called()

    def test_ambiguous_repository_does_not_create_ownerless_scan(self):
        user_a = create_workspace_user(
            github_user_id=914000012, github_login="amb-scan-a", name="Amb Scan A"
        )
        user_b = create_workspace_user(
            github_user_id=914000013, github_login="amb-scan-b", name="Amb Scan B"
        )
        _map_repository(user_a.id, "acme/two-workspaces")
        _map_repository(user_b.id, "acme/two-workspaces")

        with patch("app.main.run_github_repository_scan_task.delay") as delay:
            response = _post_webhook(
                _push_payload("acme/two-workspaces"), "push", "p11a-del-ambiguous"
            )

        assert response.json()["scan_queued"] is False
        delay.assert_not_called()

    def test_ignored_delivery_is_recorded_for_audit(self):
        from app.models import GitHubWebhookDelivery

        with patch("app.main.run_github_repository_scan_task.delay"):
            _post_webhook(
                _push_payload("acme/audit-unmapped"), "push", "p11a-del-audit-unmapped"
            )

        db = SessionLocal()
        try:
            delivery = (
                db.query(GitHubWebhookDelivery)
                .filter(GitHubWebhookDelivery.delivery_id == "p11a-del-audit-unmapped")
                .first()
            )
            assert delivery is not None
            assert delivery.status == "ignored"
        finally:
            db.close()

    def test_webhook_deduplication_still_works(self):
        user = create_workspace_user(
            github_user_id=914000014, github_login="dedup-owner", name="Dedup Owner"
        )
        _map_repository(user.id, "acme/dedup-repo")

        task = MagicMock()
        task.id = "p11a-task-dedup"
        payload = _push_payload("acme/dedup-repo")
        with patch("app.main.run_github_repository_scan_task.delay", return_value=task) as delay:
            first = _post_webhook(payload, "push", "p11a-del-dedup-1")
            second = _post_webhook(payload, "push", "p11a-del-dedup-1")

        assert first.status_code == 202
        assert second.json()["status"] == "duplicate"
        delay.assert_called_once()

    def test_webhook_still_requires_valid_signature(self):
        body = json.dumps(_push_payload("acme/api")).encode("utf-8")
        response = TestClient(app).post(
            "/api/github/webhook",
            content=body,
            headers={
                "X-GitHub-Event": "push",
                "X-Hub-Signature-256": "sha256=deadbeef",
                "X-GitHub-Delivery": "p11a-del-bad-sig",
                "Content-Type": "application/json",
            },
        )
        assert response.status_code == 401

    def test_webhook_ping_is_unaffected_by_workspace_resolution(self):
        response = _post_webhook({"zen": "keep it simple"}, "ping", "p11a-del-ping")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


# ===========================================================================
# LIFECYCLE — summary counts never expose global records
# ===========================================================================

class TestLifecycleScoping:

    @pytest.fixture(autouse=True)
    def two_workspaces(self):
        self.user_a = create_workspace_user(
            github_user_id=915000001, github_login="lifecycle-alpha", name="Lifecycle A"
        )
        self.user_b = create_workspace_user(
            github_user_id=915000002, github_login="lifecycle-beta", name="Lifecycle B"
        )
        self.client_a = TestClient(app)
        authenticate_client(self.client_a, self.user_a)
        self.client_b = TestClient(app)
        authenticate_client(self.client_b, self.user_b)

        self.scan_a = "p11a-lifecycle-scan-a"
        self.scan_b = "p11a-lifecycle-scan-b"
        self.scan_unowned = "p11a-lifecycle-scan-unowned"

        # Workspace A: one new + one open finding.
        _make_scan(self.scan_a, self.user_a.id, repository="alpha/life",
                   total_findings=2, started_at=datetime.utcnow())
        _make_finding(self.scan_a, "CVE-LIFE-A1", lifecycle_status="new",
                      finding_key="key-life-a1")
        _make_finding(self.scan_a, "CVE-LIFE-A2", lifecycle_status="open",
                      finding_key="key-life-a2")

        # Workspace B: two fixed findings.
        _make_scan(self.scan_b, self.user_b.id, repository="beta/life",
                   total_findings=2, started_at=datetime.utcnow())
        _make_finding(self.scan_b, "CVE-LIFE-B1", lifecycle_status="fixed",
                      finding_key="key-life-b1")
        _make_finding(self.scan_b, "CVE-LIFE-B2", lifecycle_status="fixed",
                      finding_key="key-life-b2")

        # Unowned historical findings must not leak into any workspace.
        _make_scan(self.scan_unowned, None, repository="legacy/life")
        _make_finding(self.scan_unowned, "CVE-LIFE-OLD1", lifecycle_status="open",
                      finding_key="key-life-old1")
        _make_finding(self.scan_unowned, "CVE-LIFE-OLD2", lifecycle_status="new",
                      finding_key="key-life-old2")

        yield

        _cleanup(self.scan_a, self.scan_b, self.scan_unowned)

    def test_summary_lifecycle_counts_are_workspace_scoped(self):
        summary_a = self.client_a.get("/api/summary").json()
        assert summary_a["new_findings"] == 1
        assert summary_a["open_findings"] == 1
        assert summary_a["fixed_findings"] == 0
        assert summary_a["reopened_findings"] == 0

        summary_b = self.client_b.get("/api/summary").json()
        assert summary_b["new_findings"] == 0
        assert summary_b["open_findings"] == 0
        assert summary_b["fixed_findings"] == 2
        assert summary_b["reopened_findings"] == 0

    def test_summary_does_not_expose_unowned_historical_records(self):
        """Global FindingLifecycle rows / NULL-owner scans must never be counted."""
        for client in (self.client_a, self.client_b):
            summary = client.get("/api/summary").json()
            # Only the two owned findings of each workspace are ever counted.
            assert summary["new_findings"] + summary["open_findings"] + \
                summary["fixed_findings"] + summary["reopened_findings"] == 2

    def test_summary_total_findings_reflects_owned_scan_only(self):
        summary_a = self.client_a.get("/api/summary").json()
        assert summary_a["total_findings"] == 2
        summary_b = self.client_b.get("/api/summary").json()
        assert summary_b["total_findings"] == 2

    def test_findings_endpoint_hides_unowned_historical_findings(self):
        for client in (self.client_a, self.client_b):
            ids = {f["vulnerability_id"] for f in client.get("/api/findings").json()}
            assert "CVE-LIFE-OLD1" not in ids
            assert "CVE-LIFE-OLD2" not in ids

    def test_duplicate_finding_keys_across_scans_are_deduplicated(self):
        """The same logical finding repeated across scans counts once."""
        second_scan = "p11a-lifecycle-scan-a2"
        _make_scan(second_scan, self.user_a.id, repository="alpha/life")
        _make_finding(second_scan, "CVE-LIFE-A1", lifecycle_status="new",
                      finding_key="key-life-a1")
        try:
            summary = self.client_a.get("/api/summary").json()
            assert summary["new_findings"] == 1
        finally:
            _cleanup(second_scan)
