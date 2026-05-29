-- Add asaas_webhook_token column to tenant_secrets if it doesn't exist
ALTER TABLE public.tenant_secrets 
ADD COLUMN IF NOT EXISTS asaas_webhook_token TEXT;

-- Update the handle_asaas_webhook function to be more robust (already exists, but ensuring it's clean)
-- The function was created in a previous turn, no changes needed to its logic yet.
