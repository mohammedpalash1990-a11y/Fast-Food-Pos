ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code text;
CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  code text NOT NULL,
  discount_type text NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value numeric(12,2) NOT NULL CHECK (discount_value > 0),
  minimum_order_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (minimum_order_amount >= 0),
  maximum_discount numeric(12,2) CHECK (maximum_discount IS NULL OR maximum_discount > 0),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  usage_limit integer CHECK (usage_limit IS NULL OR usage_limit > 0),
  usage_count integer NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, code),
  CHECK (discount_type <> 'percent' OR discount_value <= 100),
  CHECK (expires_at IS NULL OR expires_at > starts_at)
);
CREATE INDEX IF NOT EXISTS coupons_branch_active_idx ON coupons(branch_id, active, code);
CREATE INDEX IF NOT EXISTS orders_branch_coupon_idx ON orders(branch_id, coupon_code) WHERE coupon_code IS NOT NULL;
