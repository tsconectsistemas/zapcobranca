import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface Tenant {
  id: string;
  user_id: string | null;
  company_name: string;
  email: string;
  whatsapp: string | null;
  plan: string | null;
  max_customers: number | null;
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  tenant: Tenant | null;
  loading: boolean;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null }>;
  signUp: (params: {
    email: string;
    password: string;
    companyName: string;
    whatsapp: string;
  }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshTenant: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTenant = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from("tenants")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar tenant:", error.message);
      setTenant(null);
      return;
    }
    setTenant(data as Tenant | null);
  }, []);

  const refreshTenant = useCallback(async () => {
    if (user?.id) await loadTenant(user.id);
  }, [user?.id, loadTenant]);

  useEffect(() => {
    // 1. Set up the listener FIRST (sync only inside callback)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // Defer Supabase calls to avoid deadlocks inside the callback
        setTimeout(() => {
          loadTenant(newSession.user.id);
        }, 0);
      } else {
        setTenant(null);
      }
    });

    // 2. THEN check existing session
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        loadTenant(existing.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadTenant]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback<AuthContextValue["signUp"]>(
    async ({ email, password, companyName, whatsapp }) => {
      const redirectUrl = `${window.location.origin}/dashboard`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { company_name: companyName, whatsapp },
        },
      });

      if (error) return { error: error.message };
      if (!data.user) return { error: "Falha ao criar usuário" };

      // Create tenant record (RLS allows insert when user_id = auth.uid())
      const { error: tenantError } = await supabase.from("tenants").insert({
        user_id: data.user.id,
        company_name: companyName,
        email,
        whatsapp: whatsapp || null,
      });

      if (tenantError) {
        console.error("Erro ao criar tenant:", tenantError.message);
        return { error: "Conta criada, mas houve um erro ao salvar a revenda" };
      }

      // Auto-confirm is enabled, so a session may already exist
      await loadTenant(data.user.id);
      return { error: null };
    },
    [loadTenant]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setTenant(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        tenant,
        loading,
        signIn,
        signUp,
        signOut,
        refreshTenant,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
