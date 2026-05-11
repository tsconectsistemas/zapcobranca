import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { DollarSign, Bell, Play, Eye } from "lucide-react";
import { toast } from "sonner";
import { PrivateRoute } from "@/components/PrivateRoute";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { triggerNotificationsNow, retryNotification } from "@/lib/notifications.functions";

export const Route = createFileRoute("/cobrancas")({
  head: () => ({ meta: [{ title: "Cobranças — ZapCobrança" }] }),
  component: CobrancasPage,
});

interface PaymentRow {
  id: string;
  amount: number | null;
  paid_at: string | null;
  previous_expiration: string | null;
  new_expiration: string | null;
  customer_id: string;
  customers: { id: string; name: string | null; username: string } | null;
}

interface NotificationRow {
  id: string;
  type: string;
  message: string | null;
  whatsapp_number: string | null;
  sent_at: string | null;
  success: boolean | null;
  error_message: string | null;
  customer_id: string;
  customers: { id: string; name: string | null; username: string } | null;
}

interface QueueRow {
  id: string;
  type: string;
  message: string;
  whatsapp_number: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  next_attempt_at: string | null;
  created_at: string;
  sent_at: string | null;
  error_message: string | null;
  customer_id: string;
  customers: { id: string; name: string | null; username: string } | null;
}

function formatCurrency(v: number | null): string {
  return (v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function NotifTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    "D-3": {
      label: "D-3",
      cls: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
    },
    "D-1": {
      label: "D-1",
      cls: "bg-orange-100 text-orange-800 hover:bg-orange-100",
    },
    "D-0": { label: "D-0", cls: "bg-red-100 text-red-800 hover:bg-red-100" },
    confirmation: {
      label: "✅ Confirmação",
      cls: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
    },
    manual: {
      label: "Manual",
      cls: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    },
  };
  const m = map[type] || {
    label: type,
    cls: "bg-muted text-muted-foreground",
  };
  return <Badge className={m.cls}>{m.label}</Badge>;
}

