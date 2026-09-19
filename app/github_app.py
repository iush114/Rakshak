"""
app/github_app.py
=================
GitHub App authentication module for Rakshak.

Provides functions to:
- Load GitHub App credentials (App ID, Private Key)
- Generate RS256 signed JSON Web Tokens (JWT)
- Request GitHub Installation Access Tokens for server-side repository access and Check Runs

Security
--------
- Private keys and installation tokens are NEVER logged or exposed via API responses.
- Installation tokens are short-lived credentials generated on demand.
- JWTs are strictly server-side and RS256-signed.
"""

import json
import logging
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Optional, Tuple

import jwt

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GITHUB_API_BASE = "https://api.github.com"
_ACCEPT_HEADER = "application/vnd.github+json"
_API_VERSION_HEADER = "2022-11-28"
_JWT_CLOCK_SKEW_SECONDS = 60
_JWT_EXPIRATION_SECONDS = 540  # 9 minutes (GitHub allows max 10 minutes)


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class GitHubAppError(Exception):
    """Base exception for GitHub App operations.

    Safe for logging and exception propagation: messages must NEVER contain
    private keys or sensitive tokens.
    """


class GitHubAppConfigError(GitHubAppError):
    """Raised when GitHub App environment configuration is missing or invalid."""


# ---------------------------------------------------------------------------
# Configuration Loading
# ---------------------------------------------------------------------------


def is_github_app_configured() -> bool:
    """Check whether GitHub App credentials are set in the environment."""
    app_id = os.environ.get("GITHUB_APP_ID", "").strip()
    private_key = os.environ.get("GITHUB_APP_PRIVATE_KEY", "").strip()
    return bool(app_id and private_key)


def get_github_app_status() -> dict:
    """Return a safe status dictionary for the GitHub App configuration.

    NEVER returns private keys, JWTs, or tokens.
    """
    configured = is_github_app_configured()
    app_id = os.environ.get("GITHUB_APP_ID", "").strip() or None
    app_name = os.environ.get("GITHUB_APP_NAME", "").strip() or None

    return {
        "configured": configured,
        "app_id": app_id,
        "app_name": app_name,
    }


def load_github_app_config() -> Tuple[str, str, Optional[str]]:
    """Load and validate GitHub App configuration from environment variables.

    Returns:
        Tuple of (app_id, private_key_pem, app_name)

    Raises:
        GitHubAppConfigError: If GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY is missing.
    """
    app_id = os.environ.get("GITHUB_APP_ID", "").strip()
    if not app_id:
        raise GitHubAppConfigError("GITHUB_APP_ID environment variable is not configured.")

    raw_key = os.environ.get("GITHUB_APP_PRIVATE_KEY", "").strip()
    if not raw_key:
        raise GitHubAppConfigError("GITHUB_APP_PRIVATE_KEY environment variable is not configured.")

    # Check if raw_key is a path to an existing PEM file
    if os.path.isfile(raw_key):
        try:
            private_key_pem = Path(raw_key).read_text(encoding="utf-8").strip()
        except Exception as exc:
            raise GitHubAppConfigError(
                f"Failed to read GitHub App private key file: {exc}"
            ) from exc
    else:
        # If passed inline with literal \n escapes, unescape them
        private_key_pem = raw_key.replace("\\n", "\n")

    app_name = os.environ.get("GITHUB_APP_NAME", "").strip() or None

    return app_id, private_key_pem, app_name


# ---------------------------------------------------------------------------
# JWT Generation
# ---------------------------------------------------------------------------


def generate_github_app_jwt(
    app_id: Optional[str] = None,
    private_key_pem: Optional[str] = None,
) -> str:
    """Generate an RS256-signed JWT for GitHub App authentication.

    Args:
        app_id: Optional GitHub App ID. If None, loaded from environment.
        private_key_pem: Optional PEM private key. If None, loaded from environment.

    Returns:
        Signed JWT string.

    Raises:
        GitHubAppConfigError: If configuration is missing.
        GitHubAppError: If JWT signing fails.
    """
    if app_id is None or private_key_pem is None:
        loaded_id, loaded_key, _ = load_github_app_config()
        app_id = app_id or loaded_id
        private_key_pem = private_key_pem or loaded_key

    now = int(time.time())
    payload = {
        # Issued 60 seconds in the past to mitigate clock drift
        "iat": now - _JWT_CLOCK_SKEW_SECONDS,
        # Expires in 9 minutes (GitHub allows maximum 10 minutes)
        "exp": now + _JWT_EXPIRATION_SECONDS,
        # Issuer: GitHub App ID
        "iss": str(app_id),
    }

    try:
        token = jwt.encode(payload, private_key_pem, algorithm="RS256")
        # In PyJWT < 2.0 encode returned bytes; in 2.0+ it returns str
        if isinstance(token, bytes):
            token = token.decode("utf-8")
        return token
    except Exception as exc:
        raise GitHubAppError(f"Failed to generate GitHub App JWT: {exc}") from exc


# ---------------------------------------------------------------------------
# Installation Access Token Generation
# ---------------------------------------------------------------------------


