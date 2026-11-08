-- Branch-level kitchen workflow preference. Defaults to no kitchen acceptance gate.
CREATE TABLE IF NOT EXISTS branch_settings (
  branch_id uuid PRIMARY KEY REFERENCES branches(id) ON DELETE CASCADE,
  kitchen_acceptance_required boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
