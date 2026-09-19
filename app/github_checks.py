"""
app/github_checks.py
====================
GitHub Check Run integration for Rakshak.

Provides functions to create and complete GitHub Check Runs associated with
PR head commit SHAs.  Check Runs are published via the GitHub REST API.

Security
--------
- ``access_token`` is accepted explicitly; never stored globally, never logged.
- No session cookies or request state are touched here.
- Authorization headers are constructed and sent but never written to logs.

Authentication Limitation (Development Phase)
---------------------------------------------
Webhook-triggered scans currently have no server-side OAuth token.  Check Run
creation for **webhook-triggered** PR scans therefore requires a token to be
supplied from external configuration (e.g. ``GITHUB_CHECK_RUN_TOKEN`` env var).

If no token is available, Check Run creation is skipped and the limitation is
logged.  The security scan itself is NEVER failed or skipped because of this.

A production deployment would use a GitHub App installation token, fetched
server-side via the GitHub App private key + installation ID.

Conclusion Policy
-----------------
The function ``determine_conclusion`` encapsulates the policy mapping scan
results to a GitHub Check Run conclusion.  It is deliberately isolated so it
can be updated without touching any HTTP or scan logic.

Default policy (Phase 3A):
    critical_count > 0  →  "failure"
    otherwise           →  "success"

IMPORTANT: A "failure" Check Run conclusion does NOT automatically block
merging.  That requires separate GitHub repository branch protection rules /
rulesets to be configured, which is out of scope for Phase 3A.

GitHub API endpoints used
--------------------------
POST   /repos/{owner}/{repo}/check-runs           → 201 Created
PATCH  /repos/{owner}/{repo}/check-runs/{id}      → 200 OK

Reference: https://docs.github.com/en/rest/checks/runs
"""

import json
import logging
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GITHUB_API_BASE = "https://api.github.com"
CHECK_RUN_NAME = "Rakshak Security Scan"
_ACCEPT_HEADER = "application/vnd.github+json"
_API_VERSION_HEADER = "2022-11-28"

# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class CheckRunError(Exception):
    """Raised when the GitHub Check Run API call fails.

    This exception must NEVER propagate to scan logic; the scan result is
    authoritative and must not be invalidated by a reporting failure.
    """


# ---------------------------------------------------------------------------
# Token retrieval
# ---------------------------------------------------------------------------


def get_check_run_token(explicit_token: Optional[str] = None) -> Optional[str]:
    """Return an access token for Check Run API calls.

    Priority:
    1. ``explicit_token`` argument (e.g. forwarded from the manual OAuth flow).
    2. ``GITHUB_CHECK_RUN_TOKEN`` environment variable (server-side personal
       access token or GitHub App installation token configured separately).
    3. ``None`` — token is unavailable; Check Run will be skipped.

    The returned value is never logged.

    Args:
        explicit_token: An access token provided by the caller.

    Returns:
        A non-empty access token string, or ``None`` if none is available.
    """
    if explicit_token:
        return explicit_token

    env_token = os.environ.get("GITHUB_CHECK_RUN_TOKEN", "").strip()
    if env_token:
        return env_token

    return None


# ---------------------------------------------------------------------------
# Conclusion policy
# ---------------------------------------------------------------------------


def determine_conclusion(critical_count: int, gate_status: Optional[str] = None) -> str:
    """Map scan severity counts to a GitHub Check Run conclusion string.

    This function is intentionally isolated so the policy can be updated
    (e.g. adding high-count thresholds) without touching API or scan logic.

    Current policy (Phase 3A):
        critical_count > 0  →  "failure"
        otherwise           →  "success"

    Args:
        critical_count: Number of critical-severity findings from the scan.

    Returns:
        A GitHub Check Run conclusion string: ``"failure"`` or ``"success"``.
    """
    if gate_status == "FAIL":
        return "failure"
    if gate_status in {"PASS", "FAIL"}:
        return "success"
    if gate_status in {"UNKNOWN", "ERROR"}:
        return "neutral"
    if critical_count > 0:
        return "failure"
    return "success"


# ---------------------------------------------------------------------------
# Check Run output builder
# ---------------------------------------------------------------------------


