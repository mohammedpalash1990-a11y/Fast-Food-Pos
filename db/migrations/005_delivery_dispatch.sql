CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches ON DELETE CASCADE,
  order_id uuid NOT NULL UNIQUE REFERENCES orders ON DELETE CASCADE,
  assigned_driver_id uuid REFERENCES users ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Assigned','Picked Up','Delivered','Failed')),
  delivery_address text NOT NULL DEFAULT '',
  delivery_note text NOT NULL DEFAULT '',
  assigned_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deliveries_branch_status_idx ON deliveries(branch_id,status,created_at DESC);
