import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import toast from "react-hot-toast";
import { Settings } from "lucide-react";

export const Route = createFileRoute("/admin/login")({
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // Check if user is in admin_users table
      const { data: adminData, error: adminError } = await supabase
        .from("admin_users")
        .select("*")
        .eq("user_id", authData.user.id)
        .eq("active", true)
        .maybeSingle();

      if (adminError) throw adminError;

      if (!adminData) {
        await supabase.auth.signOut();
        toast.error("Acesso negado. Esta conta não tem permissão administrativa.");
        return;
      }

      toast.success("Bem-vindo ao painel!");
      navigate({ to: "/admin/dashboard" });
    } catch (error: any) {
      toast.error(error.message || "Erro ao realizar login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1117] flex flex-col items-center justify-center p-4">
      <div className="mb-8 flex flex-col items-center">
        <Logo size="lg" />
        <div className="mt-2 flex items-center gap-2 text-gray-400">
          <Settings className="h-4 w-4" />
          <span className="text-sm font-medium uppercase tracking-wider">Painel Administrativo</span>
        </div>
      </div>

      <div className="w-full max-w-md bg-[#1A1D27] rounded-xl border border-white/5 p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <h2 className="text-xl font-bold text-white">Acesso restrito</h2>
          <p className="text-sm text-gray-400 mt-1">Apenas administradores do sistema</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-300">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@zapcobranca.com.br"
              className="bg-[#0F1117] border-white/10 text-white focus:border-[#1D9E75] focus:ring-[#1D9E75]/20"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-gray-300">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-[#0F1117] border-white/10 text-white focus:border-[#1D9E75] focus:ring-[#1D9E75]/20"
              required
            />
          </div>

          <Button 
            type="submit" 
            className="w-full bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white font-semibold h-11"
            disabled={loading}
          >
            {loading ? "Entrando..." : "Entrar no painel"}
          </Button>
        </form>
      </div>
    </div>
  );
}
