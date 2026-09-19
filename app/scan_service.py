"""
app/scan_service.py
===================
Shared GitHub repository scanning pipeline.

Both the manual ``POST /api/github/scan`` endpoint and the webhook-triggered
background task call ``run_github_repository_scan()`` so there is a single
authoritative implementation.

Responsibilities
----------------
- Download the target repository at the specified ref (commit SHA / branch / tag).
- Run the enabled scanners (code, dependency, secret, container).
- Enrich findings with AI/rule-based analysis.
- Persist a ``Scan`` + ``Finding`` records to PostgreSQL.
- Handle status transitions: queued → running → completed / failed.
- Clean up temporary files in all code paths.
- Create and update GitHub Check Runs for PR scans (if a token is available).

Authentication note (IMPORTANT)
--------------------------------
``access_token`` is **optional** (``None`` is accepted).

- If provided (manual scan): standard GitHub API authentication is used.
- If ``None`` (webhook scan): the function attempts a **public, unauthenticated**
  ZIP download.  This works for **public repositories only**.
  Private repositories will raise ``RuntimeError`` with an informative message.

This is a **development-phase limitation**.  A production deployment would
store server-side GitHub App installation credentials keyed to each repository
owner/repo pair, eliminating the need for user OAuth tokens in the background.

Check Run note
--------------
``check_run_access_token`` is the token used **only** for GitHub Check Run API
calls.  It is separate from ``access_token`` (used for repository download)
because:
- Webhook PR scans have no OAuth token for downloading private repos, but
  *may* have a server-side ``GITHUB_CHECK_RUN_TOKEN`` for reporting.
- Manual scans can pass the OAuth token for both download and reporting.

If ``check_run_access_token`` is ``None`` and ``GITHUB_CHECK_RUN_TOKEN`` env
var is also unset, Check Run creation is silently skipped and the limitation
is logged.  The security scan always proceeds regardless.

Scan failures do NOT invalidate Check Run creation, and Check Run failures
do NOT invalidate the PostgreSQL scan record.

Usage
-----
::

    scan_id = run_github_repository_scan(
        db=db,
        owner="alice",
        repo="myproject",
        ref="refs/heads/main",       # branch ref or commit SHA
        access_token=token_or_none,
        code_scanning=True,
        dependency_scanning=True,
        secret_detection=True,
        container_scanning=False,
        container_image=None,
        trigger="manual",            # "manual" | "push" | "pull_request"
        delivery_id=None,
        pr_head_sha=None,            # PR head SHA → enables Check Run
        check_run_access_token=None, # token for GitHub Check Run API
    )
"""

