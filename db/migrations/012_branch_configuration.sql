ALTER TABLE branch_settings
  ADD COLUMN IF NOT EXISTS receipt_footer text NOT NULL DEFAULT 'Thank you for visiting Musafir!';
