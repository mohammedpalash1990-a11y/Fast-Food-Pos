ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'pos';

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_channel_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_channel_check CHECK (channel IN ('pos','qr'));

CREATE INDEX IF NOT EXISTS orders_branch_channel_created_idx
  ON orders(branch_id,channel,created_at DESC);
