-- Update RLS policies to allow players to view all tournaments and teams
-- This allows players to select any tournament and team when submitting screenshots

-- Drop the restrictive player tournament view policy
DROP POLICY IF EXISTS "Players can view their tournament" ON public.tournaments;

-- Allow all authenticated users to view all tournaments
CREATE POLICY "All authenticated users can view tournaments"
ON public.tournaments
FOR SELECT
TO authenticated
USING (true);

-- Drop the restrictive team view policy
DROP POLICY IF EXISTS "Users can view teams in their tournament" ON public.teams;

-- Allow all authenticated users to view all teams
CREATE POLICY "All authenticated users can view teams"
ON public.teams
FOR SELECT
TO authenticated
USING (true);