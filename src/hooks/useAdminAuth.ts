import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AdminUser {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  last_login: string | null;
  created_at: string;
}

export function useAdminAuth() {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAdminData = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setAdmin(data as AdminUser);
        // Update last_login
        await supabase
          .from('admin_users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', data.id);
      } else {
        setAdmin(null);
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setLoading(false);
        return;
      }
      fetchAdminData(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!session) {
          setAdmin(null);
          setLoading(false);
          return;
        }
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          fetchAdminData(session.user.id);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setAdmin(null);
    window.location.href = '/admin/login';
  };

  return { admin, loading, signOut, isAdmin: !!admin };
}
