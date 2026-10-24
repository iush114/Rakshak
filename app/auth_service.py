"""Password hashing, email normalization, and verification token utilities."""

import hashlib
import re
import secrets
from email_validator import EmailNotValidError, validate_email

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

# Configure Argon2id password hasher with secure defaults
_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,  # 64 MB
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


def hash_password(plain_password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    return _hasher.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str | None) -> bool:
    """Verify a plaintext password against an Argon2id hash in constant time."""
    if not hashed_password or not plain_password:
        return False
    try:
        return _hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def validate_password_strength(password: str) -> tuple[bool, str | None]:
    """Ensure password meets minimum DevSecOps security criteria."""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if len(password) > 128:
        return False, "Password must not exceed 128 characters."
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r"[0-9]", password):
        return False, "Password must contain at least one number."
    if not re.search(r"[^A-Za-z0-9]", password):
        return False, "Password must contain at least one special character."
    return True, None


def normalize_email(email_str: str) -> str:
    """Validate and normalize email address format."""
    trimmed = (email_str or "").strip()
    if not trimmed:
        raise ValueError("Email address cannot be empty.")
    try:
        valid = validate_email(trimmed, check_deliverability=False)
        return valid.normalized.lower()
    except EmailNotValidError as exc:
        raise ValueError(str(exc))


def generate_verification_token() -> tuple[str, str]:
    """Generate a high-entropy CSPRNG raw token and its cryptographic SHA-256 hash.

    Returns:
        tuple[raw_token, token_hash]: The raw_token is sent ONLY in the email link;
        the token_hash is stored in the database.
    """
    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_token(raw_token)
    return raw_token, token_hash


def hash_token(raw_token: str) -> str:
    """Compute the SHA-256 hex digest of a verification token."""
    return hashlib.sha256(raw_token.strip().encode("utf-8")).hexdigest()


def mask_email(email_str: str) -> str:
    """Mask an email address for safe display in UI/API responses."""
    if not email_str or "@" not in email_str:
        return "***"
    local, domain = email_str.split("@", 1)
    if len(local) <= 2:
        masked_local = local[0] + "***"
    else:
        masked_local = local[0] + "***" + local[-1]
    return f"{masked_local}@{domain}"

def derive_display_name(email_str: str | None, name: str | None = None) -> str:
    """Derive a sensible human-readable display name for an email user.

    If name is provided and non-empty, return it.
    Otherwise, clean and title-case the local part of the email.
    e.g. 'hackerofcoc.14@gmail.com' -> 'Hackerofcoc'
         'alex.mercer@company.com' -> 'Alex Mercer'
    """
    if name and name.strip():
        return name.strip()
    if not email_str or "@" not in email_str:
        return "Rakshak User"
    local = email_str.split("@", 1)[0].strip()
    # Replace dots, underscores, dashes, pluses, and trailing numbers with spaces
    cleaned = re.sub(r"[._\-+]+", " ", local).strip()
    cleaned = re.sub(r"\s+\d+$", "", cleaned).strip()
    if cleaned:
        words = [w.capitalize() for w in cleaned.split() if w]
        if words:
            return " ".join(words)
    return local.capitalize() if local else "Rakshak User"

