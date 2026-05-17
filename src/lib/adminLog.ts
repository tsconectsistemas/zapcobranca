import { supabase } from '@/integrations/supabase/client'

export async function logAdminAction({
  adminId,
  action,
  targetType,
  targetId,
  details,
}: {
  adminId: string
  action: string
  targetType?: string
  targetId?: string
  details?: Record<string, any>
}) {
  try {
    const { error } = await supabase.from('admin_logs').insert({
      admin_id: adminId,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
      created_at: new Date().toISOString(),
    })
    
    if (error) {
      console.error('Error logging admin action:', error)
    }
  } catch (err) {
    console.error('Unexpected error logging admin action:', err)
  }
}
