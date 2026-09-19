"""
app/celery_app.py
=================
Celery application configuration for Rakshak.

Provides asynchronous, durable task processing using Redis as the message broker.

Security
--------
- JSON serialization enforced for tasks and results (pickle is strictly forbidden).
- Broker credentials/URLs are loaded from environment variables and never logged or exposed.
- Tasks acknowledge late (task_acks_late=True) to prevent job loss on worker failure.
"""

import logging
import os
from celery import Celery

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Broker & Backend Configuration
# ---------------------------------------------------------------------------

DEFAULT_BROKER_URL = "redis://localhost:6379/0"
DEFAULT_RESULT_BACKEND = "redis://localhost:6379/1"

broker_url = os.environ.get("CELERY_BROKER_URL", DEFAULT_BROKER_URL)
result_backend = os.environ.get("CELERY_RESULT_BACKEND", DEFAULT_RESULT_BACKEND)

# ---------------------------------------------------------------------------
# Celery Application Instance
# ---------------------------------------------------------------------------

celery_app = Celery(
    "rakshak",
    broker=broker_url,
    backend=result_backend,
    include=["app.tasks"],
)

celery_app.conf.update(
    # Strict JSON serialization for security (prevent pickle exploits)
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    # Worker resilience
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    # Sensible execution time limits for security scans
    task_time_limit=1800,       # 30 minutes hard limit
    task_soft_time_limit=1500,  # 25 minutes soft limit
    # Worker concurrency behavior
    worker_prefetch_multiplier=1,
)


def is_queue_configured() -> bool:
    """Return whether Celery broker is configured."""
    return bool(os.environ.get("CELERY_BROKER_URL") or DEFAULT_BROKER_URL)


def get_queue_status() -> dict:
    """Return safe status of the task queue without leaking secrets or credentials."""
    has_custom_broker = bool(os.environ.get("CELERY_BROKER_URL"))
    has_custom_backend = bool(os.environ.get("CELERY_RESULT_BACKEND"))

    return {
        "configured": True,
        "custom_broker": has_custom_broker,
        "custom_backend": has_custom_backend,
        "task_serializer": "json",
        "acks_late": True,
    }
