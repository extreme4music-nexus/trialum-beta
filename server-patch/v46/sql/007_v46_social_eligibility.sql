-- Trialum v46 eligibility state. Additive migration; does not touch social profiles or game worlds.
CREATE TABLE IF NOT EXISTS social_eligibility_challenges (
  challenge_id text PRIMARY KEY,
  nonce_hash bytea NOT NULL,
  action text NOT NULL CHECK (action = 'social_enable'),
  consent_version text NOT NULL,
  package_name text NOT NULL,
  version_code integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);
CREATE INDEX IF NOT EXISTS social_eligibility_challenges_expiry_idx
  ON social_eligibility_challenges (expires_at);

CREATE TABLE IF NOT EXISTS social_eligibility_sessions (
  token_hash bytea PRIMARY KEY,
  installation_id uuid REFERENCES installations(id) ON DELETE CASCADE,
  consent_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS social_eligibility_sessions_expiry_idx
  ON social_eligibility_sessions (expires_at);
CREATE INDEX IF NOT EXISTS social_eligibility_sessions_installation_idx
  ON social_eligibility_sessions (installation_id, expires_at);
