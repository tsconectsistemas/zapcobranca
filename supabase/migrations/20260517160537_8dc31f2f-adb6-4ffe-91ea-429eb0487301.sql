-- Drop existing ambiguous functions
DROP FUNCTION IF EXISTS public.get_public_payment_info(_token uuid);
DROP FUNCTION IF EXISTS public.get_public_payment_info(_token text);

-- Create single definitive version
CREATE OR REPLACE FUNCTION public.get_public_payment_info(_token text)
RETURNS TABLE (
    customer_name TEXT,
    monthly_value NUMERIC,
    expiration_date TEXT,
    pix_emv_payload TEXT,
    plan TEXT,
    company_name TEXT,
    pix_expiration_minutes INTEGER,
    server_time TIMESTAMPTZ,
    payload_updated_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if token is a valid UUID
    IF _token IS NULL OR _token = '' THEN
        RETURN;
    END IF;

    -- Using a block to catch casting errors if any
    BEGIN
        RETURN QUERY
        SELECT
            c.name::TEXT as customer_name,
            c.monthly_value,
            c.expiration_date::TEXT,
            c.pix_emv_payload,
            c.plan::TEXT,
            t.company_name::TEXT,
            COALESCE(s.pix_expiration_minutes, 60)::INTEGER as pix_expiration_minutes,
            now() as server_time,
            c.updated_at as payload_updated_at
        FROM public.customers c
        JOIN public.tenants t ON t.id = c.tenant_id
        LEFT JOIN public.tenant_secrets s ON s.tenant_id = t.id
        WHERE c.payment_token = _token::uuid
        LIMIT 1;
    EXCEPTION WHEN others THEN
        -- If cast fails or other error, return empty set (which triggers 'not found' gracefully in frontend)
        RETURN;
    END;
END;
$$;