function CobrancasPage() {
  const { tenant } = useAuth();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [notifs, setNotifs] = useState<NotificationRow[]>([]);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("notifications");
  const [queueFilter, setQueueFilter] = useState<string>("all");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  async function loadAll() {
    if (!tenant) return;
    setLoading(true);
    const [pRes, nRes, qRes] = await Promise.all([
      supabase
        .from("payments")
        .select(
          "id, amount, paid_at, previous_expiration, new_expiration, customer_id, customers(id, name, username)",
        )
        .eq("tenant_id", tenant.id)
        .order("paid_at", { ascending: false })
        .limit(100),
      supabase
        .from("notifications")
        .select(
          "id, type, message, whatsapp_number, sent_at, success, error_message, customer_id, customers(id, name, username)",
        )
        .eq("tenant_id", tenant.id)
        .order("sent_at", { ascending: false })
        .limit(200),
      supabase
        .from("notification_queue")
        .select(
          "id, type, message, whatsapp_number, status, attempts, next_attempt_at, created_at, sent_at, error_message, customer_id, customers(id, name, username)",
        )
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setPayments((pRes.data as unknown as PaymentRow[]) || []);
    setNotifs((nRes.data as unknown as NotificationRow[]) || []);
    setQueue((qRes.data as unknown as QueueRow[]) || []);
    setLastRefreshed(new Date());
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    const interval = setInterval(() => {
      loadAll();
    }, 30000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const today = notifs.filter((n) =>
      (n.sent_at || "").startsWith(todayStr),
    );
    return {
      sentToday: today.length,
      success: today.filter((n) => n.success).length,
      failed: today.filter((n) => !n.success).length,
      pendingQueue: queue.filter(q => q.status === 'pending').length,
      failedQueue: queue.filter(q => q.status === 'failed').length,
      retryingQueue: queue.filter(q => q.status === 'pending' && q.attempts > 0).length,
      sentQueueToday: queue.filter(q => q.status === 'sent' && q.sent_at?.startsWith(todayStr)).length,
    };
  }, [notifs, queue]);

  const filtered = useMemo(() => {
    switch (filter) {
      case "D-3":
      case "D-1":
      case "D-0":
        return notifs.filter((n) => n.type === filter);
      case "confirmation":
        return notifs.filter((n) => n.type === "confirmation");
      case "manual":
        return notifs.filter((n) => n.type === "manual");
      case "failed":
        return notifs.filter((n) => !n.success);
      default:
        return notifs;
    }
  }, [notifs, filter]);

  const filteredQueue = useMemo(() => {
    switch (queueFilter) {
      case "pending":
        return queue.filter((q) => q.status === "pending");
      case "sent":
        return queue.filter((q) => q.status === "sent");
      case "failed":
        return queue.filter((q) => q.status === "failed");
      case "retrying":
        return queue.filter((q) => q.attempts > 1);
      default:
        return queue;
    }
  }, [queue, queueFilter]);

  const retryFn = useServerFn(retryNotification);

  async function handleManualTrigger() {
    setRunning(true);
    try {
      const r = await triggerNotificationsNow();
      if (!r.success) {
        toast.error(r.error || "Falha ao executar notificações");
      } else {
        toast.success(
          `${r.sent ?? 0} notificações enviadas, ${r.failed ?? 0} falhas`,
        );
        await loadAll();
      }
    } finally {
      setRunning(false);
    }
  }

  async function handleRetry(id: string) {
    try {
      const res = await retryFn({ data: { id } });
      if (res.success) {
        toast.success("Notificação reagendada!");
        await loadAll();
      } else {
        toast.error("Erro ao reagendar");
      }
    } catch (e) {
      toast.error("Erro de conexão");
    }
  }

  return (
    <PrivateRoute>
      <AppShell title="Cobranças">
        <PageHeader
          title="Cobranças"
          subtitle="Pagamentos confirmados e notificações enviadas aos seus clientes."
        />

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Enviadas hoje</div>
              <div className="text-2xl font-semibold">{stats.sentToday}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Sucesso</div>
              <div className="text-2xl font-semibold text-emerald-600">
                {stats.success}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Falhas</div>
              <div className="text-2xl font-semibold text-red-600">
                {stats.failed}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notifications */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Notificações</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualTrigger}
              disabled={running}
            >
              <Play className="w-4 h-4 mr-1" />
              {running ? "Executando..." : "Executar agora"}
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="px-6 pb-3">
              <Tabs value={filter} onValueChange={setFilter}>
                <TabsList className="flex-wrap h-auto">
                  <TabsTrigger value="all">Todas</TabsTrigger>
                  <TabsTrigger value="D-3">D-3</TabsTrigger>
                  <TabsTrigger value="D-1">D-1</TabsTrigger>
                  <TabsTrigger value="D-0">D-0</TabsTrigger>
                  <TabsTrigger value="confirmation">Confirmações</TabsTrigger>
                  <TabsTrigger value="manual">Manuais</TabsTrigger>
                  <TabsTrigger value="failed">Falhas</TabsTrigger>
                </TabsList>
                <TabsContent value={filter} className="mt-0" />
              </Tabs>
            </div>
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="Nenhuma notificação"
                subtitle="As notificações automáticas aparecem aqui após o envio diário."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Enviado em</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell className="font-medium">
                          {n.customers
                            ? n.customers.name || n.customers.username
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <NotifTypeBadge type={n.type} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {n.whatsapp_number || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(n.sent_at)}
                        </TableCell>
                        <TableCell>
                          {n.success ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                              Enviado
                            </Badge>
                          ) : (
                            <Badge
                              variant="destructive"
                              title={n.error_message || ""}
                            >
                              Falhou
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {n.customers && (
                            <Link
                              to="/clientes/$id"
                              params={{ id: n.customers.id }}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pagamentos recentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : payments.length === 0 ? (
              <EmptyState
                icon={DollarSign}
                title="Nenhum pagamento recebido ainda"
                subtitle="Configure o webhook do Asaas em Configurações para começar a receber confirmações."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Pago em</TableHead>
                      <TableHead>Vencimento anterior</TableHead>
                      <TableHead>Novo vencimento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {p.customers ? (
                            <Link
                              to="/clientes/$id"
                              params={{ id: p.customers.id }}
                              className="hover:underline"
                            >
                              {p.customers.name || p.customers.username}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-emerald-600 font-semibold">
                          {formatCurrency(p.amount)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(p.paid_at)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(p.previous_expiration)}
                        </TableCell>
                        <TableCell>{formatDate(p.new_expiration)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </AppShell>
    </PrivateRoute>
  );
}
