-- Fix any records that have 'pending_confirmation' status to use 'pending' instead
-- This ensures consistency going forward

UPDATE public.csv_data 
SET assignment_status = 'pending', 
    updated_at = NOW() 
WHERE assignment_status = 'pending_confirmation';

-- Verify the fix
SELECT assignment_status, COUNT(*) 
FROM public.csv_data 
GROUP BY assignment_status;
