"""Notification generation, deduplication, and workspace delivery."""

import logging
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models import Finding, Notification, Scan

logger = logging.getLogger("rakshak")


def create_scan_notifications(
    db: Session,
    scan: Scan,
    findings: list[Finding] | None = None,
    fixed_count: int = 0,
) -> list[Notification]:
    """Generate and persist deduplicated notifications for completed or failed scans.

    Only scans with an authenticated workspace owner (``scan.user_id`` is not None)
    generate workspace notifications.
    """
    if not scan.user_id:
        return []

    created_notifications: list[Notification] = []
    now = datetime.utcnow()

    def _add_notification(
        notification_type: str,
        title: str,
        message: str,
        severity: str | None = None,
        finding_id: int | None = None,
    ) -> Notification | None:
        # Check if identical notification already exists for this scan
        existing = (
            db.query(Notification)
            .filter(
                Notification.user_id == scan.user_id,
                Notification.scan_id == scan.id,
                Notification.notification_type == notification_type,
            )
            .first()
        )
        if existing:
            return None

        notif = Notification(
            user_id=scan.user_id,
            scan_id=scan.id,
            finding_id=finding_id,
            notification_type=notification_type,
            title=title,
            message=message,
            severity=severity,
            is_read=False,
            created_at=now,
        )
        db.add(notif)
        try:
            db.flush()
            created_notifications.append(notif)
            return notif
        except IntegrityError:
            db.rollback()
            return None

    if scan.status == "completed":
        target_name = scan.repository or (
            scan.target_path.split("/")[-1]
            if "/" in scan.target_path
            else scan.target_path.split("\\")[-1]
        ) or "Repository"

        # 1. Scan completed notification
        total = scan.total_findings or 0
        finding_word = "finding" if total == 1 else "findings"
        _add_notification(
            notification_type="scan_completed",
            title="Security scan completed",
            message=f"{target_name} scan completed — {total} {finding_word} detected.",
            severity="info",
        )

        # 2. Critical findings
        critical_count = scan.critical_count or 0
        if critical_count > 0:
            crit_word = "finding" if critical_count == 1 else "findings"
            first_critical = (
                next((f for f in findings if f.severity.lower() == "critical"), None)
                if findings
                else None
            )
            _add_notification(
                notification_type="critical_finding",
                title="Critical findings detected",
                message=f"{critical_count} critical {crit_word} detected in the latest scan.",
                severity="critical",
                finding_id=first_critical.id if first_critical else None,
            )

        # 3. High findings
        high_count = scan.high_count or 0
        if high_count > 0:
            high_word = "finding" if high_count == 1 else "findings"
            first_high = (
                next((f for f in findings if f.severity.lower() == "high"), None)
                if findings
                else None
            )
            _add_notification(
                notification_type="high_finding",
                title="High severity findings",
                message=f"{high_count} high severity {high_word} detected in the latest scan.",
                severity="high",
                finding_id=first_high.id if first_high else None,
            )

        # 4. New findings detected
        if findings:
            new_count = sum(
                1 for f in findings if getattr(f, "lifecycle_status", None) == "new"
            )
            if new_count > 0:
                new_word = "finding" if new_count == 1 else "findings"
                _add_notification(
                    notification_type="new_finding",
                    title="New findings detected",
                    message=f"{new_count} new security {new_word} detected.",
                    severity="medium",
                )

        # 5. Fixed / Resolved findings
        if fixed_count > 0:
            fixed_msg = (
                f"{fixed_count} findings were resolved since the previous scan."
                if fixed_count != 1
                else "1 finding was resolved since the previous scan."
            )
            _add_notification(
                notification_type="fixed_finding",
                title="Resolved findings",
                message=fixed_msg,
                severity="low",
            )

    elif scan.status == "failed":
        # 6. Scan failed notification
        _add_notification(
            notification_type="scan_failed",
            title="Security scan failed",
            message="Security scan failed. Check the scan details for more information.",
            severity="high",
        )

    return created_notifications
