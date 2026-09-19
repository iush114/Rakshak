"""Environment-driven application configuration helpers."""

import os
from pathlib import Path


def csv_env(name: str, default: str) -> list[str]:
    value = os.getenv(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


def is_production() -> bool:
    return os.getenv("RAKSHAK_ENV", "development").lower() == "production"


def scan_allowed_roots() -> list[Path]:
    configured = csv_env("SCAN_ALLOWED_ROOTS", str(Path.cwd()))
    return [Path(root).expanduser().resolve() for root in configured]


def is_within_allowed_root(path: Path) -> bool:
    resolved = path.resolve()
    return any(resolved == root or root in resolved.parents for root in scan_allowed_roots())