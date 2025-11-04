-- Remove team-based restriction on screenshot uploads
-- Allow any authenticated user to upload screenshots for any team
DROP POLICY IF EXISTS "Players can insert screenshots for their team" ON public.match_screenshots;

CREATE POLICY "Authenticated users can insert screenshots for any team"
ON public.match_screenshots
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Update the players view policy to allow everyone to see screenshots
DROP POLICY IF EXISTS "Players can view all screenshots" ON public.match_screenshots;

CREATE POLICY "Everyone can view all screenshots"
ON public.match_screenshots
FOR SELECT
TO authenticated
USING (true);