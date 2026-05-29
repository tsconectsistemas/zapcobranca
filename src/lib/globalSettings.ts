import { supabase } from '@/integrations/supabase/client'

export async function getGlobalSettings(): Promise<{
  evolutionApiUrl: string
  evolutionApiKey: string
  appUrl: string
}> {
  const { data, error } = await supabase.functions.invoke('get-global-settings')
  if (error) throw error
  return data
}
