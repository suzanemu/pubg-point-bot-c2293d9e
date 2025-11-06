-- Replace match_number with day column
ALTER TABLE public.match_screenshots 
DROP COLUMN IF EXISTS match_number;

ALTER TABLE public.match_screenshots 
ADD COLUMN day integer NOT NULL DEFAULT 1 CHECK (day >= 1 AND day <= 3);