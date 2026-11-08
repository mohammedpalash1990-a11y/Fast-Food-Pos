-- Reporting indexes (B2).
-- The sales, profit & loss and inventory reports aggregate by branch over a
-- business-day window, so every hot table needs a branch-leading index on the
-- column used by that window. All statements are additive and idempotent.

-- Order items are only ever read through their order; the report joins on it.
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);

-- COGS / waste valuation windows scan sale and waste movements by branch + time.
CREATE INDEX IF NOT EXISTS stock_movements_branch_created_idx ON stock_movements(branch_id,created_at DESC);

-- Profit & loss sums payroll payments by payment date within the branch.
CREATE INDEX IF NOT EXISTS payroll_payments_branch_date_idx ON payroll_payments(branch_id,payment_date DESC);

-- Purchase value / payments received per period and branch.
CREATE INDEX IF NOT EXISTS purchases_branch_created_idx ON purchases(branch_id,created_at DESC);
