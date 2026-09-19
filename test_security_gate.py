from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.github_checks import build_check_run_output, complete_check_run, determine_conclusion
from app.models import Finding, Scan
from app.security_gate import evaluate_security_gate, persist_security_gate


engine = create_engine("sqlite:///:memory:")
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(engine)


def scan(db, scan_id, *, status="completed", code=True, dependency=True, secret=True, container=False):
    record = Scan(
        id=scan_id,
        target_path="github.com/acme/api",
        repository="acme/api",
        status=status,
        code_scanning=code,
        dependency_scanning=dependency,
        secret_detection=secret,
        container_scanning=container,
        started_at=datetime(2026, 9, 16, 12, 0),
        completed_at=datetime(2026, 9, 16, 12, 1) if status == "completed" else None,
    )
    db.add(record)
    db.flush()
    return record


def finding(scan_id, severity):
    return Finding(
        scan_id=scan_id,
        vulnerability_id=f"V-{severity}",
        title="Finding",
        description="",
        tool="Code Scanner",
        scanner_type="code",
        severity=severity,
        priority=severity,
        risk_score=5,
        exploitability=0.5,
        target="app.py",
        package_name="",
        installed_version="",
        fixed_version="",
        fix_available=False,
        production=False,
        lifecycle_status="open",
    )


def test_no_or_noncritical_findings_pass():
    for index, severities in enumerate(([], ["low"], ["medium"], ["high"])):
        db = TestingSession()
        record = scan(db, f"pass-{index}")
        rows = [finding(record.id, severity) for severity in severities]
        db.add_all(rows)
        db.flush()
        result = evaluate_security_gate(db, record)
        assert result["status"] == "PASS"
        db.close()


def test_critical_current_scan_fails_and_persists():
    db = TestingSession()
    record = scan(db, "fail-1")
    db.add_all([finding(record.id, "critical"), finding(record.id, "high")])
    db.flush()
    result = persist_security_gate(db, record)
    db.commit()
    assert result["status"] == "FAIL"
    assert record.security_gate_status == "FAIL"
    assert record.security_gate_reason
    db.close()


def test_fixed_historical_finding_does_not_fail_empty_current_scan():
    db = TestingSession()
    previous = scan(db, "previous-1")
    old_finding = finding(previous.id, "critical")
    old_finding.lifecycle_status = "fixed"
    db.add(old_finding)
    db.flush()

    current = scan(db, "current-1")
    result = evaluate_security_gate(db, current)
    assert result["status"] == "PASS"
    assert result["critical_count"] == 0
    db.close()


def test_partial_and_invalid_scan_never_pass():
    db = TestingSession()
    partial = scan(db, "partial-1", dependency=False, secret=False)
    assert evaluate_security_gate(db, partial)["status"] == "UNKNOWN"
    for status in ("failed", "running", "queued", "cancelled"):
        invalid = scan(db, f"{status}-1", status=status)
        assert evaluate_security_gate(db, invalid)["status"] == "ERROR"
    db.close()


def test_check_run_uses_gate_and_explains_counts():
    assert determine_conclusion(0, "PASS") == "success"
    assert determine_conclusion(0, "FAIL") == "failure"
    assert determine_conclusion(0, "UNKNOWN") == "neutral"
    output = build_check_run_output(
        scan_id="scan-1",
        total_findings=4,
        critical_count=1,
        high_count=2,
        medium_count=1,
        low_count=0,
        overall_risk=55.5,
        conclusion="failure",
        gate_status="FAIL",
        gate_reason="Active critical findings detected.",
    )
    assert "Rakshak Security Gate: FAIL" in output["summary"]
    assert "Active critical findings detected." in output["summary"]
    assert "Critical | 1 |" in output["summary"]
    assert "High     | 2 |" in output["summary"]
