-- Add tenant_id to asaas_webhooks if it doesn't exist
ALTER TABLE public.asaas_webhooks ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS asaas_webhooks_tenant_idx ON public.asaas_webhooks(tenant_id);

-- Update RLS policies for asaas_webhooks
DROP POLICY IF EXISTS "Allow public insert for webhooks" ON public.asaas_webhooks;
CREATE POLICY "Allow public insert for webhooks" ON public.asaas_webhooks FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Tenants can view their own webhooks" ON public.asaas_webhooks;
CREATE POLICY "Tenants can view their own webhooks" ON public.asaas_webhooks 
FOR SELECT USING (auth.uid() IN (
  SELECT t.user_id FROM public.tenants t WHERE t.id = asaas_webhooks.tenant_id
));

-- Update the handle_asaas_webhook function
CREATE OR REPLACE FUNCTION public.handle_asaas_webhook(_payload JSONB, _tenant_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event TEXT;
  _asaas_payment_id TEXT;
  _payment_row public.payments;
  _customer_row public.customers;
  _tenant_row public.tenants;
  _settings JSONB;
  _msg TEXT;
  _whatsapp TEXT;
  _effective_tenant_id UUID;
BEGIN
  _event := _payload->>'event';
  _asaas_payment_id := _payload->'payment'->>'id';
  _effective_tenant_id := _tenant_id;

  -- Log the webhook
  INSERT INTO public.asaas_webhooks (event_type, payment_id, payload, tenant_id)
  VALUES (_event, _asaas_payment_id, _payload, _effective_tenant_id);

  -- Only interested in confirmed payments
  IF _event NOT IN ('PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED') THEN
    RETURN jsonb_build_object('success', true, 'message', 'Ignored event');
  END IF;

  -- Find the payment record if tenant_id is not provided
  IF _effective_tenant_id IS NULL THEN
    SELECT tenant_id INTO _effective_tenant_id FROM public.payments 
     WHERE asaas_payment_id = _asaas_payment_id 
     LIMIT 1;
  END IF;

  -- Find the payment record
  SELECT * INTO _payment_row FROM public.payments 
   WHERE asaas_payment_id = _asaas_payment_id 
   AND (tenant_id = _effective_tenant_id OR _effective_tenant_id IS NULL)
   ORDER BY created_at DESC LIMIT 1;

  IF _payment_row.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
  END IF;

  -- Update effective tenant id if it was null
  IF _effective_tenant_id IS NULL THEN
    _effective_tenant_id := _payment_row.tenant_id;
    UPDATE public.asaas_webhooks SET tenant_id = _effective_tenant_id WHERE payment_id = _asaas_payment_id AND tenant_id IS NULL;
  END IF;

  -- If already processed, ignore
  IF _payment_row.paid_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already processed');
  END IF;

  -- Update payment
  UPDATE public.payments 
     SET paid_at = now(), raw_webhook = _payload 
   WHERE id = _payment_row.id;

  -- Get customer and tenant
  SELECT * INTO _customer_row FROM public.customers WHERE id = _payment_row.customer_id;
  SELECT * INTO _tenant_row FROM public.tenants WHERE id = _effective_tenant_id;
  
  -- Update customer expiration (+30 days)
  UPDATE public.customers
     SET expiration_date = (COALESCE(expiration_date, CURRENT_DATE) + interval '30 days')::date,
         status = 'active',
         updated_at = now()
   WHERE id = _customer_row.id;

  -- Queue WhatsApp notification if enabled
  _settings := COALESCE(_tenant_row.notification_settings, '{"confirmed": true}'::jsonb);
  
  IF (_settings->>'confirmed')::boolean IS TRUE THEN
    _whatsapp := regexp_replace(_customer_row.whatsapp, '\D', '', 'g');
    
    IF _whatsapp IS NOT NULL AND _whatsapp != '' THEN
      _msg := '✅ *Pagamento Confirmado!*' || chr(10) || chr(10) ||
              'Olá ' || _customer_row.name || ', recebemos seu pagamento.' || chr(10) ||
              'Sua assinatura foi renovada por mais 30 dias.' || chr(10) ||
              'Nova validade: ' || to_char((COALESCE(_customer_row.expiration_date, CURRENT_DATE) + interval '30 days')::date, 'DD/MM/YYYY') || chr(10) || chr(10) ||
              'Obrigado pela preferência! 🚀';

      INSERT INTO public.notification_queue (
        tenant_id, customer_id, type, message, whatsapp_number, status, attempts, max_attempts, next_attempt_at
      ) VALUES (
        _effective_tenant_id, _payment_row.customer_id, 'confirmed', _msg, _whatsapp, 'pending', 0, 3, now()
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;