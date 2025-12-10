-- Test script for payouts.paid_status column
-- This verifies the schema before implementing the UI

-- 1. Check if paid_status column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'payouts' AND column_name = 'paid_status';

-- 2. Get count of payouts by status
SELECT paid_status, COUNT(*) as count
FROM payouts
GROUP BY paid_status;

-- 3. Test update to paid (will rollback)
BEGIN;
UPDATE payouts 
SET paid_status = 'paid', paid_at = NOW()
WHERE id = (SELECT id FROM payouts WHERE paid_status = 'unpaid' LIMIT 1)
RETURNING id, mid, merchant_name, paid_status, paid_at;
ROLLBACK;

-- 4. Verify deals.available_to_purchase column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'deals' AND column_name = 'available_to_purchase';

-- 5. Get count of deals by available_to_purchase
SELECT available_to_purchase, COUNT(*) as count
FROM deals
GROUP BY available_to_purchase;
