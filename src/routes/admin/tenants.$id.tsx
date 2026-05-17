import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft,
  Building2,
  Users,
  CreditCard,
  MessageCircle,
  RefreshCw,
  Pause,
  Play,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Zap,
  Smartphone,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parseISO } from "date-fns";
import toast from "react-hot-toast";

export const Route = createFileRoute("/admin/tenants/$id")({
  component: AdminTenantDetail,
});

interface TenantDetail {
  id: string;
  company_name: string;
  email: string;
  whatsapp: string | null;
  plan: string;
  active: boolean;
  created_at: string;
  max_customers: number | null;
  plan_expires_at: string | null;
  notification_config: any;
  user_id: string;
}

interface TenantStats {
  total_customers: number;
  active_customers: number;
  total_payments: number;
  total_notifications: number;
}

function AdminTenantDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: tData, error: tErr } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (tErr) throw tErr;
      if (!tData) {
        toast.error("Revenda não encontrada");
        navigate({ to: "/admin/tenants" });
        return;
      }

      setTenant(tData as unknown as TenantDetail);

      // Fetch stats for this specific tenant
      const [
        { count: totalCust },
        { count: activeCust },
        { data: pays },
        { count: notifs }
      ] = await Promise.all([
        supabase.from("customers").select("*", { count: "exact", head: true }).eq("tenant_id", id),
        supabase.from("customers").select("*", { count: "exact", head: true }).eq("tenant_id", id).eq("status", "active"),
        supabase.from("payments").select("amount").eq("tenant_id", id),
        supabase.from("notifications").select("*", { count: "exact", head: true }).eq("tenant_id", id)
      ]);

      const totalRevenue = (pays || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      setStats({
        total_customers: totalCust || 0,
        active_customers: activeCust || 0,
        total_payments: totalRevenue,
        total_notifications: notifs || 0
      });

    } catch (err) {
      console.error("Error fetching tenant detail:", err);
      toast.error("Erro ao carregar detalhes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const toggleStatus = async () => {
    if (!tenant) return;
    const newStatus = !tenant.active;
    const { error } = await supabase
      .from("tenants")
      .update({ active: newStatus })
      .eq("id", tenant.id);

    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }

    toast.success(`Revenda ${newStatus ? "reativada" : "suspensa"}`);
    fetchData();
  };

  if (loading) return (
    <div className="flex justify-center p-20">
      <LoadingSpinner label="Carregando detalhes da revenda..." />
    </div>
  );

  if (!tenant) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header / Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link to="/admin/tenants" className="text-gray-500 hover:text-white flex items-center gap-1 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Voltar para Revendas
        </Link>
      </div>

      {/* Hero Card */}
      <div className="bg-[#1A1D27] rounded-xl border border-white/5 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#1D9E75] to-[#1D9E75]/40 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-[#1D9E75]/10 shrink-0">
              {tenant.company_name.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold text-white tracking-tight">{tenant.company_name}</h1>
                {tenant.active ? (
                  <span className="bg-[#1D9E75]/10 text-[#1D9E75] text-[10px] font-bold uppercase px-2 py-0.5 rounded border border-[#1D9E75]/20">Ativa</span>
                ) : (
                  <span className="bg-red-500/10 text-red-500 text-[10px] font-bold uppercase px-2 py-0.5 rounded border border-red-500/20">Suspensa</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-400">
                <span className="flex items-center gap-1.5"><Building2 className="h-4 w-4" /> {tenant.email}</span>
                <span className="flex items-center gap-1.5"><MessageCircle className="h-4 w-4" /> {tenant.whatsapp || "N/A"}</span>
                <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Membro desde {format(parseISO(tenant.created_at), "dd/MM/yyyy")}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 md:self-center">
            <Button variant="outline" className="bg-transparent border-white/10 hover:bg-white/5 text-gray-300">
              <RefreshCw className="mr-2 h-4 w-4" />
              Mudar plano
            </Button>
            <Button 
              variant="outline" 
              className={cn(
                "bg-transparent border-white/10 text-gray-300",
                tenant.active ? "hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20" : "hover:bg-[#1D9E75]/10 hover:text-[#1D9E75] hover:border-[#1D9E75]/20"
              )}
              onClick={toggleStatus}
            >
              {tenant.active ? <><Pause className="mr-2 h-4 w-4" /> Suspender</> : <><Play className="mr-2 h-4 w-4" /> Reativar</>}
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <LogOut className="mr-2 h-4 w-4" />
              Logar como revenda
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/5">
          <QuickStat label="Plano Atual" value={tenant.plan.toUpperCase()} subValue={tenant.plan_expires_at ? `Expira em ${format(parseISO(tenant.plan_expires_at), "dd/MM/yyyy")}` : "Vitalício"} />
          <QuickStat label="Clientes" value={`${stats?.total_customers || 0} / ${tenant.max_customers || "∞"}`} subValue={`${stats?.active_customers || 0} ativos`} />
          <QuickStat label="Receita SaaS" value={stats?.total_payments.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00"} subValue="Total acumulado" />
          <QuickStat label="Notificações" value={stats?.total_notifications.toLocaleString() || "0"} subValue="Enviadas com sucesso" />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-[#1A1D27] border border-white/5 p-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-[#0F1117] data-[state=active]:text-white">Visão Geral</TabsTrigger>
          <TabsTrigger value="customers" className="data-[state=active]:bg-[#0F1117] data-[state=active]:text-white">Clientes</TabsTrigger>
          <TabsTrigger value="payments" className="data-[state=active]:bg-[#0F1117] data-[state=active]:text-white">Pagamentos</TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-[#0F1117] data-[state=active]:text-white">Notificações</TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-[#0F1117] data-[state=active]:text-white">Logs Admin</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Integations Card */}
            <div className="bg-[#1A1D27] rounded-xl border border-white/5 p-6 flex flex-col h-full">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5 text-[#1D9E75]" />
                Integrações
              </h3>
              <div className="space-y-4 flex-1">
                <IntegrationItem label="Asaas" status={true} desc="Configurado via API Key" />
                <IntegrationItem label="WhatsApp" status={!!tenant.whatsapp} desc={tenant.whatsapp ? "Instância conectada" : "Desconectado"} />
                <IntegrationItem label="Evolution API" status={true} desc="https://api.evolution.com/..." />
              </div>
            </div>

            {/* Plan Card */}
            <div className="bg-[#1A1D27] rounded-xl border border-white/5 p-6 flex flex-col h-full">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[#1D9E75]" />
                Plano e Limites
              </h3>
              <div className="space-y-6 flex-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Uso de clientes</span>
                  <span className="text-sm font-bold text-white">{stats?.total_customers || 0} / {tenant.max_customers || "∞"}</span>
                </div>
                <div className="w-full h-2 bg-black/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#1D9E75] rounded-full" 
                    style={{ width: `${tenant.max_customers ? Math.min(((stats?.total_customers || 0) / tenant.max_customers) * 100, 100) : 100}%` }}
                  />
                </div>
                <div className="p-4 rounded-lg bg-black/20 border border-white/5 text-xs text-gray-400">
                  <p>O limite de clientes determina quantos assinantes a revenda pode gerenciar simultaneamente no sistema.</p>
                </div>
              </div>
            </div>

            {/* Notification Config */}
            <div className="bg-[#1A1D27] rounded-xl border border-white/5 p-6 flex flex-col h-full">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-[#1D9E75]" />
                Config. Notificações
              </h3>
              <div className="space-y-4 flex-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Horário de envio:</span>
                  <span className="text-white font-medium">09:00</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Dias habilitados:</span>
                  <span className="text-white font-medium">D-3, D-1, D-0, D+1</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Status automático:</span>
                  <span className="text-[#1D9E75] font-bold">Ativado</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="customers">
          <div className="bg-[#1A1D27] rounded-xl border border-white/5 p-8 text-center text-gray-500">
            <Users className="h-10 w-10 mx-auto mb-4 opacity-20" />
            <p>Lista de clientes da revenda em desenvolvimento.</p>
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <div className="bg-[#1A1D27] rounded-xl border border-white/5 p-8 text-center text-gray-500">
            <CreditCard className="h-10 w-10 mx-auto mb-4 opacity-20" />
            <p>Histórico de faturamento em desenvolvimento.</p>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="bg-[#1A1D27] rounded-xl border border-white/5 p-8 text-center text-gray-500">
            <Smartphone className="h-10 w-10 mx-auto mb-4 opacity-20" />
            <p>Relatório de disparos em desenvolvimento.</p>
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <div className="bg-[#1A1D27] rounded-xl border border-white/5 p-8 text-center text-gray-500">
            <Info className="h-10 w-10 mx-auto mb-4 opacity-20" />
            <p>Logs de auditoria em desenvolvimento.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QuickStat({ label, value, subValue }: any) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{label}</span>
      <span className="text-lg font-bold text-white mt-1">{value}</span>
      <span className="text-[11px] text-gray-500 mt-0.5">{subValue}</span>
    </div>
  );
}

function IntegrationItem({ label, status, desc }: any) {
  return (
    <div className="flex items-center gap-3">
      {status ? (
        <CheckCircle2 className="h-4 w-4 text-[#1D9E75]" />
      ) : (
        <AlertCircle className="h-4 w-4 text-gray-600" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-[10px] text-gray-500 truncate">{desc}</p>
      </div>
    </div>
  );
}
