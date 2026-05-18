import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  MessageCircle,
  RefreshCw,
  Send,
  Power,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { PrivateRoute } from "@/components/PrivateRoute";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  connectWhatsApp,
  disconnectWhatsApp,
  getWhatsAppStatus,
  pollConnectionState,
  refreshQRCode,
  sendTestMessage,
} from "@/lib/evolution.functions";
import { unmaskDigits } from "@/lib/masks";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/whatsapp")({
  head: () => ({ meta: [{ title: "WhatsApp — ZapCobrança" }] }),
  component: WhatsAppPage,
});

type ViewState =
  | { kind: "loading" }
  | { kind: "not_configured" }
  | { kind: "disconnected"; instanceName: string }
  | {
      kind: "qr";
      instanceName: string;
      qrBase64: string | null;
      qrCode: string | null;
    }
  | {
      kind: "connected";
      instanceName: string;
      connectedAt: string | null;
    };

function WhatsAppPage() {
  const [view, setView] = useState<ViewState>({ kind: "loading" });

  const fetchStatus = useServerFn(getWhatsAppStatus);
  const connectFn = useServerFn(connectWhatsApp);
  const refreshFn = useServerFn(refreshQRCode);
  const pollFn = useServerFn(pollConnectionState);
  const sendTestFn = useServerFn(sendTestMessage);
  const disconnectFn = useServerFn(disconnectWhatsApp);

  const [connecting, setConnecting] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [qrCountdown, setQrCountdown] = useState(45);

  const pollTimer = useRef<number | null>(null);
  const countdownTimer = useRef<number | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const status = await fetchStatus({
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
      });
      if (!status.configured) {
        setView({ kind: "not_configured" });
        return;
      }
      if (status.connected) {
        setView({
          kind: "connected",
          instanceName: status.instanceName!,
          connectedAt: status.connectedAt ?? null,
        });
        return;
      }
      setView({
        kind: "disconnected",
        instanceName: status.instanceName!,
      });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar status");
    }
  }, [fetchStatus]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    return () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current);
      if (countdownTimer.current) window.clearInterval(countdownTimer.current);
    };
  }, []);

  const refreshQrNow = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const res = (await refreshFn({
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
      })) as any;
      
      if (res.success) {
        setView((v) =>
          v.kind === "qr"
            ? { ...v, qrBase64: res.qrBase64 ?? null, qrCode: res.qrCode ?? null }
            : v,
        );
        setQrCountdown(45);
      }
      return res;
    } catch (err) {
      console.error("[WhatsApp] Refresh QR error:", err);
      return { success: false, error: "Erro ao atualizar QR Code" };
    }
  }, [refreshFn]);

  useEffect(() => {
    if (view.kind !== "qr") return;
    if (pollTimer.current) window.clearInterval(pollTimer.current);
    if (countdownTimer.current) window.clearInterval(countdownTimer.current);

    setQrCountdown(45);

    pollTimer.current = window.setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const res = (await pollFn({
          headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
        })) as any;
        
        if (res.success && res.connected) {
          if (pollTimer.current) window.clearInterval(pollTimer.current);
          if (countdownTimer.current) window.clearInterval(countdownTimer.current);
          toast.success("WhatsApp conectado!");
          await loadStatus();
        }
      } catch (err) {
        console.error("[WhatsApp] Poll error:", err);
      }
    }, 5000);

    countdownTimer.current = window.setInterval(() => {
      setQrCountdown((prev) => {
        if (prev <= 1) {
          refreshQrNow().catch(() => {});
          return 45;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current);
      if (countdownTimer.current) window.clearInterval(countdownTimer.current);
    };
  }, [view.kind, pollFn, loadStatus, refreshQrNow]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const res = await connectFn({
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
      }) as any;
      if (!res.success) throw new Error(res.error);
      setView({
        kind: "qr",
        instanceName: res.instanceName!,
        qrBase64: res.qrBase64 ?? null,
        qrCode: res.qrCode ?? null,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao conectar");
    } finally {
      setConnecting(false);
    }
  };

  const handleManualRefresh = async () => {
    await refreshQrNow();
    toast.success("QR Code atualizado");
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const res = await disconnectFn({
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
      }) as any;
      if (!res.success) throw new Error(res.error);
      toast.success("WhatsApp desconectado");
      setConfirmDisconnect(false);
      await loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao desconectar");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <PrivateRoute>
      <AppShell title="WhatsApp">
        <PageHeader
          title="WhatsApp"
          subtitle="Conecte seu WhatsApp para enviar cobranças automáticas."
        />

        {view.kind === "loading" && (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        )}

        {view.kind === "not_configured" && (
          <Card className="max-w-xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                </div>
                <CardTitle>WhatsApp não disponível</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                O administrador do sistema ainda não configurou a integração com WhatsApp. 
                Entre em contato com o suporte para habilitar esta funcionalidade.
              </p>
            </CardContent>
          </Card>
        )}

        {view.kind === "disconnected" && (
          <Card className="max-w-xl">
            <CardContent className="pt-6 space-y-4 text-center">
              <StatusPill kind="disconnected" />
              <p className="text-xs text-muted-foreground">
                Sua instância:{" "}
                <span className="font-mono">{view.instanceName}</span>
              </p>
              <Button
                size="lg"
                onClick={handleConnect}
                disabled={connecting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white w-full"
              >
                {connecting ? "Gerando QR Code..." : "Conectar WhatsApp"}
              </Button>
            </CardContent>
          </Card>
        )}

        {view.kind === "qr" && (
          <Card className="max-w-xl">
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-center">
                <StatusPill kind="connecting" />
              </div>
              <div className="flex justify-center">
                {view.qrBase64 ? (
                  <img
                    src={view.qrBase64.startsWith("data:") ? view.qrBase64 : `data:image/png;base64,${view.qrBase64}`}
                    alt="QR Code"
                    className="h-[250px] w-[250px] rounded-lg border bg-white p-2"
                  />
                ) : (
                  <div className="flex h-[250px] w-[250px] items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground">
                    Aguardando QR Code...
                  </div>
                )}
              </div>
              <ol className="text-sm text-muted-foreground space-y-1 max-w-sm mx-auto list-decimal pl-5">
                <li>Abra o WhatsApp no seu celular</li>
                <li>Toque em Menu (⋮) ou Configurações</li>
                <li>Selecione "Aparelhos conectados"</li>
                <li>Toque em "Conectar um aparelho"</li>
                <li>Aponte a câmera para este QR Code</li>
              </ol>
              <p className="text-center text-xs text-muted-foreground">
                QR Code expira em: <span className="font-semibold tabular-nums text-foreground">{qrCountdown}s</span>
              </p>
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={handleManualRefresh}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Atualizar QR Code
                </Button>
                <Button variant="ghost" onClick={() => loadStatus()}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {view.kind === "connected" && (
          <Card className="max-w-xl">
            <CardContent className="pt-6 space-y-4">
              <div className="flex flex-col items-center gap-2 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                <StatusPill kind="connected" />
                {view.connectedAt && (
                  <p className="text-xs text-muted-foreground">
                    Conectado desde {new Date(view.connectedAt).toLocaleString("pt-BR")}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Instância: <span className="font-mono">{view.instanceName}</span>
                </p>
              </div>
              <div className="flex flex-col sm:flex-row justify-center gap-2 pt-2">
                <Button onClick={() => setTestOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Send className="mr-2 h-4 w-4" /> Enviar teste
                </Button>
                <Button variant="outline" onClick={() => setConfirmDisconnect(true)} className="text-red-600 hover:bg-red-50">
                  <Power className="mr-2 h-4 w-4" /> Desconectar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <SendTestModal open={testOpen} onOpenChange={setTestOpen} onSend={async (number, text) => {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          const res = (await sendTestFn({ data: { number, text }, headers: token ? { 'Authorization': `Bearer ${token}` } : undefined })) as any;
          if (!res.success) throw new Error(res.error);
        }} />

        <ConfirmDialog
          open={confirmDisconnect}
          onOpenChange={setConfirmDisconnect}
          title="Desconectar WhatsApp?"
          description="Isso pausará todas as notificações automáticas enviadas por este número."
          confirmText="Desconectar"
          onConfirm={handleDisconnect}
          loading={disconnecting}
        />
      </AppShell>
    </PrivateRoute>
  );
}

function StatusPill({ kind }: { kind: "connected" | "disconnected" | "connecting" }) {
  const styles = {
    connected: "bg-emerald-100 text-emerald-700 border-emerald-200",
    disconnected: "bg-red-100 text-red-700 border-red-200",
    connecting: "bg-yellow-100 text-yellow-700 border-yellow-200",
  };
  const labels = {
    connected: "● WhatsApp conectado",
    disconnected: "● WhatsApp desconectado",
    connecting: "● Aguardando leitura do QR Code",
  };
  return <span className={cn("px-3 py-1 rounded-full text-xs font-bold border", styles[kind])}>{labels[kind]}</span>;
}

function SendTestModal({ open, onOpenChange, onSend }: any) {
  const [number, setNumber] = useState("");
  const [text, setText] = useState("Teste de conexão ZapCobrança! ✅");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const digits = unmaskDigits(number);
    if (digits.length < 10) {
      toast.error("Número inválido");
      return;
    }
    setSending(true);
    try {
      await onSend(digits, text);
      toast.success("Mensagem enviada!");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Enviar mensagem de teste</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label>Número do WhatsApp</Label>
            <Input placeholder="5511999999999" value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Mensagem</Label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancelar</Button>
          <Button onClick={handleSend} disabled={sending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {sending ? "Enviando..." : "Enviar teste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
