I will create a Supabase Edge Function to handle the Asaas webhooks. This is necessary because the current TanStack Start API route in the preview environment is behind an authentication bridge (returning 302 redirects), which prevents Asaas from delivering events. Supabase Edge Functions provide a public URL that Asaas can access directly.

### Technical Details
1. **Create Edge Function**: I'll create `supabase/functions/asaas-webhook/index.ts`.
2. **Logic Migration**: 
   - Port the webhook processing logic from `src/routes/api.asaas-webhook.ts` to the Edge Function.
   - Include the Pix Key extraction utility for robust payment matching.
   - Ensure the function uses the Supabase Service Role key to perform database operations.
   - Implement the `asaas-access-token` validation per tenant.
3. **Deployment**: Deploy the function to Supabase.
4. **URL Configuration**: The new webhook URL will be `https://dxxbqeqdwagmtynfsmzw.supabase.co/functions/v1/asaas-webhook`.

### User Section
- The error you're seeing (302) happens because the preview environment requires a login to access pages, which blocks Asaas from sending data.
- I'm moving the webhook logic to a "Supabase Edge Function," which is a special type of secure, public endpoint designed for this exact purpose.
- Once deployed, you'll use a new URL in your Asaas panel that won't have this redirection problem.
