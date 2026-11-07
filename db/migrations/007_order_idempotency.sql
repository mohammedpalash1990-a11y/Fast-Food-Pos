ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS idempotency_key varchar(64),
  ADD COLUMN IF NOT EXISTS request_hash char(64);

CREATE UNIQUE INDEX IF NOT EXISTS orders_branch_idempotency_key_unique
  ON orders(branch_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
