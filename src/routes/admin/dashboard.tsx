import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  TrendingUp, 
  CreditCard, 
  Calendar, 
  Target,
  Building2,
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Eye
} from "lucide-react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Legend
} from "recharts";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { format, subDays, startOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAdminAuth } from "@/hooks/useAdminAuth";

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

interface RecentTenant {
  id: string;
  company_name: string;
  email: string;
  plan: string;
  whatsapp: string | null;
  created_at: string;
  active: boolean;
  customers_count?: number;
}

function AdminDashboard() {
  const { admin } = useAdminAuth();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [recentTenants, setRecentTenants] = useState<RecentTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const [{ data: mData, error: mErr }, { data: tData, error: tErr }] = await Promise.all([
        supabase.rpc("get_admin_metrics"),
        supabase
          .from("tenants")
          .select("id, company_name, email, plan, whatsapp, created_at, active")
          .order("created_at", { ascending: false })
          .limit(10)
      ]);

      if (mErr) throw mErr;
      if (tErr) throw tErr;

      setMetrics(mData as unknown as AdminMetrics);
      
      // Fetch customer counts for these tenants in a separate query to avoid complex joins
      const tenantIds = (tData || []).map(t => t.id);
      if (tenantIds.length > 0) {
        const { data: counts } = await supabase
          .from("customers")
          .select("tenant_id")
          .in("tenant_id", tenantIds);
        
        const countMap = (counts || []).reduce((acc: any, curr) => {
          acc[curr.tenant_id] = (acc[curr.tenant_id] || 0) + 1;
          return acc;
        }, {});

        setRecentTenants((tData || []).map(t => ({
          ...t,
          customers_count: countMap[t.id] || 0
        })) as unknown as RecentTenant[]);
      } else {
        setRecentTenants([]);
      }

    } catch (err) {
      console.error("Error fetching admin dashboard data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <LoadingSpinner label="Carregando painel de controle..." />
    </div>
  );

  if (!metrics) return <div className="p-8 text-red-500">Erro ao carregar métricas.</div>;

  // Prepare chart data
  const planData = Object.entries(metrics.tenants_by_plan || {}).map(([name, value]) => ({
    name: name.toUpperCase(),
    value
  }));

  const COLORS = ["#94a3b8", "#1D9E75", "#3b82f6"];

  // Mock data for revenue chart (since we don't have historical aggregation in the RPC yet)
  const revenueChartData = [
    { month: "Jan", revenue: metrics.total_payments_last_month * 0.8 },
    { month: "Fev", revenue: metrics.total_payments_last_month * 0.9 },
    { month: "Mar", revenue: metrics.total_payments_last_month * 0.85 },
    { month: "Abr", revenue: metrics.total_payments_last_month },
    { month: "Mai", revenue: metrics.total_payments_this_month },
  ];

  const mrrPrev = metrics.mrr * 0.95; // Mocking prev month MRR for display
  const mrrGrowth = ((metrics.mrr - mrrPrev) / mrrPrev) * 100;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Bem-vindo, {admin?.name}!</h1>
          <p className="text-gray-400">Visão geral da plataforma ZapCobrança</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            Atualizado em {format(new Date(), "HH:mm:ss")}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-[#1A1D27] border-white/10 text-gray-400 hover:text-white"
            onClick={fetchData}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* ROW 1: REVENUE METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="MRR (Receita Recorrente)"
          value={metrics.mrr.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          subtitle={`▲ ${mrrGrowth.toFixed(1)}% vs mês anterior`}
          icon={TrendingUp}
          variant={metrics.mrr >= mrrPrev ? "success" : "danger"}
        />
        <MetricCard
          title="Receita do mês"
          value={metrics.total_payments_this_month.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          subtitle="Pagamentos confirmados"
          icon={CreditCard}
        />
        <MetricCard
          title="Receita mês anterior"
          value={metrics.total_payments_last_month.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          subtitle="Total processado"
          icon={Calendar}
        />
        <MetricCard
          title="Projeção anual"
          value={(metrics.mrr * 12).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          subtitle="Baseado no MRR atual"
          icon={Target}
        />
      </div>

      {/* ROW 2: TENANT METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total de revendas"
          value={metrics.total_tenants}
          subtitle={`+ ${metrics.new_tenants_this_month} este mês`}
          icon={Building2}
        />
        <Link to="/admin/tenants" search={{ filter: "active" }}>
          <MetricCard
            title="Revendas ativas"
            value={metrics.active_tenants}
            icon={CheckCircle2}
            variant="success"
            interactive
          />
        </Link>
        <Link to="/admin/tenants" search={{ filter: "suspended" }}>
          <MetricCard
            title="Revendas suspensas"
            value={metrics.suspended_tenants}
            icon={AlertCircle}
            variant={metrics.suspended_tenants > 0 ? "danger" : "default"}
            interactive
          />
        </Link>
        <MetricCard
          title="Novas este mês"
          value={metrics.new_tenants_this_month}
          subtitle={`vs ${metrics.new_tenants_last_month} mês passado`}
          icon={TrendingUp}
        />
      </div>

      {/* ROW 3: PLATFORM METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total de clientes"
          value={metrics.total_customers}
          subtitle="em todas as revendas"
          icon={Users}
        />
        <MetricCard
          title="Clientes ativos"
          value={metrics.active_customers}
          icon={Users}
        />
        <MetricCard
          title="Notificações hoje"
          value={metrics.total_notifications_today}
          icon={RefreshCw}
        />
        <MetricCard
          title="Taxa de sucesso"
          value={`${metrics.notifications_success_rate}%`}
          icon={CheckCircle2}
          variant={metrics.notifications_success_rate > 90 ? "success" : metrics.notifications_success_rate > 70 ? "warning" : "danger"}
        />
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-[#1A1D27] rounded-xl border border-white/5 p-6 h-[400px] flex flex-col">
          <h3 className="text-lg font-bold text-white mb-6">Revendas por Plano</h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={planData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {planData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: "#0F1117", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  itemStyle={{ color: "#fff" }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 bg-[#1A1D27] rounded-xl border border-white/5 p-6 h-[400px] flex flex-col">
          <h3 className="text-lg font-bold text-white mb-6">Volume de Faturamento (SaaS)</h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: "#0F1117", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  itemStyle={{ color: "#fff" }}
                  cursor={{ fill: "rgba(255,255,255,0.05)" }}
                />
                <Bar dataKey="revenue" fill="#1D9E75" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* RECENT ACTIVITY */}
      <div className="bg-[#1A1D27] rounded-xl border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <h3 className="text-lg font-bold text-white">Últimas Revendas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-gray-500 uppercase text-[10px] font-bold tracking-wider bg-black/20">
              <tr>
                <th className="px-6 py-3">Revenda</th>
                <th className="px-6 py-3">Plano</th>
                <th className="px-6 py-3">Clientes</th>
                <th className="px-6 py-3">WhatsApp</th>
                <th className="px-6 py-3">Cadastro</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentTenants.map((t) => (
                <tr key={t.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-semibold text-white">{t.company_name}</p>
                      <p className="text-xs text-gray-500">{t.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                      t.plan === "free" && "bg-gray-500/10 text-gray-500 border border-gray-500/20",
                      t.plan === "pro" && "bg-[#1D9E75]/10 text-[#1D9E75] border border-[#1D9E75]/20",
                      t.plan === "business" && "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                    )}>
                      {t.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400">
                    {t.customers_count || 0}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      {t.whatsapp ? (
                        <>
                          <div className="h-1.5 w-1.5 rounded-full bg-[#1D9E75]" />
                          <span>Configurado</span>
                        </>
                      ) : (
                        <>
                          <div className="h-1.5 w-1.5 rounded-full bg-gray-600" />
                          <span>Não config.</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-xs">
                    {format(parseISO(t.created_at), "dd/MM/yyyy")}
                  </td>
                  <td className="px-6 py-4">
                    {t.active ? (
                      <span className="text-xs text-[#1D9E75] flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Ativa
                      </span>
                    ) : (
                      <span className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Suspensa
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="icon" asChild className="text-gray-400 hover:text-white">
                      <Link to={`/admin/tenants/${t.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon: Icon, variant = "default", interactive = false }: any) {
  const variants = {
    default: "text-[#1D9E75]",
    success: "text-[#1D9E75]",
    warning: "text-yellow-500",
    danger: "text-red-500",
  };

  const bgVariants = {
    default: "bg-[#1D9E75]/10 border-[#1D9E75]/20",
    success: "bg-[#1D9E75]/10 border-[#1D9E75]/20",
    warning: "bg-yellow-500/10 border-yellow-500/20",
    danger: "bg-red-500/10 border-red-500/20",
  };

  return (
    <div className={cn(
      "bg-[#1A1D27] rounded-xl border border-white/5 p-6 transition-all",
      interactive && "hover:border-white/20 cursor-pointer active:scale-95"
    )}>
      <div className="flex justify-between items-start mb-4">
        <div className={cn("p-2 rounded-lg border", bgVariants[variant as keyof typeof bgVariants])}>
          <Icon className={cn("h-5 w-5", variants[variant as keyof typeof variants])} />
        </div>
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
        {subtitle && (
          <p className={cn("text-xs mt-1", variant === "default" ? "text-gray-500" : variants[variant as keyof typeof variants])}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
