-- Create table for webhook logs
CREATE TABLE IF NOT EXISTS public.asaas_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT,
  payment_id TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.asaas_webhooks ENABLE ROW LEVEL SECURITY;

-- Allow public inserts for webhooks (validated by logic later)
CREATE POLICY "Allow public insert for webhooks" ON public.asaas_webhooks FOR INSERT WITH CHECK (true);

-- Function to handle Asaas webhook
CREATE OR REPLACE FUNCTION public.handle_asaas_webhook(_payload JSONB)
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
BEGIN
  _event := _payload->>'event';
  _asaas_payment_id := _payload->'payment'->>'id';

  -- Log the webhook
  INSERT INTO public.asaas_webhooks (event_type, payment_id, payload)
  VALUES (_event, _asaas_payment_id, _payload);

  -- Only interested in confirmed payments
  IF _event NOT IN ('PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED') THEN
    RETURN jsonb_build_object('success', true, 'message', 'Ignored event');
  END IF;

  -- Find the payment record
  SELECT * INTO _payment_row FROM public.payments 
   WHERE asaas_payment_id = _asaas_payment_id 
   ORDER BY created_at DESC LIMIT 1;

  IF _payment_row.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
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
  SELECT * INTO _tenant_row FROM public.tenants WHERE id = _payment_row.tenant_id;
  
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
$$;