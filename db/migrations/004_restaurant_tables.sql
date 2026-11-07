CREATE TABLE IF NOT EXISTS restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches ON DELETE CASCADE,
  table_number text NOT NULL,
  seats integer NOT NULL DEFAULT 2 CHECK (seats BETWEEN 1 AND 30),
  status text NOT NULL DEFAULT 'Available' CHECK (status IN ('Available','Occupied','Reserved','Cleaning','Out of Service')),
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES users ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(branch_id, table_number)
);
CREATE INDEX IF NOT EXISTS restaurant_tables_branch_status_idx
  ON restaurant_tables(branch_id, status, table_number);
