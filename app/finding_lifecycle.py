"""Finding identity and lifecycle transitions for completed scans."""

import hashlib
import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import Finding, FindingLifecycle, Scan


SCANNER_TYPES = ("code", "dependency", "secret", "container")


def scanner_type_for_tool(tool: str) -> str:
    value = (tool or "").lower()
    if "secret" in value or "gitleaks" in value:
        return "secret"
    if "container" in value or "image" in value or "docker" in value:
        return "container"
    if "trivy" in value or "depend" in value or "sca" in value:
        return "dependency"
    return "code"


def finding_context(scan: Scan) -> str:
    return scan.repository or scan.target_path


def make_finding_key(scan: Scan, finding: Finding) -> str:
    """Stable identity: target context, scanner family, vulnerability, location and package."""
    value = {
        "context": finding_context(scan),
        "scanner_type": finding.scanner_type or scanner_type_for_tool(finding.tool),
        "vulnerability_id": finding.vulnerability_id.strip().lower(),
        "package_name": finding.package_name.strip().lower(),
        "target": finding.target.strip().lower(),
    }
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def enabled_scanner_types(scan: Scan) -> set[str]:
    return {
        scanner_type
        for scanner_type, enabled in {
            "code": scan.code_scanning,
            "dependency": scan.dependency_scanning,
            "secret": scan.secret_detection,
            "container": scan.container_scanning,
        }.items()
        if enabled
    }


def _copy_lifecycle_to_findings(db: Session, lifecycle: FindingLifecycle) -> None:
    db.query(Finding).filter(Finding.finding_key == lifecycle.finding_key).update(
        {
            "lifecycle_status": lifecycle.lifecycle_status,
            "first_seen_at": lifecycle.first_seen_at,
            "last_seen_at": lifecycle.last_seen_at,
            "fixed_at": lifecycle.fixed_at,
            "reopened_at": lifecycle.reopened_at,
            "occurrence_count": lifecycle.occurrence_count,
        },
        synchronize_session=False,
    )


def process_completed_scan_lifecycle(
    db: Session,
    scan: Scan,
    findings: list[Finding],
) -> None:
    """Apply lifecycle changes inside the caller's transaction."""
    if scan.status != "completed":
        return

    now = scan.completed_at or datetime.utcnow()
    context = finding_context(scan)
    enabled_types = enabled_scanner_types(scan)
    current_by_key: dict[str, Finding] = {}
    current_lifecycles: list[FindingLifecycle] = []

    for finding in findings:
        if not finding.scanner_type or finding.scanner_type == "unknown":
            finding.scanner_type = scanner_type_for_tool(finding.tool)
        finding.finding_key = make_finding_key(scan, finding)
        if finding.finding_key in current_by_key:
            first_finding = current_by_key[finding.finding_key]
            finding.lifecycle_status = first_finding.lifecycle_status
            finding.first_seen_at = first_finding.first_seen_at
            finding.last_seen_at = first_finding.last_seen_at
            finding.fixed_at = first_finding.fixed_at
            finding.reopened_at = first_finding.reopened_at
            finding.occurrence_count = first_finding.occurrence_count
            continue
        current_by_key[finding.finding_key] = finding

        lifecycle = db.query(FindingLifecycle).filter(
            FindingLifecycle.finding_key == finding.finding_key
        ).one_or_none()
        if lifecycle is None:
            lifecycle = FindingLifecycle(
                finding_key=finding.finding_key,
                context=context,
                scanner_type=finding.scanner_type,
                vulnerability_id=finding.vulnerability_id,
                package_name=finding.package_name,
                target=finding.target,
                lifecycle_status="new",
                first_seen_at=now,
                last_seen_at=now,
                occurrence_count=1,
                first_seen_scan_id=scan.id,
                last_seen_scan_id=scan.id,
            )
            db.add(lifecycle)
        else:
            lifecycle.lifecycle_status = "reopened" if lifecycle.lifecycle_status == "fixed" else "open"
            lifecycle.last_seen_at = now
            lifecycle.fixed_at = None
            lifecycle.reopened_at = now if lifecycle.lifecycle_status == "reopened" else lifecycle.reopened_at
            lifecycle.occurrence_count += 1
            lifecycle.last_seen_scan_id = scan.id

        current_lifecycles.append(lifecycle)

        finding.lifecycle_status = lifecycle.lifecycle_status
        finding.first_seen_at = lifecycle.first_seen_at
        finding.last_seen_at = lifecycle.last_seen_at
        finding.fixed_at = lifecycle.fixed_at
        finding.reopened_at = lifecycle.reopened_at
        finding.occurrence_count = lifecycle.occurrence_count

    db.flush()
    for lifecycle in current_lifecycles:
        _copy_lifecycle_to_findings(db, lifecycle)

    existing = db.query(FindingLifecycle).filter(
        FindingLifecycle.context == context,
        FindingLifecycle.scanner_type.in_(enabled_types or ("__none__",)),
        FindingLifecycle.lifecycle_status != "fixed",
    ).all()
    fixed_count = 0
    for lifecycle in existing:
        if lifecycle.finding_key in current_by_key:
            continue
        lifecycle.lifecycle_status = "fixed"
        lifecycle.fixed_at = now
        fixed_count += 1
        _copy_lifecycle_to_findings(db, lifecycle)
    return fixed_count