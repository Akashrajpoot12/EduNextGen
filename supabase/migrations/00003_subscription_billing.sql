-- ==============================================================================
-- MULTI-TENANT SCHOOL SaaS - PHASE 7: SUBSCRIPTION & BILLING
-- ==============================================================================

-- Add billing columns to the schools table to track SaaS subscriptions
ALTER TABLE public.schools 
ADD COLUMN stripe_customer_id TEXT UNIQUE,
ADD COLUMN subscription_status TEXT DEFAULT 'trialing' CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid')),
ADD COLUMN student_quota INT DEFAULT 50; -- Default free tier or trial quota limit
