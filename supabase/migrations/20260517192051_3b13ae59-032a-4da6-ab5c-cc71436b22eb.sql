-- Drop ambiguous functions
DROP FUNCTION IF EXISTS public.handle_asaas_webhook(jsonb);
-- The one with two arguments might still exist, we'll recreate it anyway to be sure.

-- Add asaas_customer_id to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;
CREATE INDEX IF NOT EXISTS idx_customers_asaas_id ON public.customers(asaas_customer_id);

-- Re-create the robust handle_asaas_webhook
CREATE OR REPLACE FUNCTION public.handle_asaas_webhook(_payload jsonb, _tenant_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _event TEXT;
  _asaas_payment_id TEXT;
  _asaas_customer_id TEXT;
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
  _asaas_customer_id := _payload->'payment'->>'customer';
  _effective_tenant_id := _tenant_id;

  -- Log the webhook ALWAYS
  INSERT INTO public.asaas_webhooks (event_type, payment_id, payload, tenant_id)
  VALUES (_event, _asaas_payment_id, _payload, _effective_tenant_id);

  -- Only interested in confirmed payments for processing logic
  IF _event NOT IN ('PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED') THEN
    RETURN jsonb_build_object('success', true, 'message', 'Ignored event type');
  END IF;

  -- 1. Try to find the payment record
  SELECT * INTO _payment_row FROM public.payments 
   WHERE asaas_payment_id = _asaas_payment_id 
   LIMIT 1;

  -- 2. If not found, try to find customer by asaas_customer_id
  IF _payment_row.id IS NULL AND _asaas_customer_id IS NOT NULL THEN
    SELECT * INTO _customer_row FROM public.customers 
     WHERE asaas_customer_id = _asaas_customer_id 
     LIMIT 1;
     
    IF _customer_row.id IS NOT NULL THEN
       _effective_tenant_id := _customer_row.tenant_id;
       
       -- Create the payment record on the fly if it doesn't exist
       INSERT INTO public.payments (
         tenant_id, customer_id, asaas_payment_id, amount, created_at
       ) VALUES (
         _customer_row.tenant_id, 
         _customer_row.id, 
         _asaas_payment_id, 
         (_payload->'payment'->>'value')::numeric,
         now()
       ) RETURNING * INTO _payment_row;
    END IF;
  END IF;

  -- 3. If still not found, we can't process
  IF _payment_row.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment/Customer not identified');
  END IF;

  -- If already processed, ignore but return success
  IF _payment_row.paid_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already processed');
  END IF;

  -- Update payment
  UPDATE public.payments 
     SET paid_at = now(), raw_webhook = _payload 
   WHERE id = _payment_row.id;

  -- Get customer and tenant if not already loaded
  IF _customer_row.id IS NULL THEN
    SELECT * INTO _customer_row FROM public.customers WHERE id = _payment_row.customer_id;
  END IF;
  SELECT * INTO _tenant_row FROM public.tenants WHERE id = COALESCE(_effective_tenant_id, _payment_row.tenant_id);
  
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
        _payment_row.tenant_id, _payment_row.customer_id, 'confirmed', _msg, _whatsapp, 'pending', 0, 3, now()
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;
