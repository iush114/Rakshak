from datetime import datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import pytest

from app.database import Base
from app.finding_lifecycle import process_completed_scan_lifecycle
from app.models import Finding, FindingLifecycle, Scan


engine = create_engine("sqlite:///:memory:")
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)


@pytest.fixture(autouse=True)
def reset_database():
    db = TestingSession()
    db.query(Finding).delete()
    db.query(FindingLifecycle).delete()
    db.query(Scan).delete()
    db.commit()
    db.close()


def make_scan(db, scan_id, repository, *, code=True, dependency=True, secret=True, container=True, status="completed", offset=0):
    started = datetime(2026, 9, 16, 12, 0, 0) + timedelta(minutes=offset)
    scan = Scan(
        id=scan_id,
        target_path=f"github.com/{repository}",
        repository=repository,
        status=status,
        code_scanning=code,
        dependency_scanning=dependency,
        secret_detection=secret,
        container_scanning=container,
        started_at=started,
        completed_at=started + timedelta(seconds=1) if status == "completed" else None,
    )
    db.add(scan)
    db.flush()
    return scan


def make_finding(scan_id, vulnerability_id, *, tool="Code Scanner", package="", target="src/app.py"):
    return Finding(
        scan_id=scan_id,
        vulnerability_id=vulnerability_id,
        title=vulnerability_id,
        description="",
        tool=tool,
        scanner_type={"Code Scanner": "code", "Trivy SCA": "dependency", "Secret Detection": "secret", "Container Scan": "container"}.get(tool, "code"),
        severity="high",
        priority="High",
        risk_score=7.5,
        exploitability=0.5,
        target=target,
        package_name=package,
        installed_version="1.0",
        fixed_version="",
        fix_available=False,
        production=False,
    )


def run_scan(db, scan_id, repository, findings, **scope):
    scan = make_scan(db, scan_id, repository, **scope, offset=db.query(Scan).count())
    for finding in findings:
        db.add(finding)
    scan.total_findings = len(findings)
    process_completed_scan_lifecycle(db, scan, findings)
    db.commit()
    return scan


def test_new_open_fixed_reopened_and_timestamps():
    db = TestingSession()
    first = make_finding("scan-1", "CVE-1", package="requests")
    run_scan(db, "scan-1", "acme/api", [first])
    assert first.lifecycle_status == "new"
    first_seen = first.first_seen_at

    second = make_finding("scan-2", "CVE-1", package="requests")
    run_scan(db, "scan-2", "acme/api", [second])
    assert second.lifecycle_status == "open"
    assert second.occurrence_count == 2
    assert second.first_seen_at == first_seen
    assert second.last_seen_at > first_seen

    third = run_scan(db, "scan-3", "acme/api", [])
    lifecycle = db.query(FindingLifecycle).one()
    assert lifecycle.lifecycle_status == "fixed"
    assert lifecycle.fixed_at is not None
    assert third.status == "completed"

    fourth = make_finding("scan-4", "CVE-1", package="requests")
    run_scan(db, "scan-4", "acme/api", [fourth])
    assert fourth.lifecycle_status == "reopened"
    assert fourth.reopened_at is not None
    assert fourth.occurrence_count == 3
    db.close()


def test_repository_and_vulnerability_identity_are_independent():
    db = TestingSession()
    api = make_finding("scan-a", "CVE-1", package="requests")
    web = make_finding("scan-b", "CVE-1", package="requests")
    other = make_finding("scan-c", "CVE-2", package="requests")
    run_scan(db, "scan-a", "acme/api", [api])
    run_scan(db, "scan-b", "acme/web", [web])
    run_scan(db, "scan-c", "acme/api", [other])
    assert db.query(FindingLifecycle).count() == 3
    db.close()


def test_failed_running_and_queued_scans_do_not_change_lifecycle():
    db = TestingSession()
    first = make_finding("scan-1", "CVE-1")
    run_scan(db, "scan-1", "acme/api", [first])
    for scan_id, status in (("scan-2", "failed"), ("scan-3", "running"), ("scan-4", "queued")):
        scan = make_scan(db, scan_id, "acme/api", status=status)
        process_completed_scan_lifecycle(db, scan, [])
        db.commit()
    assert db.query(FindingLifecycle).one().lifecycle_status == "new"
    db.close()


def test_partial_scans_only_close_enabled_scanner_types():
    db = TestingSession()
    dependency = make_finding("scan-1", "CVE-DEP", tool="Trivy SCA", package="requests", target="requirements.txt")
    secret = make_finding("scan-1", "SECRET-1", tool="Secret Detection", target=".env")
    run_scan(db, "scan-1", "acme/api", [dependency, secret])

    code_only = make_scan(db, "scan-2", "acme/api", code=True, dependency=False, secret=False, container=False, offset=2)
    process_completed_scan_lifecycle(db, code_only, [])
    db.commit()
    states = {row.vulnerability_id: row.lifecycle_status for row in db.query(FindingLifecycle).all()}
    assert states == {"CVE-DEP": "new", "SECRET-1": "new"}

    full = make_scan(db, "scan-3", "acme/api", code=True, dependency=True, secret=True, container=True, offset=3)
    process_completed_scan_lifecycle(db, full, [])
    db.commit()
    states = {row.vulnerability_id: row.lifecycle_status for row in db.query(FindingLifecycle).all()}
    assert states == {"CVE-DEP": "fixed", "SECRET-1": "fixed"}
    db.close()
