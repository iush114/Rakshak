# Exclude standalone scripts that are not pytest test modules
collect_ignore = ["test_api_server.py", "test_scan_api.py", "test_cloudflare.py", "test_cloudflare_speed.py"]

"""
conftest.py - Pytest session configuration for Rakshak test suite.

Provides a global autouse fixture that patches Celery task dispatch
so webhook endpoint tests don't hang trying to connect to an actual broker.

Individual tests that need to verify task dispatch behaviour (e.g.
TestWebhookCeleryEnqueue) use their own `with patch(...)` context managers
which take precedence over this module-level patch automatically.

Phase 11A (workspace isolation):
    A dedicated, deterministic test database is provisioned BEFORE any app
    module is imported, so the suite always runs against the CURRENT schema
    (users, user_installations, user_repositories, scans.user_id, security
    gate columns, lifecycle columns). This keeps the historical
    test_webhook.db artifact untouched and prevents stale-schema failures.
"""

import hashlib
import os

# Force a dedicated suite database before any app import. load_dotenv() does
# not override existing environment variables, so this wins over .env.
os.environ["DATABASE_URL"] = "sqlite:///./test_rakshak_suite.db"
os.environ.setdefault("SESSION_SECRET", "test-session-secret-for-testing")
os.environ.setdefault("GITHUB_WEBHOOK_SECRET", "test_webhook_secret_123")

import pytest  # noqa: E402
from unittest.mock import MagicMock, patch  # noqa: E402

from app.database import Base, engine  # noqa: E402
import app.models  # noqa: E402  (register all models on Base.metadata)

# Provision the CURRENT schema once per pytest session. The suite database is
# disposable; production data and test_webhook.db are never touched.
# HARD GUARD: refuse to drop/create tables unless we are on the disposable
# SQLite suite database. Prevents accidental drop_all() against a real
# PostgreSQL development or production database.
if engine.url.get_backend_name() != "sqlite":
    raise RuntimeError(
        "Refusing to run the test suite against a non-SQLite database "
        f"({engine.url.get_backend_name()!r}). Tests must use a disposable "
        "SQLite database."
    )

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)


@pytest.fixture(autouse=True)
def _patch_celery_delay():
    """
    Ensure run_github_repository_scan_task.delay() never blocks on a real broker
    during any unit/integration test.

    Returns a mock AsyncResult-like object with a stable .id attribute.
    Tests that want to assert on the mock can use their own explicit patch context.
    """
    mock_task = MagicMock()
    mock_task.id = "autouse-mock-task-id"

    with patch(
        "app.main.run_github_repository_scan_task.delay",
        return_value=mock_task,
    ):
        yield mock_task


# ---------------------------------------------------------------------------
# Phase 11A — webhook workspace seeding helper
# ---------------------------------------------------------------------------

def ensure_webhook_workspace(installation_ids=(), repository_full_name=None, login="webhook-test-owner"):
    """Create (or reuse) a Rakshak workspace plus installation/repository
    mappings so webhook tests can exercise the ownership-resolution path.

    Tests that POST webhook events expecting a scan to be queued MUST have a
    workspace mapping — unresolved deliveries are safely ignored by design
    (no ownerless scans are ever created).
    """
    from datetime import datetime

    from app.database import SessionLocal
    from app.models import User, UserInstallation, UserRepository

    now = datetime.utcnow()
    github_user_id = int(hashlib.sha256(login.encode("utf-8")).hexdigest()[:12], 16)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.github_user_id == github_user_id).first()
        if user is None:
            user = User(
                github_user_id=github_user_id,
                github_login=login,
                name="Webhook Test Owner",
                created_at=now,
                last_seen_at=now,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        for installation_id in installation_ids:
            link = (
                db.query(UserInstallation)
                .filter(UserInstallation.installation_id == installation_id)
                .first()
            )
            if link is None:
                db.add(UserInstallation(
                    installation_id=installation_id,
                    user_id=user.id,
                    created_at=now,
                    last_seen_at=now,
                ))
            else:
                link.user_id = user.id
                link.last_seen_at = now

        if repository_full_name:
            repo_link = (
                db.query(UserRepository)
                .filter(
                    UserRepository.user_id == user.id,
                    UserRepository.repository_full_name == repository_full_name,
                )
                .first()
            )
            if repo_link is None:
                db.add(UserRepository(
                    user_id=user.id,
                    repository_full_name=repository_full_name,
                    created_at=now,
                    last_seen_at=now,
                ))
            else:
                repo_link.last_seen_at = now

        db.commit()
        return user.id
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Phase 11A — authenticated session helpers
# ---------------------------------------------------------------------------

def create_workspace_user(
    github_user_id,
    github_login="test-user",
    name="Test User",
    avatar_url=None,
    html_url=None,
):
    """Create (or reuse) a Rakshak workspace user identified by GitHub's stable
    numeric user id. Mirrors the OAuth upsert semantics exactly.
    """
    from datetime import datetime

    from app.database import SessionLocal
    from app.models import User

    now = datetime.utcnow()
    db = SessionLocal()
    try:
        user = (
            db.query(User)
            .filter(User.github_user_id == github_user_id)
            .first()
        )
        if user is None:
            user = User(
                github_user_id=github_user_id,
                github_login=github_login,
                name=name,
                avatar_url=avatar_url,
                html_url=html_url,
                created_at=now,
                last_seen_at=now,
            )
            db.add(user)
        else:
            user.github_login = github_login
            user.last_seen_at = now
        db.commit()
        db.refresh(user)
        return user
    finally:
        db.close()


def signed_session_cookie(session_data, secret=None):
    """Build a valid Starlette SessionMiddleware cookie for ``session_data``."""
    import base64
    import json

    from itsdangerous import TimestampSigner

    secret = secret or os.environ["SESSION_SECRET"]
    payload = base64.b64encode(json.dumps(session_data).encode("utf-8"))
    return TimestampSigner(str(secret)).sign(payload).decode("utf-8")


def authenticate_client(client, user, access_token="ghp_test_access_token"):
    """Attach an authenticated Rakshak session cookie to a TestClient.

    The session carries the INTERNAL Rakshak ``User.id`` (``user_pk``) — never a
    frontend supplied identity.
    """
    client.cookies.set(
        "session",
        signed_session_cookie(
            {
                "user_pk": user.id,
                "github_access_token": access_token,
                "github_user": {
                    "id": user.github_user_id,
                    "login": user.github_login,
                    "name": user.name,
                    "avatar_url": user.avatar_url,
                    "html_url": user.html_url,
                },
            }
        ),
    )
    return client


@pytest.fixture
def workspace_user():
    """A fresh Rakshak workspace user for ownership/isolation tests."""
    return create_workspace_user(
        github_user_id=904500001,
        github_login="workspace-owner-a",
        name="Workspace Owner A",
    )


@pytest.fixture
def authed_client(workspace_user):
    """An authenticated TestClient bound to ``workspace_user``."""
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    authenticate_client(client, workspace_user)
    return client
