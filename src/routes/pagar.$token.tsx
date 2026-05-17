import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ChevronDown, Copy, Check, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { extractPixKey, buildPixPayload } from "@/utils/pix";

export const Route = createFileRoute("/pagar/$token")({
  head: () => ({
    meta: [
      { title: "Pagar — ZapCobrança" },
      { name: "description", content: "Página de pagamento do cliente." },
    ],
  }),
  component: PagarPage,
});

interface PaymentInfo {
  customer_name: string | null;
  monthly_value: number | null;
  expiration_date: string | null;
  pix_emv_payload: string | null;
  plan: string | null;
  company_name: string;
  pix_expiration_minutes: number;
  server_time: string;
  payload_updated_at: string;
}

function formatCurrency(v: number | null | undefined): string {
  const n = typeof v === "number" ? v : 0;
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("T")[0].split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const target = new Date(`${iso.split("T")[0]}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function StatusBadge({ days }: { days: number | null }) {
  if (days === null) return null;
  let label = "";
  let cls = "";
  if (days > 3) {
    label = "Em dia";
    cls = "bg-emerald-100 text-emerald-700";
  } else if (days >= 1) {
    label = `Vence em ${days} dia${days > 1 ? "s" : ""}`;
    cls = "bg-yellow-100 text-yellow-800";
  } else if (days === 0) {
    label = "Vence hoje!";
    cls = "bg-orange-100 text-orange-700";
  } else {
    const a = Math.abs(days);
    label = `Vencido há ${a} dia${a > 1 ? "s" : ""}`;
    cls = "bg-red-100 text-red-700";
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        cls
      )}
    >
      {label}
    </span>
  );
}

function PagarPage() {
  const { token } = Route.useParams();
  const [info, setInfo] = useState<PaymentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [howOpen, setHowOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_public_payment_info", {
        _token: token,
      });
      if (cancelled) return;
      if (error || !data || data.length === 0) {
        setNotFound(true);
      } else {
        setInfo(data[0] as unknown as PaymentInfo);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const pixPayload = useMemo(() => {
    if (!info?.pix_emv_payload) return "";
    const value =
      typeof info.monthly_value === "number" && info.monthly_value > 0
        ? info.monthly_value
        : 0;
    if (!value) return info.pix_emv_payload;
    try {
      const key = extractPixKey(info.pix_emv_payload);
      if (!key || key === info.pix_emv_payload && info.pix_emv_payload.startsWith("000201")) {
        return info.pix_emv_payload;
      }
      return buildPixPayload(
        key,
        value,
        info.company_name || "ZAPCOBRANCA",
        "SAO PAULO"
      );
    } catch {
      return info.pix_emv_payload;
    }
  }, [info]);

  const handleCopy = async () => {
    if (!pixPayload) return;
    try {
      await navigator.clipboard.writeText(pixPayload);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center px-4">
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (notFound || !info) {
    return (
      <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-7 w-7 text-red-600" />
            </div>
            <h1 className="text-xl font-semibold">Página não encontrada</h1>
            <p className="text-sm text-muted-foreground">
              O link de pagamento é inválido ou expirou.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const days = daysUntil(info.expiration_date);
  const displayName = info.customer_name || "cliente";

  return (
    <div className="min-h-screen bg-[#F8FAFB] py-6 px-4">
      <div className="mx-auto w-full max-w-[480px] space-y-4">
        {/* Header */}
        <div className="text-center space-y-2 py-2">
          <div className="flex justify-center">
            <Logo size="md" />
          </div>
          <p className="text-xs text-muted-foreground">
            Cobrança enviada por{" "}
            <span className="font-medium text-foreground">
              {info.company_name}
            </span>
          </p>
        </div>

        {/* Customer card */}
        <Card>
          <CardContent className="pt-5 pb-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-lg font-semibold">
                Olá, {displayName}! 👋
              </h1>
              <StatusBadge days={days} />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Plano
                </p>
                <p className="text-sm font-medium mt-0.5">
                  {info.plan || "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Vencimento
                </p>
                <p className="text-sm font-medium mt-0.5">
                  {formatDateBR(info.expiration_date)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Value */}
        <Card>
          <CardContent className="pt-5 pb-5 text-center space-y-1">
            <p className="text-xs text-muted-foreground">
              Valor da mensalidade
            </p>
            <p className="text-3xl font-bold text-emerald-600">
              {formatCurrency(info.monthly_value)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Renovação automática de 30 dias após pagamento
            </p>
          </CardContent>
        </Card>

        {/* QR Code */}
        {pixPayload ? (
          <Card>
            <CardContent className="pt-5 pb-5 space-y-3 text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                QR Code PIX
              </p>
              <div className="flex justify-center">
                <div className="rounded-lg border bg-white p-3">
                  <QRCodeSVG value={pixPayload} size={200} level="M" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Escaneie com o app do seu banco
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-5 pb-5 text-center text-sm text-muted-foreground">
              PIX indisponível para esta cobrança.
            </CardContent>
          </Card>
        )}

        {/* Pix copia e cola */}
        {pixPayload && (
          <Card>
            <CardContent className="pt-5 pb-5 space-y-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Pix Copia e Cola
              </p>
              <div className="rounded-md bg-muted px-3 py-2 font-mono text-[11px] break-all line-clamp-3">
                {pixPayload}
              </div>
              <Button
                onClick={handleCopy}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                size="lg"
              >
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" /> Copiar código PIX
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Como pagar */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <button
              type="button"
              onClick={() => setHowOpen((o) => !o)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="text-sm font-medium">Como pagar?</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform text-muted-foreground",
                  howOpen && "rotate-180"
                )}
              />
            </button>
            {howOpen && (
              <ol className="mt-3 space-y-1.5 text-sm text-muted-foreground list-decimal pl-5">
                <li>Abra o app do seu banco</li>
                <li>Acesse a área PIX</li>
                <li>Escolha "Pagar com QR Code" ou "Copia e Cola"</li>
                <li>Escaneie o QR Code ou cole o código</li>
                <li>Confirme o valor e finalize o pagamento</li>
                <li className="list-none pl-0 pt-1 text-emerald-700 font-medium">
                  ✅ Sua assinatura será renovada automaticamente!
                </li>
              </ol>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center space-y-2 pt-2 pb-6">
          <p className="text-xs text-muted-foreground px-4">
            Após o pagamento confirmado, você receberá uma mensagem de
            confirmação no WhatsApp.
          </p>
          <p className="text-[11px] text-muted-foreground">
            Powered by ZapCobrança
          </p>
        </div>
      </div>
    </div>
  );
}
