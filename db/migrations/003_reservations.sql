CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches ON DELETE CASCADE,
  guest_name text NOT NULL CHECK(length(trim(guest_name)) BETWEEN 1 AND 120),
  phone text NOT NULL DEFAULT '',
  party_size integer NOT NULL CHECK(party_size BETWEEN 1 AND 30),
  reserved_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'Booked' CHECK(status IN ('Booked','Seated','Completed','Cancelled','No-show')),
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES users ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reservations_branch_time_idx ON reservations(branch_id,reserved_for);
