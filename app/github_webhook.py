"""
GitHub Webhook Security and Metadata Extraction
================================================
Provides HMAC-SHA256 signature verification and safe metadata extraction
for incoming GitHub webhook events (push, pull_request, ping).

SECURITY: Raw request bytes are verified BEFORE JSON parsing.
          Secrets are never logged or exposed in responses.
"""

import hashlib
import hmac
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Secret retrieval
# ---------------------------------------------------------------------------

def get_webhook_secret() -> str:
    """Return the GitHub webhook secret from environment.

    Raises:
        RuntimeError: If GITHUB_WEBHOOK_SECRET is not set in the environment.
    """
    secret = os.environ.get("GITHUB_WEBHOOK_SECRET", "").strip()
    if not secret:
        raise RuntimeError(
            "GITHUB_WEBHOOK_SECRET environment variable is not configured. "
            "Set it in your .env file and restart the server."
        )
    return secret


# ---------------------------------------------------------------------------
# HMAC-SHA256 signature verification
# ---------------------------------------------------------------------------

def verify_github_signature(
    raw_body: bytes,
    signature_header: Optional[str],
    secret: Optional[str] = None,
) -> bool:
    """Verify a GitHub webhook HMAC-SHA256 signature.

    Args:
        raw_body:         The raw request body bytes (before JSON decoding).
        signature_header: Value of the ``X-Hub-Signature-256`` header
                          (expected format: ``sha256=<hex-digest>``).
        secret:           Webhook secret to use for HMAC computation.
                          If *None* (default), ``get_webhook_secret()`` is called.

    Returns:
        ``True`` if the signature is present, well-formed, and matches;
        ``False`` otherwise.
    """
    if not signature_header:
        logger.warning("Webhook request is missing X-Hub-Signature-256 header.")
        return False

    if not signature_header.startswith("sha256="):
        logger.warning(
            "Webhook signature header has unexpected format: %.20s",
            signature_header,
        )
        return False

    provided_digest = signature_header[len("sha256="):]

    if secret is None:
        secret = get_webhook_secret()

    computed_digest = hmac.new(
        key=secret.encode("utf-8"),
        msg=raw_body,
        digestmod=hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(computed_digest, provided_digest)


# ---------------------------------------------------------------------------
# Metadata extraction helpers
# ---------------------------------------------------------------------------

def extract_push_event_metadata(
    payload: dict,
    delivery_id: Optional[str],
) -> dict:
    """Extract non-sensitive metadata from a GitHub push event payload.

    Args:
        payload:     Parsed JSON payload dict from GitHub.
        delivery_id: Value of ``X-GitHub-Delivery`` header (may be None).

    Returns:
        A dict containing safe, structured metadata about the push event.
    """
    repo = payload.get("repository", {})
    owner_data = repo.get("owner", {})
    installation = payload.get("installation")
    installation_id = installation.get("id") if isinstance(installation, dict) else None

    return {
        "delivery_id": delivery_id,
        "event": "push",
        "repository_id": repo.get("id"),
        "repository_full_name": repo.get("full_name"),
        "owner": owner_data.get("login"),
        "repository_name": repo.get("name"),
        "default_branch": repo.get("default_branch"),
        "ref": payload.get("ref"),
        "before": payload.get("before"),
        "after": payload.get("after"),
        "commits_count": len(payload.get("commits", [])),
        "pusher": payload.get("pusher", {}).get("name"),
        "installation_id": installation_id,
    }


def extract_pull_request_event_metadata(
    payload: dict,
    delivery_id: Optional[str],
) -> dict:
    """Extract non-sensitive metadata from a GitHub pull_request event payload.

    Args:
        payload:     Parsed JSON payload dict from GitHub.
        delivery_id: Value of ``X-GitHub-Delivery`` header (may be None).

    Returns:
        A dict containing safe, structured metadata about the pull_request event.
    """
    repo = payload.get("repository", {})
    pr = payload.get("pull_request", {})
    head = pr.get("head", {})
    base = pr.get("base", {})
    installation = payload.get("installation")
    installation_id = installation.get("id") if isinstance(installation, dict) else None

    return {
        "delivery_id": delivery_id,
        "event": "pull_request",
        "repository_id": repo.get("id"),
        "repository_full_name": repo.get("full_name"),
        "owner": repo.get("owner", {}).get("login"),
        "repository_name": repo.get("name"),
        "pr_number": payload.get("number"),
        "action": payload.get("action"),
        "base_branch": base.get("ref"),
        "head_branch": head.get("ref"),
        "head_sha": head.get("sha"),
        "pr_title": pr.get("title"),
        "pr_state": pr.get("state"),
        "draft": pr.get("draft", False),
        "installation_id": installation_id,
    }


# ---------------------------------------------------------------------------
# Safe structured logging helper
# ---------------------------------------------------------------------------

def log_webhook_event(event_type: str, metadata: dict) -> None:
    """Log a structured, non-sensitive summary of a webhook event.

    Intentionally omits any values that could expose secrets or access tokens.

    Args:
        event_type: GitHub event name (e.g. ``"push"``, ``"pull_request"``).
        metadata:   The metadata dict from the corresponding extractor function.
    """
    logger.info(
        "[Webhook] event=%s delivery=%s repo=%s ref_or_pr=%s",
        event_type,
        metadata.get("delivery_id", "unknown"),
        metadata.get("repository_full_name", "unknown"),
        metadata.get("ref") or f"PR#{metadata.get('pr_number', '?')}",
    )
