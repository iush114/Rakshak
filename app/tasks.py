"""
app/tasks.py
============
Celery tasks for Rakshak security scanning.

Provides durable background execution for repository scans triggered by GitHub
webhooks or scheduled jobs.
"""

import logging
import urllib.error
from datetime import datetime
from typing import Optional

from app.celery_app import celery_app
from app.database import SessionLocal
from app.models import GitHubWebhookDelivery
from app.scan_service import run_github_repository_scan

logger = logging.getLogger(__name__)

# Transient errors that are safe to retry with backoff
TRANSIENT_EXCEPTIONS = (
    urllib.error.URLError,
    ConnectionError,
    TimeoutError,
)


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    name="app.tasks.run_github_repository_scan_task",
)
def run_github_repository_scan_task(
    self,
    owner: str,
    repo: str,
    ref: Optional[str] = None,
    access_token: Optional[str] = None,
    code_scanning: bool = True,
    dependency_scanning: bool = True,
    secret_detection: bool = True,
    container_scanning: bool = False,
    container_image: Optional[str] = None,
    trigger: str = "webhook",
    delivery_id: Optional[str] = None,
    pr_head_sha: Optional[str] = None,
    check_run_access_token: Optional[str] = None,
    installation_id: Optional[int] = None,
    owner_user_id: Optional[int] = None,
) -> dict:
    """Execute a GitHub repository scan within a Celery worker.

    Manages its own database session and calls the authoritative
    ``run_github_repository_scan`` pipeline. Updates associated
    GitHubWebhookDelivery status across its lifecycle.

    ``owner_user_id`` is the internal Rakshak workspace (User.id) resolved by
    the webhook endpoint. Webhook scans are only enqueued when ownership can
    be safely established, so the resolved owner must always be present here
    for webhook-triggered scans.
    """
    logger.info(
        "[CeleryTask] Starting scan task: id=%s repo=%s/%s ref=%s trigger=%s delivery=%s installation=%s",
        self.request.id,
        owner,
        repo,
        ref or "default",
        trigger,
        delivery_id or "n/a",
        installation_id or "n/a",
    )

    db = SessionLocal()

    try:
        if delivery_id:
            try:
                delivery = (
                    db.query(GitHubWebhookDelivery)
                    .filter(GitHubWebhookDelivery.delivery_id == delivery_id)
                    .first()
                )
                if delivery:
                    delivery.status = "running"
                    db.commit()
            except Exception as d_exc:
                logger.warning("[CeleryTask] Failed to update delivery status to running: %s", str(d_exc))
                db.rollback()

        scan_id = run_github_repository_scan(
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
            owner_user_id=owner_user_id,
        )

        if delivery_id:
            try:
                delivery = (
                    db.query(GitHubWebhookDelivery)
                    .filter(GitHubWebhookDelivery.delivery_id == delivery_id)
                    .first()
                )
                if delivery:
                    delivery.status = "completed"
                    delivery.completed_at = datetime.utcnow()
                    db.commit()
            except Exception as d_exc:
                logger.warning("[CeleryTask] Failed to update delivery status to completed: %s", str(d_exc))
                db.rollback()

        logger.info(
            "[CeleryTask] Scan completed successfully: task_id=%s scan_id=%s repo=%s/%s",
            self.request.id,
            scan_id,
            owner,
            repo,
        )

        return {
            "status": "completed",
            "task_id": self.request.id,
            "scan_id": scan_id,
            "owner": owner,
            "repo": repo,
        }

    except TRANSIENT_EXCEPTIONS as transient_exc:
        logger.warning(
            "[CeleryTask] Transient error in task_id=%s for repo=%s/%s. Retrying in %ds (attempt %d/%d): %s",
            self.request.id,
            owner,
            repo,
            self.default_retry_delay,
            self.request.retries + 1,
            self.max_retries,
            str(transient_exc),
        )
        if delivery_id:
            try:
                delivery = (
                    db.query(GitHubWebhookDelivery)
                    .filter(GitHubWebhookDelivery.delivery_id == delivery_id)
                    .first()
                )
                if delivery:
                    delivery.status = "retry"
                    db.commit()
            except Exception:
                db.rollback()
        raise self.retry(exc=transient_exc)

    except Exception as exc:
        logger.error(
            "[CeleryTask] Permanent failure in task_id=%s for repo=%s/%s: %s",
            self.request.id,
            owner,
            repo,
            str(exc),
        )
        if delivery_id:
            try:
                delivery = (
                    db.query(GitHubWebhookDelivery)
                    .filter(GitHubWebhookDelivery.delivery_id == delivery_id)
                    .first()
                )
                if delivery:
                    delivery.status = "failed"
                    delivery.completed_at = datetime.utcnow()
                    delivery.error_message = str(exc)
                    db.commit()
            except Exception as d_exc:
                logger.warning("[CeleryTask] Failed to update delivery status to failed: %s", str(d_exc))
                db.rollback()
        # Scan status transition to 'failed' is already recorded in PostgreSQL
        # by run_github_repository_scan. Do NOT retry permanent errors.
        raise

    finally:
        db.close()
