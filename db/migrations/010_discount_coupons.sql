-- Branch-scoped coupons. Usage is incremented in the same transaction as order creation.
CREATE TABLE IF NOT EXISTS discount_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches ON DELETE CASCADE,
  code text NOT NULL CHECK (code = upper(code) AND length(code) BETWEEN 3 AND 32),
  discount_type text NOT NULL CHECK (discount_type IN ('percentage','fixed')),
  discount_value numeric(12,2) NOT NULL CHECK (discount_value > 0),
  min_subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (min_subtotal >= 0),
  max_discount numeric(12,2) CHECK (max_discount IS NULL OR max_discount > 0),
  usage_limit integer CHECK (usage_limit IS NULL OR usage_limit > 0),
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(branch_id,code),
  CHECK (discount_type <> 'percentage' OR discount_value <= 100),
  CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at)
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES discount_coupons ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code text;
CREATE INDEX IF NOT EXISTS discount_coupons_branch_active_idx ON discount_coupons(branch_id,active,code);