def build_check_run_output(
    scan_id: str,
    total_findings: int,
    critical_count: int,
    high_count: int,
    medium_count: int,
    low_count: int,
    overall_risk: float,
    conclusion: str,
    gate_status: Optional[str] = None,
    gate_reason: Optional[str] = None,
) -> dict:
    """Build the ``output`` object for a completed GitHub Check Run.

    The output is intentionally concise.  It never includes raw source code,
    secrets, OAuth tokens, or full vulnerability payloads.

    Args:
        scan_id:        Rakshak PostgreSQL scan UUID (for correlation).
        total_findings: Total number of findings from the scan.
        critical_count: Number of critical-severity findings.
        high_count:     Number of high-severity findings.
        medium_count:   Number of medium-severity findings.
        low_count:      Number of low-severity findings.
        overall_risk:   Weighted risk score (0–100 scale).
        conclusion:     GitHub conclusion string (``"success"`` / ``"failure"``).

    Returns:
        A dict suitable for inclusion as ``"output"`` in a Check Run payload.
    """
    resolved_gate_status = gate_status or ("FAIL" if conclusion == "failure" else "PASS")
    if resolved_gate_status == "FAIL":
        summary_intro = (
            f"⚠️ **Security issues detected.** "
            f"{critical_count} critical finding(s) require immediate attention."
        )
    elif resolved_gate_status == "PASS":
        summary_intro = "✅ **No critical security issues detected.**"
    else:
        summary_intro = f"ℹ️ **Security gate result: {resolved_gate_status}.**"

    summary = (
        f"**Rakshak Security Gate: {resolved_gate_status}**\n"
        f"{gate_reason or ''}\n\n"
        f"{summary_intro}\n\n"
        f"| Severity | Count |\n"
        f"|----------|-------|\n"
        f"| 🔴 Critical | {critical_count} |\n"
        f"| 🟠 High     | {high_count} |\n"
        f"| 🟡 Medium   | {medium_count} |\n"
        f"| 🟢 Low      | {low_count} |\n"
        f"\n"
        f"**Total Findings:** {total_findings}  \n"
        f"**Risk Score:** {overall_risk:.2f}  \n"
        f"\n"
        f"---\n"
        f"**Rakshak Scan ID:** `{scan_id}`  \n"
        f"_Correlate with the Rakshak dashboard for full finding details._"
    )

    return {
        "title": CHECK_RUN_NAME,
        "summary": summary,
    }


# ---------------------------------------------------------------------------
# Internal HTTP helper
# ---------------------------------------------------------------------------


def _github_request(
    method: str,
    url: str,
    token: str,
    body: Optional[dict] = None,
) -> dict:
    """Make a single authenticated GitHub API request.

    Args:
        method:  HTTP method (``"POST"`` or ``"PATCH"``).
        url:     Full GitHub API URL.
        token:   Bearer access token (never logged).
        body:    Optional request body dict (will be JSON-encoded).

    Returns:
        Parsed JSON response body as a dict.

    Raises:
        CheckRunError: For any HTTP or network error, with a safe message
                       that does not include the token.
    """
    data = json.dumps(body).encode("utf-8") if body else None

    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": _ACCEPT_HEADER,
            "X-GitHub-Api-Version": _API_VERSION_HEADER,
            "Content-Type": "application/json",
            "User-Agent": "Rakshak",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw.strip() else {}

    except urllib.error.HTTPError as exc:
        status = exc.code
        try:
            error_body = exc.read().decode("utf-8")
        except Exception:
            error_body = "(unreadable)"

        _log_http_error(method, url, status, error_body)
        raise CheckRunError(
            f"GitHub API returned HTTP {status} for {method} {url}. "
            f"See logs for details."
        ) from exc

    except urllib.error.URLError as exc:
        logger.error(
            "[CheckRun] Network error: method=%s url=%s reason=%s",
            method,
            url,
            str(exc.reason),
        )
        raise CheckRunError(
            f"Network error contacting GitHub API: {str(exc.reason)}"
        ) from exc


