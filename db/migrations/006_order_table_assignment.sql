ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS table_id uuid REFERENCES restaurant_tables(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_branch_table_status_idx
  ON orders(branch_id, table_id, status)
  WHERE table_id IS NOT NULL;
