#!/bin/sh
set -e

# Validate core environment variables if running the application
missing=""
[ -z "$DATABASE_URL" ] && missing="$missing DATABASE_URL"
[ -z "$SESSION_SECRET" ] && missing="$missing SESSION_SECRET"

if [ -n "$missing" ]; then
    echo "[rakshak] Warning: Missing recommended environment variable(s):$missing" >&2
    echo "[rakshak] Ensure DATABASE_URL and SESSION_SECRET are configured in your deployment." >&2
fi

# Optional automated database migration at container start
if [ "$RUN_MIGRATIONS" = "true" ] || [ "$RUN_MIGRATIONS" = "1" ]; then
    echo "[rakshak] Applying database migrations (alembic upgrade head)..."
    alembic upgrade head
    echo "[rakshak] Migrations applied successfully."
fi

exec "$@"
