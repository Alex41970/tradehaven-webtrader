-- Allow admins to update trades for their assigned users
CREATE POLICY "Admins can update assigned users' trades"
ON public.trades
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_id = auth.uid() AND user_id = trades.user_id
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_id = auth.uid() AND user_id = trades.user_id
  )
);