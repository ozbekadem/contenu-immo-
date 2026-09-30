#!/usr/bin/env bash
# Lance les tests SQL sur un PostgreSQL local (base jetable « linkimmo_test »).
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL="psql -v ON_ERROR_STOP=1 -q -X"
dropdb --if-exists linkimmo_test && createdb linkimmo_test
$PSQL -d linkimmo_test -f tests/00_simulation_supabase.sql
$PSQL -d linkimmo_test -f migrations/0001_schema.sql
$PSQL -d linkimmo_test -f migrations/0001_schema.sql   # ré-exécutable sans erreur
$PSQL -d linkimmo_test -f tests/10_tests_sync.sql
