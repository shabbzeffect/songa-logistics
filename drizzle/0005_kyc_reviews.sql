-- Songa Logistics migration 0005: rider KYC + merchant review replies.
-- Existing verified riders are grandfathered as KYC-approved; everyone else
-- starts pending. Idempotent: safe to re-run.

ALTER TABLE riders ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE riders ADD COLUMN IF NOT EXISTS kyc_note TEXT NOT NULL DEFAULT '';
ALTER TABLE riders ADD COLUMN IF NOT EXISTS kyc_docs JSONB NOT NULL DEFAULT '[]';
UPDATE riders SET kyc_status = 'approved' WHERE verified = true AND kyc_status = 'pending';

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reply TEXT NOT NULL DEFAULT '';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;
