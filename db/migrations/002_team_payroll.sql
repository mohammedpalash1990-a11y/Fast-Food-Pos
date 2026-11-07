CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches ON DELETE CASCADE,
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
  job_role text NOT NULL DEFAULT 'Staff',
  shift text NOT NULL DEFAULT 'Morning',
  monthly_salary numeric(12,2) NOT NULL DEFAULT 0 CHECK(monthly_salary>=0),
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employees_branch_active_idx ON employees(branch_id,active,name);

CREATE TABLE IF NOT EXISTS employee_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches ON DELETE CASCADE,
  attendance_date date NOT NULL,
  status text NOT NULL CHECK(status IN ('Present','Absent','On Leave')),
  created_by uuid REFERENCES users ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id,attendance_date)
);
CREATE INDEX IF NOT EXISTS employee_attendance_branch_date_idx ON employee_attendance(branch_id,attendance_date DESC);

CREATE TABLE IF NOT EXISTS salary_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK(amount>0),
  deducted numeric(12,2) NOT NULL DEFAULT 0 CHECK(deducted>=0 AND deducted<=amount),
  note text NOT NULL DEFAULT 'Salary advance',
  created_by uuid REFERENCES users ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS salary_advances_employee_idx ON salary_advances(employee_id,created_at DESC);

CREATE TABLE IF NOT EXISTS payroll_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches ON DELETE CASCADE,
  period text NOT NULL CHECK(period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  base_salary numeric(12,2) NOT NULL CHECK(base_salary>=0),
  bonus numeric(12,2) NOT NULL DEFAULT 0 CHECK(bonus>=0),
  deduction numeric(12,2) NOT NULL DEFAULT 0 CHECK(deduction>=0),
  advance_deduction numeric(12,2) NOT NULL DEFAULT 0 CHECK(advance_deduction>=0),
  net_salary numeric(12,2) NOT NULL CHECK(net_salary>=0),
  created_by uuid REFERENCES users ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id,period)
);
CREATE INDEX IF NOT EXISTS payroll_records_branch_period_idx ON payroll_records(branch_id,period DESC);

CREATE TABLE IF NOT EXISTS payroll_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id uuid NOT NULL REFERENCES payroll_records ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK(amount>0),
  method text NOT NULL CHECK(method IN ('Cash','Mada')),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES users ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payroll_payments_payroll_idx ON payroll_payments(payroll_id,created_at DESC);

-- Upgrade databases where the payroll table was created before other deductions were supported.
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS deduction numeric(12,2) NOT NULL DEFAULT 0 CHECK(deduction>=0);
