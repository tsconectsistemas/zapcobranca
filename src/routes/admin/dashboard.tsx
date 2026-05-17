import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, 
  Building2, 
  CreditCard, 
  TrendingUp, 
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboard,
});

interface AdminMetrics {
  total_tenants: number;
  active_tenants: number;
  suspended_tenants: number;
  tenants_by_plan: Record<string, number>;
  total_customers: number;
  active_customers: number;
  total_payments_this_month: number;
  total_payments_last_month: number;
  total_notifications_today: number;
  notifications_success_rate: number;
  new_tenants_this_month: number;
  new_tenants_last_month: number;
  mrr: number;
}

function AdminDashboard() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const { data, error } = await supabase.rpc("get_admin_metrics");
        if (error) throw error;
        setMetrics(data as unknown as AdminMetrics);
      } catch (err) {
        console.error("Error fetching metrics:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchMetrics();
  }, []);

  if (loading) return <LoadingSpinner label="Carregando métricas globais..." />;
  if (!metrics) return <div className="text-red-500">Erro ao carregar métricas.</div>;

  const mrrGrowth = metrics.new_tenants_this_month > metrics.new_tenants_last_month;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard Global</h1>
        <p className="text-gray-400">Visão geral do ecossistema ZapCobrança.</p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="MRR" 
          value={metrics.mrr.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} 
          icon={TrendingUp}
          trend={`${metrics.active_tenants} revendas pagas`}
        />
        <StatCard 
          title="Revendas Totais" 
          value={metrics.total_tenants} 
          icon={Building2}
          trend={metrics.new_tenants_this_month > 0 ? `+${metrics.new_tenants_this_month} este mês` : "Sem novos este mês"}
          trendUp={mrrGrowth}
        />
        <StatCard 
          title="Clientes IPTV" 
          value={metrics.total_customers} 
          icon={Users}
          trend={`${metrics.active_customers} ativos`}
        />
        <StatCard 
          title="Sucesso Notificações" 
          value={`${metrics.notifications_success_rate}%`} 
          icon={CheckCircle2}
          trend={`${metrics.total_notifications_today} enviadas hoje`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição de Planos */}
        <div className="bg-[#1A1D27] rounded-xl border border-white/5 p-6">
          <h3 className="text-lg font-bold text-white mb-6">Distribuição de Planos</h3>
          <div className="space-y-4">
            {Object.entries(metrics.tenants_by_plan || {}).map(([plan, count]) => (
              <div key={plan} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="capitalize text-gray-400">{plan}</span>
                  <span className="text-white font-medium">{count} revendas</span>
                </div>
                <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#1D9E75] rounded-full" 
                    style={{ width: `${(count / metrics.total_tenants) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Faturamento */}
        <div className="bg-[#1A1D27] rounded-xl border border-white/5 p-6">
          <h3 className="text-lg font-bold text-white mb-6">Volume de Pagamentos</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-black/20 border border-white/5">
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Este Mês</p>
              <p className="text-xl font-bold text-white mt-1">
                {metrics.total_payments_this_month.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-black/20 border border-white/5">
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Mês Passado</p>
              <p className="text-xl font-bold text-white mt-1">
                {metrics.total_payments_last_month.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          </div>
          <div className="mt-6 p-4 rounded-lg bg-[#1D9E75]/5 border border-[#1D9E75]/20 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-[#1D9E75]" />
            <p className="text-sm text-gray-300">
              O volume total inclui pagamentos de clientes finais para as revendas processados via ZapCobrança.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, trendUp }: any) {
  return (
    <div className="bg-[#1A1D27] rounded-xl border border-white/5 p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 rounded-lg bg-[#1D9E75]/10 border border-[#1D9E75]/20">
          <Icon className="h-5 w-5 text-[#1D9E75]" />
        </div>
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
        <div className="mt-2 flex items-center gap-1">
          {trendUp !== undefined && (
            trendUp ? <ArrowUpRight className="h-3 w-3 text-[#1D9E75]" /> : <ArrowDownRight className="h-3 w-3 text-red-500" />
          )}
          <span className="text-xs text-gray-500">{trend}</span>
        </div>
      </div>
    </div>
  );
}
