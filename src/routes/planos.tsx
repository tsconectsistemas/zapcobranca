import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import toast from "react-hot-toast";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PrivateRoute } from "@/components/PrivateRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getMyPlanStatus,
  listPlans,
  startPlanCheckout,
  getPlanPaymentStatus,
  simulatePlanPayment,
} from "@/lib/plans.functions";
import { Check, X, Copy, Loader2, Sparkles, CheckCircle2, Clock } from "lucide-react";

export const Route = createFileRoute("/planos")({
  head: () => ({ meta: [{ title: "Planos — ZapCobrança" }] }),
  component: PlanosPage,
});

type BillingCycle = "monthly" | "yearly";

interface PlanRow {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  max_customers: number | null;
  features: Record<string, boolean> | unknown;
  sort_order: number;
}

const FEATURE_LABELS: Array<{ key: string; label: string }> = [
  { key: "xlsx_import", label: "Importação XLSX" },
  { key: "auto_notify", label: "Notificações automáticas" },
  { key: "payment_page", label: "Página de pagamento PIX" },
  { key: "priority_support", label: "Suporte prioritário" },
  { key: "advanced_reports", label: "Relatórios avançados" },
  { key: "custom_messages", label: "Mensagens personalizadas" },
  { key: "unlimited_customers", label: "Clientes ilimitados" },
  { key: "multi_whatsapp", label: "Multi-WhatsApp" },
  { key: "api_access", label: "Acesso à API" },
];

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function PlanosPage() {
  const navigate = useNavigate();
  const fetchPlans = useServerFn(listPlans);
  const fetchStatus = useServerFn(getMyPlanStatus);
  const startCheckout = useServerFn(startPlanCheckout);
  const checkStatus = useServerFn(getPlanPaymentStatus);
  const simulatePayment = useServerFn(simulatePlanPayment);

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string>("free");
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [loading, setLoading] = useState(true);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [step, setStep] = useState<"summary" | "payment" | "waiting" | "success">("summary");
  const [selectedPlan, setSelectedPlan] = useState<PlanRow | null>(null);
  const [generating, setGenerating] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<{
    paymentId: string;
    pixEmv: string;
    pixImage: string | null;
    amount: number;
    placeholder: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;

        const [pp, st] = await Promise.all([
          fetchPlans({ headers }), 
          fetchStatus({ headers })
        ]);
        setPlans(pp as PlanRow[]);
        if (st?.plan_id) setCurrentPlanId(st.plan_id);
      } catch (err) {
        console.error(err);
        toast.error("Erro ao carregar planos");
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchPlans, fetchStatus]);

  // Poll for payment confirmation while in waiting step
  useEffect(() => {
    if (step !== "waiting" || !paymentInfo) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const res = await checkStatus({ 
          data: { paymentId: paymentInfo.paymentId },
          headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
        });
        if (cancelled) return;
        if (res.status === "paid") {
          setStep("success");
        }
      } catch (err) {
        console.error(err);
      }
    };
    void tick();
    const id = window.setInterval(tick, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [step, paymentInfo, checkStatus]);

  const annualSavings = (plan: PlanRow) => {
    if (plan.price_monthly === 0) return 0;
    return plan.price_monthly * 12 - plan.price_yearly;
  };

  const displayPrice = (plan: PlanRow) => {
    if (plan.price_monthly === 0) return { main: "R$ 0", suffix: "/mês" };
    if (billing === "yearly") {
      return { main: formatBRL(plan.price_yearly / 12), suffix: "/mês" };
    }
    return { main: formatBRL(plan.price_monthly), suffix: "/mês" };
  };

  const handleSubscribe = (plan: PlanRow) => {
    if (plan.id === "free") return;
    setSelectedPlan(plan);
    setStep("summary");
    setPaymentInfo(null);
    setCheckoutOpen(true);
  };

  const handleContinueToPayment = async () => {
    if (!selectedPlan) return;
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await startCheckout({
        data: { planId: selectedPlan.id as "pro" | "business", billingCycle: billing },
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
      });
      if (!res.success) throw new Error(res.error);
      setPaymentInfo({
        paymentId: res.paymentId,
        pixEmv: res.pixEmv,
        pixImage: res.pixImage,
        amount: res.amount,
        placeholder: res.placeholder,
      });
      setStep("payment");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar pagamento");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyPix = async () => {
    if (!paymentInfo) return;
    try {
      await navigator.clipboard.writeText(paymentInfo.pixEmv);
      setCopied(true);
      toast.success("Código copiado!");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleSimulatePayment = async () => {
    if (!paymentInfo) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await simulatePayment({ 
        data: { paymentId: paymentInfo.paymentId },
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
      });
      if (!res.success) throw new Error(res.error);
      toast.success("Pagamento simulado!");
      setStep("waiting");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };

  const planSorted = useMemo(
    () => [...plans].sort((a, b) => a.sort_order - b.sort_order),
    [plans],
  );

  return (
    <PrivateRoute>
      <AppShell title="Planos">
        <PageHeader
          title="Escolha seu plano"
          subtitle="Escale sua revenda sem limites"
        />

        {/* Billing toggle */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex rounded-lg border bg-muted p-1">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition",
                billing === "monthly" ? "bg-background shadow" : "text-muted-foreground",
              )}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setBilling("yearly")}
              className={cn(
                "flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition",
                billing === "yearly" ? "bg-background shadow" : "text-muted-foreground",
              )}
            >
              Anual
              <Badge variant="secondary" className="text-[10px]">-20%</Badge>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {planSorted.map((plan) => {
              const isCurrent = plan.id === currentPlanId;
              const isPopular = plan.id === "pro";
              const features = (plan.features as Record<string, boolean>) ?? {};
              const price = displayPrice(plan);
              const savings = annualSavings(plan);
              return (
                <Card
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col",
                    isPopular && "border-primary shadow-lg ring-1 ring-primary/30",
                  )}
                >
                  {isPopular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 gap-1">
                      <Sparkles className="h-3 w-3" /> POPULAR
                    </Badge>
                  )}
                  <CardHeader>
                    <CardTitle className="text-xl uppercase tracking-wide">
                      {plan.name}
                    </CardTitle>
                    <div className="flex items-baseline gap-1 pt-2">
                      <span className="text-3xl font-bold">{price.main}</span>
                      <span className="text-sm text-muted-foreground">{price.suffix}</span>
                    </div>
                    {billing === "yearly" && savings > 0 && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        Economize {formatBRL(savings)}/ano
                      </p>
                    )}
                    <p className="pt-1 text-sm text-muted-foreground">
                      {plan.max_customers
                        ? `Até ${plan.max_customers} clientes`
                        : "Clientes ilimitados"}
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col">
                    <ul className="space-y-2 text-sm">
                      {FEATURE_LABELS.map((f) => {
                        const ok = Boolean(features[f.key]);
                        return (
                          <li key={f.key} className="flex items-center gap-2">
                            {ok ? (
                              <Check className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <X className="h-4 w-4 text-muted-foreground/50" />
                            )}
                            <span className={cn(!ok && "text-muted-foreground/70")}>
                              {f.label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="mt-6">
                      {isCurrent ? (
                        <Button disabled variant="outline" className="w-full">
                          Plano atual
                        </Button>
                      ) : plan.id === "free" ? (
                        <Button disabled variant="outline" className="w-full">
                          Gratuito
                        </Button>
                      ) : (
                        <Button
                          className="w-full"
                          variant={isPopular ? "default" : "outline"}
                          onClick={() => handleSubscribe(plan)}
                        >
                          Assinar {plan.name} →
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Checkout dialog */}
        <Dialog
          open={checkoutOpen}
          onOpenChange={(o) => {
            setCheckoutOpen(o);
            if (!o) {
              setStep("summary");
              setPaymentInfo(null);
            }
          }}
        >
          <DialogContent className="max-w-md">
            {selectedPlan && step === "summary" && (
              <>
                <DialogHeader>
                  <DialogTitle>
                    Assinar Plano {selectedPlan.name} —{" "}
                    {billing === "yearly"
                      ? formatBRL(selectedPlan.price_yearly) + "/ano"
                      : formatBRL(selectedPlan.price_monthly) + "/mês"}
                  </DialogTitle>
                  <DialogDescription>
                    Cobrança {billing === "yearly" ? "anual" : "mensal"} via PIX
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                    <p className="font-semibold">{selectedPlan.name}</p>
                    <p className="text-muted-foreground">
                      {selectedPlan.max_customers
                        ? `Até ${selectedPlan.max_customers} clientes`
                        : "Clientes ilimitados"}
                    </p>
                  </div>
                  <ul className="space-y-1.5 text-sm">
                    {FEATURE_LABELS.filter(
                      (f) => (selectedPlan.features as Record<string, boolean>)?.[f.key],
                    ).map((f) => (
                      <li key={f.key} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-500" /> {f.label}
                      </li>
                    ))}
                  </ul>
                  <Button onClick={handleContinueToPayment} disabled={generating} className="w-full">
                    {generating && <Loader2 className="h-4 w-4 animate-spin" />}
                    Continuar para pagamento
                  </Button>
                </div>
              </>
            )}

            {selectedPlan && step === "payment" && paymentInfo && (
              <>
                <DialogHeader>
                  <DialogTitle>Pague com PIX</DialogTitle>
                  <DialogDescription>
                    Valor: {formatBRL(paymentInfo.amount)}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {paymentInfo.placeholder ? (
                    <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200">
                      ⚠️ PIX real ainda não configurado (chave Asaas da plataforma pendente). Use
                      o botão de simulação abaixo para testar o fluxo.
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      {paymentInfo.pixImage ? (
                        <img
                          src={paymentInfo.pixImage}
                          alt="QR Code PIX"
                          className="h-56 w-56 rounded-md border bg-white p-2"
                        />
                      ) : (
                        <div className="flex h-56 w-56 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
                          QR Code indisponível
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      PIX Copia e Cola
                    </label>
                    <textarea
                      readOnly
                      value={paymentInfo.pixEmv}
                      className="mt-1 h-20 w-full resize-none rounded-md border bg-muted/40 p-2 font-mono text-xs"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      QR Code válido por 15 minutos
                    </span>
                  </div>
                  <Button onClick={handleCopyPix} variant="outline" className="w-full">
                    <Copy className="h-4 w-4" />
                    {copied ? "Copiado!" : "Copiar código"}
                  </Button>
                  <Button onClick={() => setStep("waiting")} className="w-full">
                    Já paguei, aguardar confirmação
                  </Button>
                  {paymentInfo.placeholder && (
                    <Button
                      onClick={handleSimulatePayment}
                      variant="secondary"
                      className="w-full"
                    >
                      🧪 Simular pagamento confirmado
                    </Button>
                  )}
                  <p className="text-center text-xs text-muted-foreground">
                    Após o pagamento, seu plano será ativado automaticamente em até 5 minutos
                  </p>
                </div>
              </>
            )}

            {step === "waiting" && (
              <>
                <DialogHeader>
                  <DialogTitle>Aguardando confirmação...</DialogTitle>
                  <DialogDescription>
                    Estamos verificando o pagamento a cada 10 segundos.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center gap-4 py-6">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Aguardando confirmação do pagamento...
                  </p>
                </div>
              </>
            )}

            {step === "success" && selectedPlan && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                    Plano {selectedPlan.name} ativado com sucesso! 🎉
                  </DialogTitle>
                  <DialogDescription>
                    {selectedPlan.max_customers
                      ? `Seu novo limite é de ${selectedPlan.max_customers} clientes.`
                      : "Você agora tem clientes ilimitados."}
                  </DialogDescription>
                </DialogHeader>
                <Button
                  onClick={() => {
                    setCheckoutOpen(false);
                    void navigate({ to: "/dashboard" });
                  }}
                  className="w-full"
                >
                  Ir para o dashboard
                </Button>
              </>
            )}
          </DialogContent>
        </Dialog>

        <div className="mt-8 text-center">
          <Link to="/configuracoes" className="text-sm text-muted-foreground hover:underline">
            ← Voltar para configurações
          </Link>
        </div>
      </AppShell>
    </PrivateRoute>
  );
}
