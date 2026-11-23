#!/bin/sh
# V44 shared shop rollout — run manually on the existing Social PostgreSQL
# AFTER a tested backup and BEFORE deploying server-patch/v44/src/shared.mjs.
# Idempotent, data-preserving: points remain the same integer ledger, renamed
# 'sharedCredits' only at API/UI boundary. No user-owned credits are touched.
set -eu
: "${POSTGRES_USER:?POSTGRES_USER missing}"
: "${POSTGRES_DB:?POSTGRES_DB missing}"
psql -X -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
BEGIN;
-- Existing purchased toys default to being placed. Purchased property is never
-- destroyed when the owner removes a toy from the physical scene.
ALTER TABLE playground_toys
  ADD COLUMN IF NOT EXISTS placed boolean NOT NULL DEFAULT true;
UPDATE playground_toys SET placed=true WHERE placed IS NULL;
ALTER TABLE playground_toys DROP CONSTRAINT IF EXISTS playground_toys_toy_id_check;
ALTER TABLE playground_toys ADD CONSTRAINT playground_toys_toy_id_check
 CHECK (toy_id IN (
  'sandbox','seesaw','slide','pool','obstacle','trampoline',
  'swing','carousel','tunnel','climbing','ballpit','puzzlewall','music','stargazer'
 ));
-- Only already-purchased, currently placed toys can earn credits.
-- Future activities retain the same server-side per-player daily caps.
ALTER TABLE playground_activities DROP CONSTRAINT IF EXISTS playground_activities_toy_id_check;
ALTER TABLE playground_activities ADD CONSTRAINT playground_activities_toy_id_check
 CHECK (toy_id IN (
  'sandbox','seesaw','slide','pool','obstacle','trampoline',
  'swing','carousel','tunnel','climbing','ballpit','puzzlewall','music','stargazer'
 ));
CREATE INDEX IF NOT EXISTS playground_toys_placed_idx
 ON playground_toys(playground_id,placed);
COMMIT;
SQL
