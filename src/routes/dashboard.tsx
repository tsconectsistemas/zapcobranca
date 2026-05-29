import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users,
  Clock,
  AlertCircle,
  DollarSign,
  CalendarClock,
  CheckCircle2,
  MessageCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Bell,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PrivateRoute } from "@/components/PrivateRoute";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Início — ZapCobrança" },
      {
        name: "description",
        content: "Painel com métricas das suas cobranças e clientes IPTV.",
      },
    ],
  }),
  component: DashboardPage,
});

interface Metrics {
  total_customers: number;
  active_customers: number;
  expiring_today: number;
  expiring_3days: number;
  overdue_customers: number;
  revenue_this_month: number;
  revenue_last_month: number;
  payments_today: number;
  notifications_today: number;
}

interface TimelinePoint {
  expiration_date: string;
  count: number;
}

interface ExpiringCustomer {
  id: string;
  name: string | null;
  username: string;
  whatsapp: string | null;
}

interface RecentPayment {
  id: string;
  amount: number | null;
  paid_at: string | null;
  customer_id: string;
  customer_name: string | null;
}

interface ActivityItem {
  id: string;
  kind: "payment" | "notification";
  label: string;
  detail: string;
  at: string;
}

const EMPTY_METRICS: Metrics = {
  total_customers: 0,
  active_customers: 0,
  expiring_today: 0,
  expiring_3days: 0,
  overdue_customers: 0,
  revenue_this_month: 0,
  revenue_last_month: 0,
  payments_today: 0,
  notifications_today: 0,
};

