-- Drop the existing catch-all policy
DROP POLICY IF EXISTS "Admins can manage their users' payment settings" ON user_payment_settings;

-- Create separate INSERT policy (for new payment settings)
CREATE POLICY "Admins can insert payment settings for their users"
ON user_payment_settings
FOR INSERT
WITH CHECK (
  auth.uid() = admin_id 
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM admin_user_relationships
      WHERE admin_user_relationships.admin_id = auth.uid()
      AND admin_user_relationships.user_id = user_payment_settings.user_id
    )
  )
);

-- Create separate UPDATE policy (for existing payment settings)
CREATE POLICY "Admins can update payment settings for their users"
ON user_payment_settings
FOR UPDATE
USING (
  auth.uid() = admin_id
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_user_relationships.admin_id = auth.uid()
    AND admin_user_relationships.user_id = user_payment_settings.user_id
  )
)
WITH CHECK (
  auth.uid() = admin_id
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_user_relationships.admin_id = auth.uid()
    AND admin_user_relationships.user_id = user_payment_settings.user_id
  )
);

-- Create SELECT policy
CREATE POLICY "Admins can view payment settings for their users"
ON user_payment_settings
FOR SELECT
USING (
  auth.uid() = admin_id
  OR auth.uid() = user_id
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM admin_user_relationships
    WHERE admin_user_relationships.admin_id = auth.uid()
    AND admin_user_relationships.user_id = user_payment_settings.user_id
  )
);

-- Create DELETE policy for completeness
CREATE POLICY "Admins can delete payment settings for their users"
ON user_payment_settings
FOR DELETE
USING (
  auth.uid() = admin_id
  OR has_role(auth.uid(), 'super_admin'::app_role)
);