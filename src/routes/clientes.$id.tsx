import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Pencil,
  MessageCircle,
  Link as LinkIcon,
  MoreVertical,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Trash2,
  Pause,
  Ban,
  QrCode,
} from "lucide-react";
import { PrivateRoute } from "@/components/PrivateRoute";
import { AppShell } from "@/components/AppShell";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { StatusBadge, type CustomerStatus } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CustomerModal, type CustomerFormData } from "@/components/CustomerModal";
import { SendWhatsAppModal } from "@/components/SendWhatsAppModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { unmaskDigits } from "@/lib/masks";
import { extractPixKey, buildPixPayload } from "@/utils/pix";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/clientes/$id")({
  head: () => ({ meta: [{ title: "Cliente — ZapCobrança" }] }),
  component: ClienteDetalhes,
});

interface CustomerRow {
  id: string;
  tenant_id: string;
  name: string | null;
  username: string;
  password_iptv: string | null;
  whatsapp: string | null;
  screens: number | null;
  plan: string | null;
  monthly_value: number | null;
  expiration_date: string | null;
  status: string | null;
  pix_emv_payload: string | null;
  notes: string | null;
  reseller_tag: string | null;
  payment_token: string | null;
  iptv_created_at: string | null;
  last_access: string | null;
  created_at: string | null;
}

interface PaymentRow {
  id: string;
  amount: number | null;
  paid_at: string | null;
  previous_expiration: string | null;
  new_expiration: string | null;
  asaas_payment_id: string | null;
  created_at: string | null;
}

interface NotificationRow {
  id: string;
  type: string;
  message: string | null;
  sent_at: string | null;
  success: boolean | null;
  error_message: string | null;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function formatBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateBR(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return format(parseISO(d.length === 10 ? d + "T00:00:00" : d), "dd/MM/yyyy");
  } catch {
    return "—";
  }
}

function formatDateTimeBR(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return format(parseISO(d), "dd/MM/yyyy HH:mm");
  } catch {
    return "—";
  }
}

function getEffectiveStatus(c: CustomerRow): CustomerStatus {
  if (c.status === "suspended" || c.status === "cancelled") return "suspended";
  if (!c.expiration_date) return (c.status as CustomerStatus) || "active";
  const days = differenceInDays(
    parseISO(c.expiration_date + "T00:00:00"),
    new Date()
  );
  if (days < 0) return "expired";
  if (days <= 3) return "expiring_soon";
  return "active";
}

function expirationLabel(date: string | null | undefined): {
  text: string;
  cls: string;
} {
  if (!date) return { text: "Sem vencimento", cls: "text-muted-foreground" };
  const days = differenceInDays(
    parseISO(date + "T00:00:00"),
    new Date()
  );
  if (days < 0)
    return { text: `Vencido há ${Math.abs(days)} dia(s)`, cls: "text-destructive font-semibold" };
  if (days === 0) return { text: "Vence hoje", cls: "text-destructive font-semibold" };
  if (days <= 3)
    return { text: `Vence em ${days} dia(s)`, cls: "text-warning-foreground font-semibold" };
  return { text: `Vence em ${days} dias`, cls: "text-foreground" };
}

