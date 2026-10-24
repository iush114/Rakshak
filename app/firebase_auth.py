import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# Firebase Admin SDK imports
try:
    import firebase_admin
    from firebase_admin import auth as firebase_auth, credentials
    FIREBASE_ADMIN_AVAILABLE = True
except ImportError:
    FIREBASE_ADMIN_AVAILABLE = False
    firebase_admin = None
    firebase_auth = None
    credentials = None


def get_firebase_project_id() -> str:
    return os.getenv("FIREBASE_PROJECT_ID", "rakshak-auth")


def initialize_firebase_admin() -> Optional[Any]:
    """
    Safely initialize the Firebase Admin SDK once.
    Compatible with Render deployment using server-only environment variables.
    Supports:
      1. FIREBASE_SERVICE_ACCOUNT_JSON (raw JSON string or base64)
      2. FIREBASE_SERVICE_ACCOUNT_PATH (filepath to service account json)
      3. Project ID default initialization / ADC
    """
    if not FIREBASE_ADMIN_AVAILABLE:
        logger.warning("[FirebaseAuth] firebase-admin package is not installed.")
        return None

    # Check if already initialized to avoid duplicate initialization errors
    if firebase_admin._apps:
        return firebase_admin.get_app()

    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
    project_id = get_firebase_project_id()

    try:
        if service_account_json:
            clean_json = service_account_json.strip()
            # Handle potential base64 encoding if provided
            if not clean_json.startswith("{"):
                import base64
                clean_json = base64.b64decode(clean_json).decode("utf-8")
            cert_dict = json.loads(clean_json)
            cred = credentials.Certificate(cert_dict)
            app = firebase_admin.initialize_app(cred, {"projectId": cert_dict.get("project_id", project_id)})
            logger.info("[FirebaseAuth] Initialized Firebase Admin from FIREBASE_SERVICE_ACCOUNT_JSON.")
            return app

        if service_account_path and os.path.exists(service_account_path):
            cred = credentials.Certificate(service_account_path)
            app = firebase_admin.initialize_app(cred, {"projectId": project_id})
            logger.info(f"[FirebaseAuth] Initialized Firebase Admin from file: {service_account_path}")
            return app

        # Fallback to project ID / Application Default Credentials
        app = firebase_admin.initialize_app(options={"projectId": project_id})
        logger.info(f"[FirebaseAuth] Initialized Firebase Admin with projectId: {project_id}")
        return app
    except Exception as exc:
        logger.warning(f"[FirebaseAuth] Firebase Admin initialization notice: {exc}")
        return None


# Initialize on module load
initialize_firebase_admin()


def verify_firebase_id_token(id_token: str) -> Dict[str, Any]:
    """
    Verify a Firebase ID token.
    Enforces that the token is valid, unexpired, and properly signed.
    Returns the decoded token claims dictionary.
    Raises HTTPException(401) on invalid or missing tokens.
    """
    if not id_token or not isinstance(id_token, str):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not FIREBASE_ADMIN_AVAILABLE:
        raise HTTPException(
            status_code=500,
            detail="Authentication service unavailable (firebase-admin not installed)",
        )

    # Ensure app is initialized
    initialize_firebase_admin()

    try:
        decoded_token = firebase_auth.verify_id_token(id_token)
        return decoded_token
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=401,
            detail="Authentication token has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\", error_description=\"token expired\""},
        )
    except firebase_auth.RevokedIdTokenError:
        raise HTTPException(
            status_code=401,
            detail="Authentication token has been revoked.",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\", error_description=\"token revoked\""},
        )
    except firebase_auth.InvalidIdTokenError as exc:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid authentication token: {str(exc)}",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
        )
    except Exception as exc:
        logger.warning(f"[FirebaseAuth] Token verification failed: {exc}")
        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def enforce_email_verification(decoded_token: Dict[str, Any]) -> None:
    """
    Provider-aware email verification enforcement.
    - If sign_in_provider == 'password': user MUST have email_verified == True.
    - If sign_in_provider == 'google.com' or other OAuth provider: email is verified by provider.
    Raises HTTP 403 Forbidden if unverified email/password user tries to access protected features.
    """
    firebase_meta = decoded_token.get("firebase", {})
    sign_in_provider = firebase_meta.get("sign_in_provider", "password")

    # Only password accounts require explicit Firebase email verification
    if sign_in_provider in ("google.com", "github.com"):
        return
    if sign_in_provider == "password":
        is_verified = decoded_token.get("email_verified", False)
        if not is_verified:
            logger.info(f"[FirebaseAuth] Access denied for unverified user {decoded_token.get('email')}")
            raise HTTPException(
                status_code=403,
                detail="Email verification required. Please verify your email address to access Rakshak features.",
            )


def upsert_firebase_user(db: Session, decoded_token: Dict[str, Any]) -> Any:
    """
    Map and persist Firebase authenticated identity into Rakshak workspace User model.
    Preserves existing user records and maps Firebase users to internal User.id.
    """
    from app.models import User

    uid = decoded_token.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token: missing subject (uid)")

    email = decoded_token.get("email")
    name = decoded_token.get("name")
    picture = decoded_token.get("picture")
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # 1. Lookup by firebase_uid
    user = db.query(User).filter(User.firebase_uid == uid).first()

    # 2. If not found by uid, match by email if available to link existing account
    if user is None and email:
        user = db.query(User).filter(User.email == email).first()
        if user is not None:
            user.firebase_uid = uid

    # 3. Create new user if still not found
    if user is None:
        user = User(
            firebase_uid=uid,
            email=email,
            name=name,
            avatar_url=picture,
            is_verified=True,
            created_at=now,
            last_seen_at=now,
        )
        db.add(user)
    else:
        # Update metadata
        if email:
            user.email = email
        if name:
            user.name = name
        if picture:
            user.avatar_url = picture
        user.is_verified = True
        user.last_seen_at = now

    db.commit()
    db.refresh(user)
    return user
