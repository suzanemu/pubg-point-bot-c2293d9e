-- Add RLS policy to allow admins to delete screenshots
CREATE POLICY "Admins can delete match screenshots"
ON match_screenshots
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));