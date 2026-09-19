import os
import sys
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("SESSION_SECRET", "test-session-secret-for-testing")
os.environ.setdefault("GITHUB_WEBHOOK_SECRET", "test_webhook_secret_123")

if os.path.dirname(os.path.abspath(__file__)) not in sys.path:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.main import app
from app.models import Finding, Scan
from conftest import authenticate_client, create_workspace_user

# Phase 11A: scan history is workspace-scoped. Every request is made by an
# authenticated Rakshak workspace — the session carries the internal User.id.
owner = create_workspace_user(
    github_user_id=904500101,
    github_login="scan-history-owner",
    name="Scan History Owner",
)

client = TestClient(app)
authenticate_client(client, owner)

UNOWNED_SCAN_ID = "phase7-unowned-scan"
OTHER_WORKSPACE_SCAN_ID = "phase7-other-workspace-scan"


@pytest.fixture
def scans():
    db = SessionLocal()
    now = datetime.utcnow()
    records = [
        Scan(
            id="phase7-scan-a",
            target_path="github.com/acme/api",
            repository="acme/api",
            status="completed",
            event_type="push",
            ref="main",
            commit_sha="a" * 40,
            total_findings=2,
            critical_count=1,
            high_count=1,
            overall_risk=42.5,
            started_at=now,
            completed_at=now + timedelta(seconds=3),
            user_id=owner.id,
        ),
        Scan(
            id="phase7-scan-b",
            target_path="github.com/acme/web",
            repository="acme/web",
            status="failed",
            event_type="pull_request",
            ref="refs/pull/2/head",
            commit_sha="b" * 40,
            started_at=now - timedelta(minutes=1),
            user_id=owner.id,
        ),
        Scan(
            id="phase7-scan-c",
            target_path="github.com/acme/api",
            repository="acme/api",
            status="completed",
            event_type="manual",
            ref="release",
            commit_sha="c" * 40,
            started_at=now - timedelta(minutes=2),
            user_id=owner.id,
        ),
    ]
    scan_ids = [record.id for record in records]
    db.query(Finding).filter(Finding.scan_id.in_(scan_ids)).delete(synchronize_session=False)
    db.query(Scan).filter(Scan.id.in_(scan_ids)).delete(synchronize_session=False)
    db.add_all(records)
    db.commit()
    yield records
    db.query(Finding).filter(Finding.scan_id.in_(scan_ids)).delete(synchronize_session=False)
    db.query(Scan).filter(Scan.id.in_(scan_ids)).delete(synchronize_session=False)
    db.commit()
    db.close()


def test_scan_history_list_pagination_and_order(scans):
    response = client.get("/api/scans", params={"repository": "acme/api", "limit": 2, "offset": 0})
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert data["limit"] == 2
    assert data["offset"] == 0
    assert [item["scan_id"] for item in data["items"]] == ["phase7-scan-a", "phase7-scan-c"]


def test_scan_history_filters_and_total(scans):
    response = client.get("/api/scans", params={"repository": "acme/api", "status": "completed", "event_type": "push"})
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["scan_id"] == "phase7-scan-a"
    assert client.get("/api/scans", params={"repository": "missing/repo"}).json()["items"] == []


def test_scan_history_detail_and_404(scans):
    response = client.get("/api/scans/phase7-scan-a")
    assert response.status_code == 200
    assert response.json()["repository"] == "acme/api"
    assert response.json()["findings"] == []
    assert client.get("/api/scans/missing-scan").status_code == 404


def test_scan_history_limit_validation(scans):
    assert client.get("/api/scans", params={"limit": 101}).status_code == 422


# ---------------------------------------------------------------------------
# Phase 11A — workspace isolation
# ---------------------------------------------------------------------------

def test_scan_history_requires_authentication(scans):
    """An unauthenticated client must not receive workspace scan data."""
    anonymous = TestClient(app)
    assert anonymous.get("/api/scans").status_code == 401
    assert anonymous.get("/api/scans/phase7-scan-a").status_code == 401


def test_unowned_historical_scans_are_hidden(scans):
    """Historical scans with NULL ownership belong to no workspace."""
    db = SessionLocal()
    now = datetime.utcnow()
    db.query(Scan).filter(Scan.id == UNOWNED_SCAN_ID).delete(synchronize_session=False)
    db.add(Scan(
        id=UNOWNED_SCAN_ID,
        target_path="github.com/legacy/repo",
        repository="legacy/repo",
        status="completed",
        event_type="manual",
        started_at=now,
        user_id=None,
    ))
    db.commit()
    db.close()

    try:
        assert client.get("/api/scans/%s" % UNOWNED_SCAN_ID).status_code == 404
        listing = client.get("/api/scans", params={"repository": "legacy/repo"}).json()
        assert listing["total"] == 0
        assert listing["items"] == []
    finally:
        db = SessionLocal()
        db.query(Scan).filter(Scan.id == UNOWNED_SCAN_ID).delete(synchronize_session=False)
        db.commit()
        db.close()


def test_other_workspace_scan_is_not_accessible(scans):
    """Another workspace must not read a foreign scan by changing the UUID."""
    other = create_workspace_user(
        github_user_id=904500102,
        github_login="scan-history-other",
        name="Other Workspace",
    )
    db = SessionLocal()
    now = datetime.utcnow()
    db.query(Scan).filter(Scan.id == OTHER_WORKSPACE_SCAN_ID).delete(synchronize_session=False)
    db.add(Scan(
        id=OTHER_WORKSPACE_SCAN_ID,
        target_path="github.com/other/repo",
        repository="other/repo",
        status="completed",
        event_type="push",
        started_at=now,
        user_id=other.id,
    ))
    db.commit()
    db.close()

    other_client = TestClient(app)
    authenticate_client(other_client, other)

    try:
        # Owner sees their own scan; the foreign workspace must not (404, so a
        # scan's existence is never disclosed across workspaces).
        assert other_client.get("/api/scans/%s" % OTHER_WORKSPACE_SCAN_ID).status_code == 200
        assert client.get("/api/scans/%s" % OTHER_WORKSPACE_SCAN_ID).status_code == 404
        assert other_client.get("/api/scans/%s/security-gate" % OTHER_WORKSPACE_SCAN_ID).status_code == 200
        assert client.get("/api/scans/%s/security-gate" % OTHER_WORKSPACE_SCAN_ID).status_code == 404
        assert client.get("/api/scans", params={"repository": "other/repo"}).json()["total"] == 0
    finally:
        db = SessionLocal()
        db.query(Finding).filter(Finding.scan_id == OTHER_WORKSPACE_SCAN_ID).delete(synchronize_session=False)
        db.query(Scan).filter(Scan.id == OTHER_WORKSPACE_SCAN_ID).delete(synchronize_session=False)
        db.commit()
        db.close()
