#!/bin/sh
# Trialum 1.4 v44 account recovery. Explicit owner-controlled migration only.
# Never run against an unverified production DB or without tested backup.
set -eu
: "${POSTGRES_USER:?administrator username required}"
: "${POSTGRES_DB:?database name required}"
psql -X -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
BEGIN;
CREATE TABLE IF NOT EXISTS social_account_recovery (
 installation_id uuid PRIMARY KEY REFERENCES installations(id) ON DELETE CASCADE,
 secret_verifier bytea NOT NULL CHECK (octet_length(secret_verifier)=32),
 failed_attempts smallint NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 100),
 locked_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 rotated_at timestamptz NOT NULL DEFAULT now()
);
-- Explicit least-privilege grant for existing app role; no broad PUBLIC grants.
DO $$ BEGIN
 IF EXISTS(SELECT FROM pg_roles WHERE rolname='trialum_app') THEN
  GRANT SELECT, INSERT, UPDATE, DELETE ON social_account_recovery TO trialum_app;
  -- Recovery explicitly revokes old device push delivery. No INSERT or UPDATE grant.
  GRANT DELETE ON push_registrations TO trialum_app;
 END IF;
END $$;
COMMIT;
SQL