def _log_http_error(method: str, url: str, status: int, body: str) -> None:
    """Log a GitHub API HTTP error safely (no token, no secrets in output)."""
    # Truncate the response body to avoid flooding logs with potentially
    # large GitHub error payloads.
    safe_body = body[:300] if body else ""

    if status in (401, 403):
        logger.warning(
            "[CheckRun] Authentication/authorization error: method=%s url=%s "
            "status=%d — Check that GITHUB_CHECK_RUN_TOKEN has the 'checks:write' "
            "permission on this repository. body=%.300s",
            method,
            url,
            status,
            safe_body,
        )
    elif status == 404:
        logger.warning(
            "[CheckRun] Resource not found: method=%s url=%s status=%d body=%.300s",
            method,
            url,
            status,
            safe_body,
        )
    elif status == 422:
        logger.warning(
            "[CheckRun] Unprocessable payload: method=%s url=%s status=%d body=%.300s",
            method,
            url,
            status,
            safe_body,
        )
    elif status == 429:
        logger.warning(
            "[CheckRun] Rate limited by GitHub API: method=%s url=%s status=%d",
            method,
            url,
            status,
        )
    else:
        logger.error(
            "[CheckRun] Unexpected error: method=%s url=%s status=%d body=%.300s",
            method,
            url,
            status,
            safe_body,
        )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def create_check_run(
    owner: str,
    repo: str,
    head_sha: str,
    access_token: str,
) -> int:
    """Create a GitHub Check Run for a PR head commit SHA with status in_progress.

    Args:
        owner:        Repository owner login.
        repo:         Repository name.
        head_sha:     PR head commit SHA to associate the Check Run with.
        access_token: GitHub access token with ``checks:write`` scope.

    Returns:
        The GitHub Check Run ID (integer) needed to update the run later.

    Raises:
        CheckRunError: If the API call fails.  Callers must catch this and
                       continue the scan regardless.
    """
    url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/check-runs"

    payload = {
        "name": CHECK_RUN_NAME,
        "head_sha": head_sha,
        "status": "in_progress",
        "started_at": _utc_now_iso(),
    }

    logger.info(
        "[CheckRun] Creating in_progress check run: repo=%s/%s sha=%.12s",
        owner,
        repo,
        head_sha,
    )

    response = _github_request("POST", url, access_token, payload)

    check_run_id = response.get("id")
    if not check_run_id:
        raise CheckRunError(
            "GitHub API response for check-run creation did not include an id. "
            f"Response keys: {list(response.keys())}"
        )

    logger.info(
        "[CheckRun] Check run created: id=%s repo=%s/%s",
        check_run_id,
        owner,
        repo,
    )

    return int(check_run_id)


def complete_check_run(
    owner: str,
    repo: str,
    check_run_id: int,
    scan_id: str,
    total_findings: int,
    critical_count: int,
    high_count: int,
    medium_count: int,
    low_count: int,
    overall_risk: float,
    access_token: str,
    gate_status: Optional[str] = None,
    gate_reason: Optional[str] = None,
) -> None:
    """Update a GitHub Check Run to completed status with scan results.

    Args:
        owner:          Repository owner login.
        repo:           Repository name.
        check_run_id:   ID returned by ``create_check_run``.
        scan_id:        Rakshak PostgreSQL scan UUID for correlation.
        total_findings: Total finding count.
        critical_count: Critical severity finding count.
        high_count:     High severity finding count.
        medium_count:   Medium severity finding count.
        low_count:      Low severity finding count.
        overall_risk:   Weighted risk score.
        access_token:   GitHub access token with ``checks:write`` scope.

    Raises:
        CheckRunError: If the API call fails.  Callers must catch this and
                       NOT fail the PostgreSQL scan record because of it.
    """
    url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/check-runs/{check_run_id}"

    conclusion = determine_conclusion(critical_count, gate_status)

    output = build_check_run_output(
        scan_id=scan_id,
        total_findings=total_findings,
        critical_count=critical_count,
        high_count=high_count,
        medium_count=medium_count,
        low_count=low_count,
        overall_risk=overall_risk,
        conclusion=conclusion,
        gate_status=gate_status,
        gate_reason=gate_reason,
    )

    payload = {
        "status": "completed",
        "completed_at": _utc_now_iso(),
        "conclusion": conclusion,
        "output": output,
    }

    logger.info(
        "[CheckRun] Completing check run: id=%s repo=%s/%s conclusion=%s findings=%d risk=%.2f",
        check_run_id,
        owner,
        repo,
        conclusion,
        total_findings,
        overall_risk,
    )

    _github_request("PATCH", url, access_token, payload)

    logger.info(
        "[CheckRun] Check run completed: id=%s conclusion=%s",
        check_run_id,
        conclusion,
    )


# ---------------------------------------------------------------------------
# Internal utilities
# ---------------------------------------------------------------------------


def _utc_now_iso() -> str:
    """Return the current UTC time as an ISO 8601 string with Z suffix."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