import logging
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.ai_analyzer import analyze_finding
from app.database import SessionLocal
from app.github_app import get_installation_access_token, GitHubAppError
from app.github_checks import CheckRunError, create_check_run, complete_check_run, get_check_run_token
from app.github_service import download_repository
from app.models import Finding, Scan
from app.finding_lifecycle import process_completed_scan_lifecycle
from app.notification_service import create_scan_notifications
from app.security_gate import persist_security_gate
from app.scanner_service import (
    run_code_scan,
    run_dependency_scan,
    run_container_scan,
    run_secret_scan,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def run_github_repository_scan(
    *,
    db: Session,
    owner: str,
    repo: str,
    ref: Optional[str],
    access_token: Optional[str],
    code_scanning: bool = True,
    dependency_scanning: bool = True,
    secret_detection: bool = True,
    container_scanning: bool = False,
    container_image: Optional[str] = None,
    trigger: str = "manual",
    delivery_id: Optional[str] = None,
    pr_head_sha: Optional[str] = None,
    check_run_access_token: Optional[str] = None,
    installation_id: Optional[int] = None,
    owner_user_id: Optional[int] = None,
) -> str:
    """Download and scan a GitHub repository, persisting results to PostgreSQL.

    Args:
        db:                      Active SQLAlchemy session (caller is responsible
                                 for lifecycle management).
        owner:                   GitHub repository owner (login).
        repo:                    GitHub repository name.
        ref:                     Git ref to download (branch name, commit SHA, tag).
                                 Pass ``None`` to download the default branch.
        access_token:            GitHub OAuth access token for repository download,
                                 or ``None`` for a public-repository unauthenticated
                                 download.
        code_scanning:           Run custom code pattern scanner.
        dependency_scanning:     Run Trivy filesystem dependency scan.
        secret_detection:        Run Gitleaks secret detection.
        container_scanning:      Run Trivy container image scan.
        container_image:         Container image name (required when
                                 ``container_scanning=True``).
        trigger:                 Human-readable label for how the scan was started
                                 (e.g. ``"manual"``, ``"push"``, ``"pull_request"``).
        delivery_id:             GitHub webhook delivery ID for logging (optional).
        pr_head_sha:             PR head commit SHA.  When provided, a GitHub Check
                                 Run is created before scanning and completed after.
                                 If ``None``, no Check Run is created.
        check_run_access_token:  GitHub access token used **only** for Check Run API
                                 calls.  Separate from ``access_token`` because
                                 webhook background tasks may have a server-side
                                 reporting token without a download token.
                                 Falls back to ``GITHUB_CHECK_RUN_TOKEN`` env var.
                                 If neither is available, Check Run is skipped.
        installation_id:         GitHub App installation ID (integer). When present,
                                 Rakshak obtains a short-lived installation access
                                 token for downloading private repositories and
                                 publishing Check Runs.
        owner_user_id:           Internal Rakshak ``User.id`` of the owning workspace.
                                 ``None`` only for legacy/system invocations — the
                                 webhook path and all authenticated endpoints must
                                 always provide a resolved owner.

    Returns:
        The UUID string of the created ``Scan`` record.

    Raises:
        ValueError:   If ``container_scanning`` is ``True`` but no
                      ``container_image`` was given.
        RuntimeError: If the repository download fails (e.g. private repo with
                      no access token, network error).
    """
    repository_id = f"github.com/{owner}/{repo}"

    logger.info(
        "[Scan] Starting scan: trigger=%s delivery=%s repo=%s ref=%s installation=%s",
        trigger,
        delivery_id or "n/a",
        repository_id,
        ref or "default",
        installation_id or "n/a",
    )

    # ----------------------------------------------------------------
    # Resolve tokens (OAuth / Installation / Check Run)
    # ----------------------------------------------------------------
    effective_download_token = access_token
    effective_check_run_token = check_run_access_token

    if installation_id:
        try:
            installation_token = get_installation_access_token(installation_id)
            if not effective_download_token:
                effective_download_token = installation_token
            if not effective_check_run_token:
                effective_check_run_token = installation_token
        except Exception as app_exc:
            logger.warning(
                "[Scan] Failed to obtain installation access token for installation=%s (falling back): %s",
                installation_id,
                str(app_exc),
            )

    # Resolve Check Run token (priority: explicit -> installation token -> env fallback)
    _check_token = get_check_run_token(effective_check_run_token)
    _check_run_id: Optional[int] = None

    # ----------------------------------------------------------------
    # Create Check Run — in_progress (best-effort; never blocks scan)
    # ----------------------------------------------------------------
    if pr_head_sha and _check_token:
        try:
            _check_run_id = create_check_run(
                owner=owner,
                repo=repo,
                head_sha=pr_head_sha,
                access_token=_check_token,
            )
        except CheckRunError as cr_exc:
            logger.warning(
                "[Scan] Check Run creation failed (scan will proceed): %s",
                str(cr_exc),
            )
    elif pr_head_sha and not _check_token:
        logger.info(
            "[Scan] Check Run skipped — no token available for repo=%s "
            "(set GITHUB_CHECK_RUN_TOKEN to enable PR Check Runs for webhook scans)",
            repository_id,
        )

    # ----------------------------------------------------------------
    # Create scan record — status = "running"
    # ----------------------------------------------------------------
    scan_id = str(uuid.uuid4())

    # Resolve commit SHA if available
    effective_commit_sha = pr_head_sha
    if not effective_commit_sha and ref and len(ref) == 40 and not ref.startswith("refs/"):
        effective_commit_sha = ref

    scan = Scan(
        id=scan_id,
        target_path=repository_id,
        repository=f"{owner}/{repo}",
        event_type=trigger,
        ref=ref,
        commit_sha=effective_commit_sha,
        status="running",
        code_scanning=code_scanning,
        dependency_scanning=dependency_scanning,
        secret_detection=secret_detection,
        container_scanning=container_scanning,
        total_findings=0,
        critical_count=0,
        high_count=0,
        medium_count=0,
        low_count=0,
        overall_risk=0.0,
        started_at=datetime.utcnow(),
        user_id=owner_user_id,
    )

    db.add(scan)
    db.commit()

    logger.info(
        "[Scan] Scan record created: scan_id=%s repo=%s",
        scan_id,
        repository_id,
    )

    temp_directory = None

    try:
        # ----------------------------------------------------------------
        # Validate container_image when needed
        # ----------------------------------------------------------------
        if container_scanning and not container_image:
            raise ValueError(
                "container_image is required when container_scanning is enabled"
            )

        # ----------------------------------------------------------------
        # Download repository
        # ----------------------------------------------------------------
        temp_directory, repository_path = _download(
            access_token=effective_download_token,
            owner=owner,
            repo=repo,
            ref=ref,
        )

        # ----------------------------------------------------------------
        # Run scanners
        # ----------------------------------------------------------------
        all_findings = []

        if code_scanning:
            logger.info("[Scan] Code scanning: scan_id=%s", scan_id)
            all_findings.extend((finding, "code") for finding in run_code_scan(repository_path))

        if dependency_scanning:
            logger.info("[Scan] Dependency scanning: scan_id=%s", scan_id)
            all_findings.extend((finding, "dependency") for finding in run_dependency_scan(repository_path))

        if secret_detection:
            logger.info("[Scan] Secret detection: scan_id=%s", scan_id)
            all_findings.extend((finding, "secret") for finding in run_secret_scan(repository_path))

        if container_scanning:
            logger.info("[Scan] Container scanning: scan_id=%s image=%s", scan_id, container_image)
            all_findings.extend((finding, "container") for finding in run_container_scan(container_image))

        # ----------------------------------------------------------------
        # Enrich findings and persist
        # ----------------------------------------------------------------
        critical_count = 0
        high_count = 0
        medium_count = 0
        low_count = 0
        total_risk = 0.0

        finding_models = []
        for finding, scanner_type in all_findings:
            if hasattr(finding, "__dict__"):
                finding_data = finding.__dict__.copy()
            else:
                finding_data = dict(finding)

            finding_data.pop("_sa_instance_state", None)

            # AI / rule-based enrichment
            try:
                enriched = analyze_finding(finding_data, use_ai=False)
            except TypeError:
                enriched = analyze_finding(finding_data)

            severity = str(enriched.get("severity", "low")).lower()

            if severity == "critical":
                critical_count += 1
            elif severity == "high":
                high_count += 1
            elif severity == "medium":
                medium_count += 1
            else:
                low_count += 1

            risk_score = float(enriched.get("risk_score", 0) or 0)
            total_risk += risk_score

            finding_model = Finding(
                scan_id=scan_id,
                scanner_type=scanner_type,
                vulnerability_id=str(enriched.get("vulnerability_id", "")),
                title=str(enriched.get("title", "")),
                description=str(enriched.get("description", "")),
                tool=str(enriched.get("tool", "")),
                severity=severity,
                priority=str(enriched.get("priority", "")),
                risk_score=risk_score,
                exploitability=float(enriched.get("exploitability", 0) or 0),
                target=str(enriched.get("target", "")),
                package_name=str(enriched.get("package_name", "")),
                installed_version=str(enriched.get("installed_version", "")),
                fixed_version=str(enriched.get("fixed_version", "")),
                fix_available=bool(enriched.get("fix_available", False)),
                production=bool(enriched.get("production", False)),
                affected_packages=enriched.get("affected_packages"),
                ai_explanation="",
                potential_impact="",
                recommended_action="",
                risk_summary="",
            )

            db.add(finding_model)
            finding_models.append(finding_model)

        # ----------------------------------------------------------------
        # Risk calculation
        # ----------------------------------------------------------------
        total_findings = len(all_findings)
        overall_risk = (
            round(total_risk / total_findings, 2) if total_findings > 0 else 0.0
        )

        # ----------------------------------------------------------------
        # Mark scan completed
        # ----------------------------------------------------------------
        scan.status = "completed"
        scan.total_findings = total_findings
        scan.critical_count = critical_count
        scan.high_count = high_count
        scan.medium_count = medium_count
        scan.low_count = low_count
        scan.overall_risk = overall_risk
        scan.completed_at = datetime.utcnow()

        fixed_count = process_completed_scan_lifecycle(db, scan, finding_models)
        gate_result = persist_security_gate(db, scan)
        create_scan_notifications(db, scan, finding_models, fixed_count=fixed_count)

        db.commit()

        logger.info(
            "[Scan] Scan completed: scan_id=%s repo=%s findings=%d risk=%.2f",
            scan_id,
            repository_id,
            total_findings,
            overall_risk,
        )

        # ----------------------------------------------------------------
        # Complete Check Run (best-effort; scan result is authoritative)
        # ----------------------------------------------------------------
        if _check_run_id is not None and _check_token:
            try:
                complete_check_run(
                    owner=owner,
                    repo=repo,
                    check_run_id=_check_run_id,
                    scan_id=scan_id,
                    total_findings=total_findings,
                    critical_count=critical_count,
                    high_count=high_count,
                    medium_count=medium_count,
                    low_count=low_count,
                    overall_risk=overall_risk,
                    access_token=_check_token,
                    gate_status=gate_result["status"],
                    gate_reason=gate_result["reason"],
                )
            except CheckRunError as cr_exc:
                # Do NOT re-raise — the scan is complete and valid.
                logger.warning(
                    "[Scan] Check Run completion failed (scan record is still valid): %s",
                    str(cr_exc),
                )

        return scan_id

    except Exception as exc:
        # Mark failed — do not expose internal errors to the webhook caller
        db.rollback()
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        if scan:
            scan.status = "failed"
            scan.completed_at = datetime.utcnow()
            create_scan_notifications(db, scan)

        try:
            db.commit()
        except Exception:
            db.rollback()

        logger.error(
            "[Scan] Scan failed: scan_id=%s repo=%s error=%s",
            scan_id,
            repository_id,
            str(exc),
        )

        raise

    finally:
        if temp_directory is not None:
            try:
                temp_directory.cleanup()
            except Exception as cleanup_exc:
                logger.warning(
                    "[Scan] Temp directory cleanup failed: scan_id=%s error=%s",
                    scan_id,
                    str(cleanup_exc),
                )


# ---------------------------------------------------------------------------
# Background task entry point
# ---------------------------------------------------------------------------

def run_github_repository_scan_background(
    owner: str,
    repo: str,
    ref: Optional[str],
    access_token: Optional[str],
    code_scanning: bool,
    dependency_scanning: bool,
    secret_detection: bool,
    container_scanning: bool,
    container_image: Optional[str],
    trigger: str,
    delivery_id: Optional[str],
    pr_head_sha: Optional[str] = None,
    check_run_access_token: Optional[str] = None,
    installation_id: Optional[int] = None,
) -> None:
    """Background task wrapper that creates its own DB session.

    FastAPI ``BackgroundTasks`` runs this in the same thread after the
    response has been sent.  We cannot reuse the request-scoped ``Session``
    from the HTTP handler, so we open a fresh one here.

    PRODUCTION NOTE:
    This approach is suitable for single-instance development deployments.
    For production, replace with a durable task queue (e.g. Celery + Redis)
    so scans survive server restarts and can be distributed across workers.
    """
    db = SessionLocal()

    try:
        run_github_repository_scan(
            db=db,
            owner=owner,
            repo=repo,
            ref=ref,
            access_token=access_token,
            code_scanning=code_scanning,
            dependency_scanning=dependency_scanning,
            secret_detection=secret_detection,
            container_scanning=container_scanning,
            container_image=container_image,
            trigger=trigger,
            delivery_id=delivery_id,
            pr_head_sha=pr_head_sha,
            check_run_access_token=check_run_access_token,
            installation_id=installation_id,
        )
    except Exception as exc:
        # Errors are already logged and persisted inside
        # run_github_repository_scan; nothing more to do here.
        logger.debug(
            "[Scan] Background task exiting with error: %s", str(exc)
        )
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _download(
    access_token: Optional[str],
    owner: str,
    repo: str,
    ref: Optional[str],
):
    """Download the repository ZIP, with or without an access token.

    For unauthenticated (public) downloads, we pass an empty string token.
    GitHub's zipball endpoint for public repos does not require authentication,
    but ``download_repository`` always constructs an Authorization header.
    We use a sentinel empty-string bearer to make the call; GitHub ignores an
    empty bearer on public resources.

    If the download fails with a non-200 status (e.g. 404/401 on a private
    repo), ``download_repository`` raises ``RuntimeError`` with the HTTP
    status code and response body, which propagates to the caller.
    """
    token = access_token or ""
    return download_repository(token, owner, repo, ref)
