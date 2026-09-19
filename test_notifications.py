"""Tests for workspace-scoped notifications system."""

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Finding, Notification, Scan, User
from app.notification_service import create_scan_notifications
from conftest import authenticate_client, create_workspace_user


class TestNotificationService:
    def test_scan_completed_notifications_creation(self):
        db = SessionLocal()
        user = create_workspace_user(881001, "notif-alice")

        scan = Scan(
            id=str(uuid.uuid4()),
            target_path="/repo/demo-project",
            repository="notif-alice/demo-project",
            status="completed",
            total_findings=12,
            critical_count=2,
            high_count=3,
            medium_count=4,
            low_count=3,
            user_id=user.id,
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
        )
        db.add(scan)
        db.commit()

        findings = [
            Finding(
                scan_id=scan.id,
                vulnerability_id="CVE-2026-0001",
                title="SQL Injection",
                tool="semgrep",
                severity="critical",
                lifecycle_status="new",
            ),
            Finding(
                scan_id=scan.id,
                vulnerability_id="CVE-2026-0002",
                title="Command Injection",
                tool="semgrep",
                severity="high",
                lifecycle_status="new",
            ),
        ]
        db.add_all(findings)
        db.commit()

        notifs = create_scan_notifications(db, scan, findings, fixed_count=1)
        db.commit()

        types = {n.notification_type for n in notifs}
        assert "scan_completed" in types
        assert "critical_finding" in types
        assert "high_finding" in types
        assert "new_finding" in types
        assert "fixed_finding" in types

        scan_comp = next(n for n in notifs if n.notification_type == "scan_completed")
        assert "12 findings detected" in scan_comp.message
        assert scan_comp.severity == "info"

        crit = next(n for n in notifs if n.notification_type == "critical_finding")
        assert "2 critical findings detected" in crit.message
        assert crit.severity == "critical"

        high = next(n for n in notifs if n.notification_type == "high_finding")
        assert "3 high severity findings detected" in high.message
        assert high.severity == "high"

        new_notif = next(n for n in notifs if n.notification_type == "new_finding")
        assert "2 new security findings detected" in new_notif.message

        fixed_notif = next(n for n in notifs if n.notification_type == "fixed_finding")
        assert "1 finding was resolved" in fixed_notif.message

        db.close()

    def test_failed_scan_notification(self):
        db = SessionLocal()
        user = create_workspace_user(881002, "notif-bob")

        scan = Scan(
            id=str(uuid.uuid4()),
            target_path="/repo/failed-project",
            repository="notif-bob/failed-project",
            status="failed",
            total_findings=0,
            user_id=user.id,
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
        )
        db.add(scan)
        db.commit()

        notifs = create_scan_notifications(db, scan)
        db.commit()

        assert len(notifs) == 1
        assert notifs[0].notification_type == "scan_failed"
        assert notifs[0].severity == "high"
        assert "Security scan failed" in notifs[0].title
        db.close()

    def test_unowned_scan_produces_no_notifications(self):
        db = SessionLocal()
        scan = Scan(
            id=str(uuid.uuid4()),
            target_path="/repo/unowned",
            repository="unowned/repo",
            status="completed",
            total_findings=5,
            critical_count=1,
            user_id=None,
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
        )
        db.add(scan)
        db.commit()

        notifs = create_scan_notifications(db, scan)
        assert len(notifs) == 0
        db.close()

    def test_deduplication_prevents_duplicate_notifications(self):
        db = SessionLocal()
        user = create_workspace_user(881003, "notif-charlie")

        scan = Scan(
            id=str(uuid.uuid4()),
            target_path="/repo/project",
            repository="notif-charlie/project",
            status="completed",
            total_findings=5,
            critical_count=1,
            high_count=0,
            user_id=user.id,
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
        )
        db.add(scan)
        db.commit()

        # First run
        notifs_1 = create_scan_notifications(db, scan)
        db.commit()
        assert len(notifs_1) == 2  # scan_completed + critical_finding

        # Second run (accidental rerun of same scan processing)
        notifs_2 = create_scan_notifications(db, scan)
        db.commit()
        assert len(notifs_2) == 0

        # Total in DB should still be 2
        total = db.query(Notification).filter(Notification.scan_id == scan.id).count()
        assert total == 2
        db.close()


class TestNotificationEndpoints:
    def test_endpoints_require_authentication(self):
        client = TestClient(app)
        res_get = client.get("/api/notifications")
        assert res_get.status_code == 401

        res_read = client.post("/api/notifications/1/read")
        assert res_read.status_code == 401

        res_read_all = client.post("/api/notifications/read-all")
        assert res_read_all.status_code == 401

    def test_notifications_crud_and_isolation(self):
        db = SessionLocal()
        user_a = create_workspace_user(882001, "notif-dave")
        user_b = create_workspace_user(882002, "notif-eve")

        # Create notifications for user A
        n_a1 = Notification(
            user_id=user_a.id,
            notification_type="scan_completed",
            title="Scan A1",
            message="Completed",
            severity="info",
            is_read=False,
            created_at=datetime.now(timezone.utc),
        )
        n_a2 = Notification(
            user_id=user_a.id,
            notification_type="critical_finding",
            title="Critical A2",
            message="1 critical finding",
            severity="critical",
            is_read=False,
            created_at=datetime.now(timezone.utc),
        )
        # Create notification for user B
        n_b = Notification(
            user_id=user_b.id,
            notification_type="scan_completed",
            title="Scan B",
            message="Completed B",
            severity="info",
            is_read=False,
            created_at=datetime.now(timezone.utc),
        )
        db.add_all([n_a1, n_a2, n_b])
        db.commit()
        n_a1_id = n_a1.id
        n_b_id = n_b.id
        db.close()

        client_a = TestClient(app)
        authenticate_client(client_a, user_a)

        # 1. GET /api/notifications returns only User A's notifications
        res = client_a.get("/api/notifications")
        assert res.status_code == 200
        data = res.json()
        assert data["unread_count"] >= 2
        ids = [n["id"] for n in data["notifications"]]
        assert n_a1_id in ids
        assert n_b_id not in ids

        # 2. Repeated GET does not create new notifications
        res_repeat = client_a.get("/api/notifications")
        assert res_repeat.status_code == 200
        assert res_repeat.json()["unread_count"] == data["unread_count"]

        # 3. POST /api/notifications/{id}/read for user A's notification
        res_read = client_a.post(f"/api/notifications/{n_a1_id}/read")
        assert res_read.status_code == 200
        assert res_read.json()["is_read"] is True

        # 4. User A cannot mark User B's notification as read
        res_forbidden = client_a.post(f"/api/notifications/{n_b_id}/read")
        assert res_forbidden.status_code == 404

        # 5. POST /api/notifications/read-all marks remaining unread as read
        res_all = client_a.post("/api/notifications/read-all")
        assert res_all.status_code == 200
        assert res_all.json()["unread_count"] == 0

        res_after = client_a.get("/api/notifications")
        assert res_after.json()["unread_count"] == 0

        # Switch to User B and verify User B's notification remains unread
        client_b = TestClient(app)
        authenticate_client(client_b, user_b)
        res_b = client_b.get("/api/notifications")
        assert res_b.status_code == 200
        assert res_b.json()["unread_count"] >= 1
        b_ids = [n["id"] for n in res_b.json()["notifications"]]
        assert n_b_id in b_ids
        assert n_a1_id not in b_ids
