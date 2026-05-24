#!/usr/bin/env bash
# Run all FieldSightAI migrations in order against the target database.
#
# Usage:
#   DATABASE_URL=postgres://user:pass@host:5432/dbname ./migrations/run-migrations.sh
#
# Or set DATABASE_URL in .env.local and source it first:
#   set -a && source .env.local && set +a
#   ./migrations/run-migrations.sh

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set."
  echo "Export it or source your .env.local before running this script."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MIGRATIONS=(
  "001_create_organisations.sql"
  "002_create_users.sql"
  "003_create_sessions.sql"
  "004_create_transcript_segments.sql"
  "005_create_export_log.sql"
  "006_create_site_content.sql"
)

echo "Running ${#MIGRATIONS[@]} migration(s) against: ${DATABASE_URL%%@*}@..."

for migration in "${MIGRATIONS[@]}"; do
  echo "  → $migration"
  psql "$DATABASE_URL" -f "$SCRIPT_DIR/$migration"
done

echo "All migrations applied successfully."