function ClienteDetalhes() {
  const { id } = Route.useParams();
  const { tenant } = useAuth();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [confirm, setConfirm] = useState<
    | { kind: "suspend" | "cancel" | "delete" }
    | null
  >(null);

  const [showPassword, setShowPassword] = useState(false);
  const [pixAmount, setPixAmount] = useState<string>("");
  const [generatedPix, setGeneratedPix] = useState<string>("");

  const fetchAll = async () => {
    if (!tenant) return;
    setLoading(true);
    const [{ data: cust }, { data: pays }, { data: notifs }] = await Promise.all([
      supabase.from("customers").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("payments")
        .select("*")
        .eq("customer_id", id)
        .order("paid_at", { ascending: false }),
      supabase
        .from("notifications")
        .select("*")
        .eq("customer_id", id)
        .order("sent_at", { ascending: false }),
    ]);
    setCustomer((cust as CustomerRow | null) ?? null);
    setPayments((pays as PaymentRow[] | null) ?? []);
    setNotifications((notifs as NotificationRow[] | null) ?? []);
    if (cust && (cust as CustomerRow).monthly_value != null) {
      setPixAmount(String((cust as CustomerRow).monthly_value).replace(".", ","));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (tenant) fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, id]);

  const paymentUrl = useMemo(() => {
    if (!customer?.payment_token) return "";
    return `${window.location.origin}/pagar/${customer.payment_token}`;
  }, [customer?.payment_token]);

  const pixKey = useMemo(
    () => (customer?.pix_emv_payload ? extractPixKey(customer.pix_emv_payload) : ""),
    [customer?.pix_emv_payload]
  );

  const defaultMessage = useMemo(() => {
    if (!customer) return "";
    const exp = expirationLabel(customer.expiration_date);
    const expPart = customer.expiration_date
      ? exp.text.toLowerCase().replace("vence em ", "em ").replace("vence ", "")
      : "em breve";
    const valor = formatBRL(customer.monthly_value);
    return `Olá ${customer.name || customer.username}! 👋
Sua assinatura IPTV vence ${expPart}.
Valor: ${valor}

Para pagar via PIX, acesse:
${paymentUrl}

${customer.pix_emv_payload ? `Ou copie o código PIX abaixo:\n${customer.pix_emv_payload}\n\n` : ""}Após o pagamento, sua assinatura é renovada automaticamente. ✅`;
  }, [customer, paymentUrl]);

  const handleCopy = async (text: string, label = "Copiado!") => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleStatusChange = async (newStatus: "suspended" | "cancelled") => {
    if (!customer) return;
    const { error } = await supabase
      .from("customers")
      .update({ status: newStatus })
      .eq("id", customer.id);
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    toast.success(newStatus === "suspended" ? "Cliente suspenso" : "Cliente cancelado");
    setConfirm(null);
    fetchAll();
  };

  const handleDelete = async () => {
    if (!customer) return;
    const { error } = await supabase.from("customers").delete().eq("id", customer.id);
    if (error) {
      toast.error("Erro ao excluir cliente");
      return;
    }
    toast.success("Cliente excluído");
    navigate({ to: "/clientes" });
  };

  const handleGenerateQr = () => {
    if (!customer || !pixKey) {
      toast.error("Cliente sem chave PIX cadastrada");
      return;
    }
    const n = parseFloat(pixAmount.replace(",", "."));
    if (Number.isNaN(n) || n <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    const payload = buildPixPayload(
      pixKey,
      n,
      customer.name || customer.username,
      "SAO PAULO",
      customer.id.replace(/-/g, "").substring(0, 25)
    );
    setGeneratedPix(payload);
    toast.success("QR Code gerado!");
  };

  const sendViaWhatsAppLink = () => {
    if (!customer?.whatsapp) {
      toast.error("Cliente sem WhatsApp cadastrado");
      return;
    }
    const digits = unmaskDigits(customer.whatsapp);
    const intl = digits.startsWith("55") ? digits : `55${digits}`;
    const msg = `Olá ${customer.name || customer.username}, segue o link para pagamento da sua assinatura IPTV: ${paymentUrl}`;
    window.open(
      `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  if (loading) {
    return (
      <PrivateRoute>
        <AppShell title="Cliente">
          <LoadingSpinner />
        </AppShell>
      </PrivateRoute>
    );
  }

  if (!customer) {
    return (
      <PrivateRoute>
        <AppShell title="Cliente">
          <div className="bg-card rounded-xl border p-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Cliente não encontrado.
            </p>
            <Button asChild>
              <Link to="/clientes">Voltar para clientes</Link>
            </Button>
          </div>
        </AppShell>
      </PrivateRoute>
    );
  }

  const status = getEffectiveStatus(customer);
  const exp = expirationLabel(customer.expiration_date);
  const initials = getInitials(customer.name || customer.username);

  const initialFormData: CustomerFormData = {
    id: customer.id,
    name: customer.name,
    whatsapp: customer.whatsapp,
    username: customer.username,
    password_iptv: customer.password_iptv,
    screens: customer.screens ?? 1,
    plan: customer.plan,
    monthly_value: customer.monthly_value,
    expiration_date: customer.expiration_date,
    status: customer.status ?? "active",
    pix_emv_payload: customer.pix_emv_payload,
    asaas_customer_id: customer.asaas_customer_id,
    notes: customer.notes,
  };

  return (
    <PrivateRoute>
      <AppShell title={customer.name || customer.username}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          <Link
            to="/clientes"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Clientes
          </Link>
        </div>

        {/* Hero Card */}
        <div className="bg-card rounded-xl border p-5 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold truncate">
                  {customer.name || customer.username}
                </h1>
                <StatusBadge status={status} />
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                @{customer.username}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span className="font-medium">
                  {formatBRL(customer.monthly_value)} / mês
                </span>
                <span className="text-muted-foreground">•</span>
                <span>{customer.screens ?? 1} tela(s)</span>
                <span className="text-muted-foreground">•</span>
                <span className={exp.cls}>
                  {customer.expiration_date
                    ? `Vence ${formatDateBR(customer.expiration_date)}`
                    : "Sem vencimento"}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
            <Button
              size="sm"
              onClick={() => setWaOpen(true)}
              disabled={!customer.whatsapp}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Enviar PIX
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(paymentUrl, "Link copiado!")}
              disabled={!paymentUrl}
            >
              <LinkIcon className="mr-2 h-4 w-4" />
              Copiar link
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setConfirm({ kind: "suspend" })}>
                  <Pause className="mr-2 h-4 w-4" />
                  Suspender
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConfirm({ kind: "cancel" })}>
                  <Ban className="mr-2 h-4 w-4" />
                  Cancelar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setConfirm({ kind: "delete" })}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="overview" className="flex-1 sm:flex-none">
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex-1 sm:flex-none">
              Pagamentos
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex-1 sm:flex-none">
              Notificações
            </TabsTrigger>
          </TabsList>

          {/* TAB 1 — Visão Geral */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <InfoCard title="Dados pessoais">
                <Field label="Nome" value={customer.name || "—"} />
                <Field
                  label="WhatsApp"
                  value={
                    customer.whatsapp ? (
                      <a
                        href={`https://wa.me/${
                          unmaskDigits(customer.whatsapp).startsWith("55")
                            ? unmaskDigits(customer.whatsapp)
                            : "55" + unmaskDigits(customer.whatsapp)
                        }`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {customer.whatsapp}
                      </a>
                    ) : (
                      "—"
                    )
                  }
                />
                <Field label="Cadastrado em" value={formatDateTimeBR(customer.created_at)} />
                <Field label="Último acesso IPTV" value={formatDateTimeBR(customer.last_access)} />
              </InfoCard>

              <InfoCard title="Acesso IPTV">
                <Field label="Usuário" value={customer.username} mono />
                <Field
                  label="Senha IPTV"
                  value={
                    customer.password_iptv ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="font-mono text-sm">
                          {showPassword ? customer.password_iptv : "••••••••"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowPassword((s) => !s)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                        {showPassword && (
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(customer.password_iptv!, "Senha copiada!")
                            }
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
                <Field label="Telas" value={String(customer.screens ?? 1)} />
                <Field label="Plano" value={customer.plan || "—"} />
                <Field label="Tag revenda" value={customer.reseller_tag || "—"} />
              </InfoCard>

              <InfoCard title="Cobrança">
                <Field label="Valor mensal" value={formatBRL(customer.monthly_value)} />
                <Field label="Data de vencimento" value={formatDateBR(customer.expiration_date)} />
                <Field label="Status" value={<StatusBadge status={status} />} />
                <div className={cn("mt-2 text-sm", exp.cls)}>{exp.text}</div>
              </InfoCard>

              <InfoCard title="Link de pagamento">
                {paymentUrl ? (
                  <>
                    <div className="bg-muted/40 rounded-md p-2 font-mono text-xs break-all">
                      {paymentUrl}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(paymentUrl, "Link copiado!")}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar link
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={sendViaWhatsAppLink}
                        disabled={!customer.whatsapp}
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Enviar via WhatsApp
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a
                          href={paymentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Visualizar página
                        </a>
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Link de pagamento indisponível.
                  </p>
                )}
              </InfoCard>
            </div>

            {/* PIX card full width */}
            <InfoCard title="PIX do cliente">
              {customer.pix_emv_payload ? (
                <>
                  <Field
                    label="Chave PIX extraída"
                    value={
                      pixKey ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="font-mono text-sm break-all">{pixKey}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(pixKey, "Chave copiada!")}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Não foi possível extrair a chave
                        </span>
                      )
                    }
                  />
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">
                        Valor para gerar QR Code (R$)
                      </label>
                      <Input
                        value={pixAmount}
                        onChange={(e) => setPixAmount(e.target.value)}
                        placeholder="49,90"
                        inputMode="decimal"
                      />
                    </div>
                    <Button onClick={handleGenerateQr} disabled={!pixKey}>
                      <QrCode className="mr-2 h-4 w-4" />
                      Gerar QR Code
                    </Button>
                  </div>

                  {generatedPix && (
                    <div className="mt-4 flex flex-col items-center gap-3 border-t pt-4">
                      <div className="bg-white p-3 rounded-lg">
                        <QRCodeSVG value={generatedPix} size={200} />
                      </div>
                      <div className="w-full bg-muted/40 rounded-md p-2 font-mono text-[10px] break-all max-h-24 overflow-y-auto">
                        {generatedPix}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(generatedPix, "Código PIX copiado!")}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar código PIX
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum payload PIX cadastrado para este cliente.
                </p>
              )}
            </InfoCard>
          </TabsContent>

          {/* TAB 2 — Pagamentos */}
          <TabsContent value="payments">
            <div className="bg-card rounded-xl border overflow-hidden">
              {payments.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum pagamento registrado ainda
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left">
                      <tr>
                        <th className="px-4 py-2 font-medium">Data</th>
                        <th className="px-4 py-2 font-medium">Valor</th>
                        <th className="px-4 py-2 font-medium">Período renovado</th>
                        <th className="px-4 py-2 font-medium">ID Asaas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id} className="border-t">
                          <td className="px-4 py-2">
                            {formatDateTimeBR(p.paid_at || p.created_at)}
                          </td>
                          <td className="px-4 py-2 font-medium">
                            {formatBRL(p.amount)}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {p.previous_expiration && p.new_expiration
                              ? `${formatDateBR(p.previous_expiration)} → ${formatDateBR(p.new_expiration)}`
                              : "—"}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                            {p.asaas_payment_id || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 3 — Notificações */}
          <TabsContent value="notifications">
            <div className="flex justify-end mb-3">
              <Button
                size="sm"
                onClick={() => setWaOpen(true)}
                disabled={!customer.whatsapp}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Enviar mensagem agora
              </Button>
            </div>
            <div className="bg-card rounded-xl border overflow-hidden">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma notificação enviada ainda
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left">
                      <tr>
                        <th className="px-4 py-2 font-medium">Data/hora</th>
                        <th className="px-4 py-2 font-medium">Tipo</th>
                        <th className="px-4 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notifications.map((n) => (
                        <tr key={n.id} className="border-t">
                          <td className="px-4 py-2">{formatDateTimeBR(n.sent_at)}</td>
                          <td className="px-4 py-2">
                            <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium uppercase">
                              {n.type}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            {n.success ? (
                              <span className="inline-flex items-center rounded-full bg-accent text-accent-foreground px-2 py-0.5 text-xs font-medium">
                                Enviado
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-xs font-medium"
                                title={n.error_message ?? undefined}
                              >
                                Erro
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Modals */}
        <CustomerModal
          open={editOpen}
          onOpenChange={setEditOpen}
          initial={initialFormData}
          onSaved={fetchAll}
        />

        <SendWhatsAppModal
          open={waOpen}
          onOpenChange={setWaOpen}
          customerId={customer.id}
          defaultWhatsapp={customer.whatsapp ?? ""}
          defaultMessage={defaultMessage}
          onSent={fetchAll}
        />

        <ConfirmDialog
          open={confirm?.kind === "suspend"}
          onOpenChange={(o) => !o && setConfirm(null)}
          title="Suspender cliente?"
          description={`O acesso de "${customer.name || customer.username}" será marcado como suspenso.`}
          confirmLabel="Suspender"
          onConfirm={() => handleStatusChange("suspended")}
        />
        <ConfirmDialog
          open={confirm?.kind === "cancel"}
          onOpenChange={(o) => !o && setConfirm(null)}
          title="Cancelar cliente?"
          description={`O cliente "${customer.name || customer.username}" será marcado como cancelado.`}
          confirmLabel="Cancelar cliente"
          onConfirm={() => handleStatusChange("cancelled")}
        />
        <ConfirmDialog
          open={confirm?.kind === "delete"}
          onOpenChange={(o) => !o && setConfirm(null)}
          title="Excluir cliente?"
          description={`Tem certeza que deseja excluir "${customer.name || customer.username}"? Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          variant="destructive"
          onConfirm={handleDelete}
        />
      </AppShell>
    </PrivateRoute>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-xl border p-5">
      <h3 className="text-sm font-semibold mb-3 text-foreground">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-0.5 sm:gap-3 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-sm text-foreground text-right break-words",
          mono && "font-mono"
        )}
      >
        {value}
      </span>
    </div>
  );
}

// Suppress unused locale import warning if not used elsewhere
void ptBR;
