-- ==============================================================================
-- Migration 00038: payment-status fields on student_fee_assignments
-- ------------------------------------------------------------------------------
-- ParentFeesPage, StudentDashboard, ParentDashboard and admin FeeReceiptPage read
-- these denormalised payment fields off the assignment row. They existed only on
-- the hand-edited live DB; add them so a clean deploy matches. Idempotent.
-- (fee_receipts remains the canonical payments ledger; these mirror the latest
--  payment onto the due for convenient per-row display.)
-- ==============================================================================

ALTER TABLE public.student_fee_assignments
  ADD COLUMN IF NOT EXISTS paid_amount         NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_date           DATE,
  ADD COLUMN IF NOT EXISTS payment_mode        TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS receipt_number      TEXT;

-- Backfill paid_amount for rows already marked paid (assume full amount paid).
UPDATE public.student_fee_assignments
SET paid_amount = amount
WHERE status = 'paid' AND (paid_amount IS NULL OR paid_amount = 0);
