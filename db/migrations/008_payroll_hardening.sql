-- Payroll hardening for the current POS migration sequence.
-- This is migration 008 because 003 is already reserved for reservations in this branch.
ALTER TABLE payroll_records
  ADD COLUMN IF NOT EXISTS other_deduction numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_records
  ADD COLUMN IF NOT EXISTS deduction_note text NOT NULL DEFAULT '';

-- Preserve deductions recorded by the previous schema before switching the API to other_deduction.
UPDATE payroll_records
SET other_deduction = deduction
WHERE other_deduction = 0 AND deduction > 0;

ALTER TABLE payroll_records DROP CONSTRAINT IF EXISTS payroll_records_period_check;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payroll_records_period_format'
      AND conrelid = 'payroll_records'::regclass
  ) THEN
    ALTER TABLE payroll_records
      ADD CONSTRAINT payroll_records_period_format
      CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payroll_records_other_deduction_nonneg'
      AND conrelid = 'payroll_records'::regclass
  ) THEN
    ALTER TABLE payroll_records
      ADD CONSTRAINT payroll_records_other_deduction_nonneg
      CHECK (other_deduction >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payroll_records_net_matches_parts'
      AND conrelid = 'payroll_records'::regclass
  ) THEN
    ALTER TABLE payroll_records
      ADD CONSTRAINT payroll_records_net_matches_parts
      CHECK (net_salary = base_salary + bonus - advance_deduction - other_deduction) NOT VALID;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS payroll_records_org_branch_period_idx
  ON payroll_records(organization_id, branch_id, period DESC);
CREATE INDEX IF NOT EXISTS salary_advances_branch_idx
  ON salary_advances(organization_id, branch_id, employee_id);
