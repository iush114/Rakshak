"""Deterministic security-gate policy for completed pull-request scans."""

from sqlalchemy.orm import Session

from app.models import Finding, Scan


FINAL_SCANNERS = ("code", "dependency", "secret")
GATE_STATUSES = {"PASS", "FAIL", "UNKNOWN", "ERROR"}


def _counts(findings: list[Finding]) -> dict[str, int]:
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for finding in findings:
        severity = (finding.severity or "low").lower()
        counts[severity if severity in counts else "low"] += 1
    return counts


def _scope(scan: Scan) -> list[str]:
    return [
        scanner_type
        for scanner_type, enabled in {
            "code": scan.code_scanning,
            "dependency": scan.dependency_scanning,
            "secret": scan.secret_detection,
            "container": scan.container_scanning,
        }.items()
        if enabled
    ]


def evaluate_security_gate(db: Session, scan: Scan) -> dict:
    """Evaluate only findings belonging to this exact scan.

    A final PASS/FAIL requires the standard code, dependency, and secret
    scanners. Container scanning is optional because it is disabled by the
    existing default PR scan configuration.
    """
    current_findings = db.query(Finding).filter(Finding.scan_id == scan.id).all()
    counts = _counts([f for f in current_findings if f.lifecycle_status != "fixed"])
    scope = _scope(scan)

    result = {
        "scan_id": scan.id,
        "status": "UNKNOWN",
        "reason": "",
        "total_findings": sum(counts.values()),
        "critical_count": counts["critical"],
        "high_count": counts["high"],
        "medium_count": counts["medium"],
        "low_count": counts["low"],
        "active_findings": sum(counts.values()),
        "scope": scope,
    }

    if scan.status != "completed":
        result["status"] = "ERROR"
        result["reason"] = f"Scan is {scan.status}; no final security gate was evaluated."
        return result

    missing = [scanner_type for scanner_type in FINAL_SCANNERS if scanner_type not in scope]
    if missing:
        result["reason"] = (
            "Partial scan scope; final gate requires code, dependency, and secret scanning. "
            f"Missing: {', '.join(missing)}."
        )
        return result

    if counts["critical"] > 0:
        result["status"] = "FAIL"
        result["reason"] = "Active critical findings detected in the current completed scan."
    else:
        result["status"] = "PASS"
        result["reason"] = "No active critical findings detected in the current completed scan."
    return result


def persist_security_gate(db: Session, scan: Scan) -> dict:
    result = evaluate_security_gate(db, scan)
    if result["status"] not in GATE_STATUSES:
        raise ValueError("Invalid security gate status")
    scan.security_gate_status = result["status"]
    scan.security_gate_reason = result["reason"]
    db.flush()
    return result