function greeting(date: Date) {
  const h = date.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function DashboardPage() {
  return (
    <PrivateRoute>
      <AppShell title="Início">
        <DashboardContent />
      </AppShell>
    </PrivateRoute>
  );
}

function DashboardContent() {
  const { tenant } = useAuth();
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [expiringList, setExpiringList] = useState<ExpiringCustomer[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [waStatus, setWaStatus] = useState<{
    status: string | null;
    instance: string | null;
  }>({ status: null, instance: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [now, setNow] = useState<Date>(new Date());

  const loadAll = useCallback(async () => {
    if (!tenant) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = supabase.rpc.bind(supabase) as any;
    const [
      metricsRes,
      timelineRes,
      expiringRes,
      paymentsRes,
      notifRes,
      waRes,
    ] = await Promise.all([
      rpc("get_dashboard_metrics") as Promise<{ data: Metrics | null }>,
      rpc("get_expiration_timeline") as Promise<{
        data: TimelinePoint[] | null;
      }>,
      supabase
        .from("customers")
        .select("id, name, username, whatsapp, expiration_date")
        .eq("tenant_id", tenant.id)
        .eq("status", "active")
        .eq("expiration_date", new Date().toISOString().slice(0, 10))
        .limit(5),
      supabase
        .from("payments")
        .select("id, amount, paid_at, customer_id, customers(name, username)")
        .eq("tenant_id", tenant.id)
        .not("paid_at", "is", null)
        .order("paid_at", { ascending: false })
        .limit(5),
      supabase
        .from("notifications")
        .select(
          "id, type, sent_at, success, customer_id, customers(name, username)"
        )
        .eq("tenant_id", tenant.id)
        .order("sent_at", { ascending: false })
        .limit(10),
      supabase
        .from("whatsapp_sessions")
        .select("status, instance_name")
        .eq("tenant_id", tenant.id)
        .maybeSingle(),
    ]);

    if (metricsRes.data) {
      setMetrics({ ...EMPTY_METRICS, ...(metricsRes.data as Metrics) });
    }
    if (timelineRes.data) {
      setTimeline(timelineRes.data as TimelinePoint[]);
    }
    if (expiringRes.data) {
      setExpiringList(
        expiringRes.data.map((c) => ({
          id: c.id,
          name: c.name,
          username: c.username,
          whatsapp: c.whatsapp,
        }))
      );
    }
    const payments = (paymentsRes.data ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => ({
        id: p.id,
        amount: p.amount,
        paid_at: p.paid_at,
        customer_id: p.customer_id,
        customer_name: p.customers?.name ?? p.customers?.username ?? "Cliente",
      })
    ) as RecentPayment[];
    setRecentPayments(payments);

    // Build activity timeline
    const acts: ActivityItem[] = [];
    payments.forEach((p) => {
      if (!p.paid_at) return;
      acts.push({
        id: `pay-${p.id}`,
        kind: "payment",
        label: `Pagamento de ${p.customer_name}`,
        detail: formatBRL(Number(p.amount ?? 0)),
        at: p.paid_at,
      });
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (notifRes.data ?? []).forEach((n: any) => {
      if (!n.sent_at) return;
      const name = n.customers?.name ?? n.customers?.username ?? "Cliente";
      const typeLabel =
        n.type === "d3"
          ? "Lembrete D-3"
          : n.type === "d1"
            ? "Lembrete D-1"
            : n.type === "d0"
              ? "Vence hoje"
              : n.type === "manual"
                ? "Mensagem manual"
                : n.type === "confirmed"
                  ? "Confirmação"
                  : "Notificação";
      acts.push({
        id: `notif-${n.id}`,
        kind: "notification",
        label: `${typeLabel} → ${name}`,
        detail: n.success ? "Enviada" : "Falhou",
        at: n.sent_at,
      });
    });
    acts.sort((a, b) => (a.at < b.at ? 1 : -1));
    setActivity(acts.slice(0, 10));

    if (waRes.data) {
      setWaStatus({
        status: waRes.data.status,
        instance: waRes.data.instance_name,
      });
    } else {
      setWaStatus({ status: null, instance: null });
    }

    setUpdatedAt(new Date());
  }, [tenant]);

  // Initial load
  useEffect(() => {
    if (!tenant) return;
    setLoading(true);
    loadAll().finally(() => setLoading(false));
  }, [tenant, loadAll]);

  // Auto refresh every 60s
  useEffect(() => {
    if (!tenant) return;
    const id = setInterval(() => {
      loadAll();
    }, 60_000);
    return () => clearInterval(id);
  }, [tenant, loadAll]);

  // Tick clock every minute for "Atualizado às"
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Realtime on payments
  useEffect(() => {
    if (!tenant) return;
    const channel = supabase
      .channel(`dashboard-payments-${tenant.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "payments",
          filter: `tenant_id=eq.${tenant.id}`,
        },
        () => {
          loadAll();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant, loadAll]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const revenueDelta = useMemo(() => {
    const cur = metrics.revenue_this_month;
    const prev = metrics.revenue_last_month;
    if (prev === 0 && cur === 0) return { dir: "equal" as const, pct: 0 };
    if (prev === 0) return { dir: "up" as const, pct: 100 };
    const pct = ((cur - prev) / prev) * 100;
    if (Math.abs(pct) < 0.5) return { dir: "equal" as const, pct: 0 };
    return { dir: pct > 0 ? "up" : "down", pct: Math.abs(pct) } as const;
  }, [metrics]);

  const todayLabel = useMemo(() => {
    return format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }).replace(
      /^./,
      (c) => c.toUpperCase()
    );
  }, [now]);

  const greetingLabel = greeting(now);
  const companyName = tenant?.company_name ?? "revendedor";

  // Build a 30-day timeline series with zeros for missing days
  const timelineSeries = useMemo(() => {
    const map = new Map(timeline.map((t) => [t.expiration_date, t.count]));
    const out: Array<{
      date: string;
      label: string;
      count: number;
      daysAhead: number;
    }> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i <= 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      out.push({
        date: iso,
        label: format(d, "dd/MM"),
        count: Number(map.get(iso) ?? 0),
        daysAhead: i,
      });
    }
    return out;
  }, [timeline]);

  function barColor(daysAhead: number) {
    if (daysAhead === 0) return "hsl(0 84% 60%)";
    if (daysAhead === 1) return "hsl(25 95% 55%)";
    if (daysAhead <= 3) return "hsl(45 95% 55%)";
    return "hsl(142 70% 45%)";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        Carregando painel...
      </div>
    );
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            {greetingLabel}, {companyName}! 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aqui está o resumo da sua revenda hoje
          </p>
          <p className="mt-1 text-xs text-muted-foreground/80">{todayLabel}</p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")}
            />
            Atualizar
          </Button>
          {updatedAt && (
            <span className="text-[11px] text-muted-foreground">
              Atualizado às {format(updatedAt, "HH:mm")}
            </span>
          )}
        </div>
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          to="/clientes"
          search={{ filter: "active" }}
          icon={Users}
          tone="success"
          label="Clientes ativos"
          value={metrics.active_customers.toString()}
          subtitle={`de ${metrics.total_customers} cadastrados`}
        />
        <MetricCard
          to="/clientes"
          search={{ filter: "expiring_today" }}
          icon={Clock}
          tone="warning"
          label="Vencendo hoje"
          value={metrics.expiring_today.toString()}
          subtitle="precisam renovar hoje"
          pulse={metrics.expiring_today > 0}
        />
        <MetricCard
          to="/clientes"
          search={{ filter: "overdue" }}
          icon={AlertCircle}
          tone="destructive"
          label="Inadimplentes"
          value={metrics.overdue_customers.toString()}
          subtitle="com assinatura vencida"
          pulse={metrics.overdue_customers > 0}
        />
        <RevenueCard
          value={metrics.revenue_this_month}
          delta={revenueDelta}
        />
      </div>

      {/* Row 2 */}
      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border p-5 flex flex-col">
          <CardTop
            icon={CalendarClock}
            tone="warning"
            label="Vencendo em 3 dias"
            value={metrics.expiring_3days.toString()}
            subtitle="clientes para notificar"
          />
          <div className="mt-3">
            <Link
              to="/cobrancas"
              className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 hover:opacity-90 transition"
            >
              Enviar lembrete
            </Link>
          </div>
        </div>

        <MetricCard
          icon={CheckCircle2}
          tone="success"
          label="Pagamentos hoje"
          value={metrics.payments_today.toString()}
          subtitle="pagamentos confirmados"
        />
        <MetricCard
          icon={Bell}
          tone="info"
          label="Notificações enviadas"
          value={metrics.notifications_today.toString()}
          subtitle="mensagens enviadas hoje"
        />
        <Link
          to="/whatsapp"
          className="bg-card rounded-xl border p-5 hover:border-primary/40 transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">WhatsApp</p>
              <p
                className={cn(
                  "mt-2 text-2xl font-semibold tracking-tight",
                  waStatus.status === "connected"
                    ? "text-emerald-600"
                    : "text-red-600"
                )}
              >
                {waStatus.status === "connected"
                  ? "Conectado"
                  : "Desconectado"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground truncate">
                {waStatus.instance ?? "Clique para conectar"}
              </p>
            </div>
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                waStatus.status === "connected"
                  ? "bg-emerald-500/15 text-emerald-600"
                  : "bg-red-500/10 text-red-600"
              )}
            >
              <MessageCircle className="h-5 w-5" />
            </div>
          </div>
        </Link>
      </div>

      {/* Chart */}
      <div className="mt-6 bg-card rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Vencimentos nos próximos 30 dias
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Distribuição diária de clientes ativos a vencer
            </p>
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timelineSeries}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  fontSize: 12,
                }}
                formatter={(value: number) => [
                  `${value} cliente${value === 1 ? "" : "s"}`,
                  "Vencem",
                ]}
                labelFormatter={(label: string, payload) => {
                  const item = payload?.[0]?.payload as
                    | { date: string }
                    | undefined;
                  if (!item) return label;
                  return format(parseISO(item.date), "EEEE, dd/MM/yyyy", {
                    locale: ptBR,
                  });
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {timelineSeries.map((entry) => (
                  <Cell
                    key={entry.date}
                    fill={barColor(entry.daysAhead)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick action cards */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {metrics.expiring_today > 0 && (
          <div className="bg-card rounded-xl border p-5">
            <h4 className="text-sm font-semibold text-foreground mb-3">
              Clientes vencendo hoje
            </h4>
            <ul className="space-y-2">
              {expiringList.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate text-foreground">
                    {c.name ?? c.username}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {c.whatsapp ?? "—"}
                  </span>
                </li>
              ))}
              {expiringList.length === 0 && (
                <li className="text-xs text-muted-foreground">
                  Nenhum cliente listado.
                </li>
              )}
            </ul>
            <Link
              to="/cobrancas"
              className="mt-4 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 hover:opacity-90 transition"
            >
              Enviar cobrança em lote
            </Link>
          </div>
        )}

        <div className="bg-card rounded-xl border p-5">
          <h4 className="text-sm font-semibold text-foreground mb-3">
            Últimos pagamentos
          </h4>
          <ul className="space-y-2">
            {recentPayments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="truncate text-foreground">
                  {p.customer_name}
                </span>
                <span className="text-xs text-muted-foreground shrink-0 flex flex-col items-end">
                  <span className="text-emerald-600 font-medium">
                    {formatBRL(Number(p.amount ?? 0))}
                  </span>
                  {p.paid_at && (
                    <span>
                      {formatDistanceToNow(parseISO(p.paid_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  )}
                </span>
              </li>
            ))}
            {recentPayments.length === 0 && (
              <li className="text-xs text-muted-foreground">
                Nenhum pagamento ainda.
              </li>
            )}
          </ul>
          <Link
            to="/cobrancas"
            className="mt-4 inline-flex items-center justify-center rounded-md border text-xs font-medium px-3 py-1.5 hover:bg-muted transition"
          >
            Ver todos
          </Link>
        </div>

        <div className="bg-card rounded-xl border p-5">
          <h4 className="text-sm font-semibold text-foreground mb-3">
            Atividade recente
          </h4>
          <ul className="space-y-3">
            {activity.map((a) => {
              const Icon =
                a.kind === "payment" ? CheckCircle2 : MessageCircle;
              return (
                <li key={a.id} className="flex items-start gap-2 text-sm">
                  <Icon
                    className={cn(
                      "h-4 w-4 mt-0.5 shrink-0",
                      a.kind === "payment"
                        ? "text-emerald-600"
                        : "text-blue-600"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate">{a.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.detail} ·{" "}
                      {formatDistanceToNow(parseISO(a.at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                </li>
              );
            })}
            {activity.length === 0 && (
              <li className="text-xs text-muted-foreground">
                Sem atividade recente.
              </li>
            )}
          </ul>
        </div>
      </div>
    </>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  tone: "success" | "warning" | "destructive" | "info";
  to?: "/clientes" | "/cobrancas" | "/whatsapp";
  search?: Record<string, string>;
  pulse?: boolean;
}

const TONE_STYLES: Record<MetricCardProps["tone"], string> = {
  success: "bg-emerald-500/15 text-emerald-600",
  warning: "bg-orange-500/15 text-orange-600",
  destructive: "bg-red-500/10 text-red-600",
  info: "bg-blue-500/15 text-blue-600",
};

function CardTop({
  icon: Icon,
  tone,
  label,
  value,
  subtitle,
  pulse,
}: Omit<MetricCardProps, "to" | "search">) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          {pulse && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
          )}
        </div>
        <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
          {value}
        </p>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          TONE_STYLES[tone]
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function MetricCard(props: MetricCardProps) {
  const { to, search, ...rest } = props;
  const inner = <CardTop {...rest} />;
  if (to) {
    return (
      <Link
        to={to}
        search={search as never}
        className="bg-card rounded-xl border p-5 hover:border-primary/40 transition-colors"
      >
        {inner}
      </Link>
    );
  }
  return <div className="bg-card rounded-xl border p-5">{inner}</div>;
}

function RevenueCard({
  value,
  delta,
}: {
  value: number;
  delta: { dir: "up" | "down" | "equal"; pct: number };
}) {
  const Icon =
    delta.dir === "up" ? TrendingUp : delta.dir === "down" ? TrendingDown : Minus;
  const color =
    delta.dir === "up"
      ? "text-emerald-600"
      : delta.dir === "down"
        ? "text-red-600"
        : "text-muted-foreground";
  const text =
    delta.dir === "equal"
      ? "Igual ao mês anterior"
      : `${delta.pct.toFixed(1)}% em relação ao mês anterior`;
  return (
    <div className="bg-card rounded-xl border p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Receita do mês</p>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            {formatBRL(value)}
          </p>
          <p
            className={cn(
              "mt-1 text-xs flex items-center gap-1 truncate",
              color
            )}
          >
            <Icon className="h-3 w-3 shrink-0" />
            <span className="truncate">{text}</span>
          </p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
          <DollarSign className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
