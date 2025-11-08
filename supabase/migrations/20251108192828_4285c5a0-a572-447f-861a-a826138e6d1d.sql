-- Update INSERT policies to allow admins to log adjustments for any user
DROP POLICY IF EXISTS "Users and admins can create deposit requests" ON deposit_requests;
DROP POLICY IF EXISTS "Users and admins can create withdrawal requests" ON withdrawal_requests;

CREATE POLICY "Users and admins can create deposit requests"
ON deposit_requests
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (
    EXISTS (
      SELECT 1 FROM admin_user_relationships
      WHERE admin_user_relationships.admin_id = auth.uid()
      AND admin_user_relationships.user_id = deposit_requests.user_id
    )
  )
);

CREATE POLICY "Users and admins can create withdrawal requests"
ON withdrawal_requests
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (
    EXISTS (
      SELECT 1 FROM admin_user_relationships
      WHERE admin_user_relationships.admin_id = auth.uid()
      AND admin_user_relationships.user_id = withdrawal_requests.user_id
    )
  )
);