DROP POLICY IF EXISTS "Tenants can view their own webhooks" ON public.asaas_webhooks;

CREATE POLICY "Tenants can view their own webhooks" 
ON public.asaas_webhooks 
FOR SELECT 
USING (
  (tenant_id IS NULL AND auth.role() = 'authenticated') OR 
  (auth.uid() IN (SELECT user_id FROM public.tenants WHERE id = asaas_webhooks.tenant_id))
);