def get_installation_access_token(
    installation_id: int,
    jwt_token: Optional[str] = None,
) -> str:
    """Request a short-lived Installation Access Token for a GitHub App installation.

    Args:
        installation_id: Integer GitHub App installation ID.
        jwt_token: Optional pre-generated JWT. If None, a new JWT is created.

    Returns:
        Installation access token string.

    Raises:
        GitHubAppError: If the GitHub API returns an error or fails to connect.
    """
    if not installation_id:
        raise GitHubAppError("installation_id must be a valid non-zero integer.")

    if jwt_token is None:
        jwt_token = generate_github_app_jwt()

    url = f"{GITHUB_API_BASE}/app/installations/{installation_id}/access_tokens"

    req = urllib.request.Request(
        url,
        data=b"{}",  # GitHub expects empty JSON object or permissions overrides
        method="POST",
        headers={
            "Authorization": f"Bearer {jwt_token}",
            "Accept": _ACCEPT_HEADER,
            "X-GitHub-Api-Version": _API_VERSION_HEADER,
            "Content-Type": "application/json",
            "User-Agent": "Rakshak",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read().decode("utf-8")
            data = json.loads(raw) if raw.strip() else {}

    except urllib.error.HTTPError as exc:
        status = exc.code
        try:
            error_body = exc.read().decode("utf-8")[:300]
        except Exception:
            error_body = "(unreadable)"

        _log_http_error(status, installation_id, error_body)
        raise GitHubAppError(
            f"GitHub API error requesting installation token: HTTP {status} for installation {installation_id}."
        ) from exc

    except urllib.error.URLError as exc:
        logger.error(
            "[GitHubApp] Network error contacting GitHub API for installation=%d: %s",
            installation_id,
            str(exc.reason),
        )
        raise GitHubAppError(
            f"Network error contacting GitHub API: {str(exc.reason)}"
        ) from exc

    token = data.get("token")
    if not token:
        raise GitHubAppError(
            f"GitHub API response did not contain an access token for installation {installation_id}."
        )

    logger.info(
        "[GitHubApp] Successfully obtained installation access token: installation=%d",
        installation_id,
    )
    return token


def _log_http_error(status: int, installation_id: int, body: str) -> None:
    """Log GitHub App API HTTP errors without exposing tokens or secrets."""
    safe_body = body[:200] if body else ""
    if status in (401, 403):
        logger.warning(
            "[GitHubApp] Auth/Permission error: status=%d installation=%d body=%.200s",
            status,
            installation_id,
            safe_body,
        )
    elif status == 404:
        logger.warning(
            "[GitHubApp] Installation not found or app suspended: status=404 installation=%d",
            installation_id,
        )
    elif status == 422:
        logger.warning(
            "[GitHubApp] Unprocessable entity: status=422 installation=%d body=%.200s",
            installation_id,
            safe_body,
        )
    elif status == 429:
        logger.warning(
            "[GitHubApp] Rate limited by GitHub API: status=429 installation=%d",
            installation_id,
        )
    else:
        logger.error(
            "[GitHubApp] Unexpected error: status=%d installation=%d body=%.200s",
            status,
            installation_id,
            safe_body,
        )


# ---------------------------------------------------------------------------
# Repository Installation Resolution
# ---------------------------------------------------------------------------


def get_repository_installation(owner: str, repo: str) -> Optional[int]:
    """Resolve the GitHub App installation ID for a repository via the GitHub API.

    Uses the server-side App JWT against ``GET /repos/{owner}/{repo}/installation``.
    The returned installation ID is GitHub's real value — it is never invented.

    Args:
        owner: Repository owner login (validated by the caller).
        repo:  Repository name (validated by the caller).

    Returns:
        The GitHub App installation ID, or ``None`` when the App is not
        configured, not installed on that repository, or the lookup fails.
        This function never raises for expected misses so callers can treat
        installation mapping as best-effort.
    """
    if not is_github_app_configured():
        logger.debug(
            "[GitHubApp] Installation lookup skipped for %s/%s — GitHub App not configured.",
            owner,
            repo,
        )
        return None

    try:
        app_id, private_key_pem, _ = load_github_app_config()
        jwt_token = generate_github_app_jwt(app_id, private_key_pem)

        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/installation"
        req = urllib.request.Request(
            url,
            method="GET",
            headers={
                "Authorization": f"Bearer {jwt_token}",
                "Accept": _ACCEPT_HEADER,
                "X-GitHub-Api-Version": _API_VERSION_HEADER,
                "User-Agent": "Rakshak",
            },
        )

        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read().decode("utf-8")
            data = json.loads(raw) if raw.strip() else {}

        installation_id = data.get("id")
        if installation_id is None:
            logger.warning(
                "[GitHubApp] Installation lookup for %s/%s returned no installation id.",
                owner,
                repo,
            )
            return None

        installation_id = int(installation_id)
        logger.info(
            "[GitHubApp] Resolved installation=%d for repository %s/%s.",
            installation_id,
            owner,
            repo,
        )
        return installation_id

    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            logger.info(
                "[GitHubApp] GitHub App is not installed on %s/%s (HTTP 404).",
                owner,
                repo,
            )
        else:
            logger.warning(
                "[GitHubApp] Installation lookup failed for %s/%s: HTTP %d.",
                owner,
                repo,
                exc.code,
            )
        return None

    except Exception as exc:
        logger.warning(
            "[GitHubApp] Installation lookup failed for %s/%s: %s",
            owner,
            repo,
            str(exc),
        )
        return None
