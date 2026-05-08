import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  MessageCircle,
  RefreshCw,
  Send,
  Power,
  CheckCircle2,
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
  debugFetchInstances,
  disconnectWhatsApp,
  getWhatsAppStatus,
  pollConnectionState,
  refreshQRCode,
  saveEvolutionConfig,
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
  const saveConfig = useServerFn(saveEvolutionConfig);
  const connectFn = useServerFn(connectWhatsApp);
  const refreshFn = useServerFn(refreshQRCode);
  const pollFn = useServerFn(pollConnectionState);
  const sendTestFn = useServerFn(sendTestMessage);
  const disconnectFn = useServerFn(disconnectWhatsApp);

  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [qrCountdown, setQrCountdown] = useState(45);

  const refreshTimer = useRef<number | null>(null);
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

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (refreshTimer.current) window.clearInterval(refreshTimer.current);
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
      })) as {
        success: boolean;
        qrBase64?: string | null;
        qrCode?: string | null;
        error?: string;
      };
      
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

  // Start polling + countdown whenever we enter QR state
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
        })) as { success: boolean; connected?: boolean };
        
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
          // refresh QR — fire and forget
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

  const handleSaveConfig = async () => {
    const isConfigured = view.kind !== "not_configured";
    if (!apiUrl.trim() || (!apiKey.trim() && !isConfigured)) {
      toast.error("Preencha URL e API Key");
      return;
    }
    setSavingConfig(true);
    try {
      console.log("[WhatsApp] Saving Evolution Config...", { apiUrl });
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        console.error("[WhatsApp] No auth session found");
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      console.log("[WhatsApp] Token found, sending request...");

      const res = await saveConfig({
        data: { apiUrl: apiUrl.trim(), apiKey: apiKey.trim() },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log("[WhatsApp] Save Result:", res);
      if (!res.success) throw new Error(res.error);
      
      toast.success("Configuração salva!");
      await loadStatus();
      
      if (res.success) {
        console.log("[WhatsApp] Auto-connecting after save...");
        const connectRes = await connectFn({
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (connectRes.success) {
          setView({
            kind: "qr",
            instanceName: connectRes.instanceName!,
            qrBase64: connectRes.qrBase64!,
            qrCode: connectRes.qrCode!,
          });
        }
      }
    } catch (err) {
      console.error("[WhatsApp] Save Error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const res = await connectFn({
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
      });
      if (!res.success) throw new Error(res.error);
      setView({
        kind: "qr",
        instanceName: res.instanceName!,
        qrBase64: res.qrBase64,
        qrCode: res.qrCode,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao conectar");
    } finally {
      setConnecting(false);
    }
  };

  const handleManualRefresh = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const res = await refreshFn({
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
      });
      if (res.success) {
        setView((v) =>
          v.kind === "qr"
            ? { ...v, qrBase64: res.qrBase64, qrCode: res.qrCode }
            : v,
        );
        toast.success("QR Code atualizado");
      } else {
        toast.error(res.error || "Falha ao atualizar");
      }
    } catch {
      toast.error("Falha ao atualizar QR Code");
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const res = await disconnectFn({
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
      });
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
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                  <MessageCircle className="h-5 w-5 text-emerald-600" />
                </div>
                <CardTitle>Configure sua conexão WhatsApp</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">URL da Evolution API</Label>
                <Input
                  placeholder="https://sua-evolution-api.com"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">API Key da Evolution</Label>
                <Input
                  type="password"
                  placeholder="Chave de acesso da sua Evolution API"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  A chave é armazenada de forma segura e nunca aparece no
                  navegador.
                </p>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {savingConfig ? "Salvando..." : "Salvar e conectar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {view.kind === "disconnected" && (
          <Card className="max-w-xl">
            <CardContent className="pt-6 space-y-4 text-center">
              <StatusPill kind="disconnected" />
              <p className="text-xs text-muted-foreground">
                Instância:{" "}
                <span className="font-mono">{view.instanceName}</span>
              </p>
              <Button
                size="lg"
                onClick={handleConnect}
                disabled={connecting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
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
                    src={
                      view.qrBase64.startsWith("data:")
                        ? view.qrBase64
                        : `data:image/png;base64,${view.qrBase64}`
                    }
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
                QR Code expira em:{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {qrCountdown}s
                </span>
              </p>
              <div className="flex justify-center">
                <Button variant="outline" onClick={handleManualRefresh}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Atualizar QR Code
                </Button>
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
                    Conectado desde{" "}
                    {new Date(view.connectedAt).toLocaleString("pt-BR")}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Instância:{" "}
                  <span className="font-mono">{view.instanceName}</span>
                </p>
              </div>
              <div className="flex flex-col sm:flex-row justify-center gap-2 pt-2">
                <Button
                  onClick={() => setTestOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Enviar mensagem de teste
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setConfirmDisconnect(true)}
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Power className="mr-2 h-4 w-4" />
                  Desconectar WhatsApp
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <SendTestModal
          open={testOpen}
          onOpenChange={setTestOpen}
          onSend={async (number, text) => {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const res = (await sendTestFn({ 
              data: { number, text },
              headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
            })) as {
              success: boolean;
              error?: string;
            };
            if (!res.success) throw new Error(res.error);
          }}
        />

        <ConfirmDialog
          open={confirmDisconnect}
          onOpenChange={(o) => !o && setConfirmDisconnect(false)}
          title="Desconectar WhatsApp?"
          description="Desconectar o WhatsApp irá pausar todas as notificações automáticas. Confirmar?"
          confirmLabel="Desconectar"
          variant="destructive"
          loading={disconnecting}
          onConfirm={handleDisconnect}
        />

        <DebugPanel />
      </AppShell>
    </PrivateRoute>
  );
}

function StatusPill({
  kind,
}: {
  kind: "connected" | "disconnected" | "connecting";
}) {
  const map = {
    connected: { dot: "bg-emerald-500", label: "Conectado", cls: "bg-emerald-100 text-emerald-700" },
    disconnected: { dot: "bg-red-500", label: "Desconectado", cls: "bg-red-100 text-red-700" },
    connecting: { dot: "bg-yellow-500", label: "Aguardando leitura", cls: "bg-yellow-100 text-yellow-800" },
  } as const;
  const c = map[kind];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
        c.cls,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", c.dot)} />
      {c.label}
    </span>
  );
}

function SendTestModal({
  open,
  onOpenChange,
  onSend,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSend: (number: string, text: string) => Promise<void>;
}) {
  const [number, setNumber] = useState("");
  const [text, setText] = useState(
    "Olá! Esta é uma mensagem de teste do ZapCobrança. ✅",
  );
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
      toast.success("Mensagem enviada com sucesso!");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar mensagem de teste</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Número de destino</Label>
            <Input
              placeholder="(99) 99999-9999"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              inputMode="tel"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Mensagem</Label>
            <Textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {sending ? "Enviando..." : "Enviar teste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DebugPanel() {
  const debugFn = useServerFn(debugFetchInstances);
  const sendFn = useServerFn(sendTestMessage);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");
  const [testNumber, setTestNumber] = useState("");

  const runFetch = async () => {
    setLoading(true);
    try {
      const res = (await debugFn()) as {
        success: boolean;
        error?: string;
        raw?: string;
        apiUrl?: string;
        instanceName?: string;
      };
      setResult(JSON.stringify(res, null, 2));
    } catch (err) {
      setResult(String(err));
    } finally {
      setLoading(false);
    }
  };

  const runSend = async () => {
    const digits = unmaskDigits(testNumber);
    if (digits.length < 10) {
      toast.error("Número inválido");
      return;
    }
    setLoading(true);
    try {
      const res = (await sendFn({
        data: { number: digits, text: "Teste de envio do ZapCobrança 🔧" },
      })) as { success: boolean; error?: string };
      setResult(JSON.stringify(res, null, 2));
      if (res.success) toast.success("Mensagem enviada");
      else toast.error(res.error || "Falha");
    } catch (err) {
      setResult(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mt-6 max-w-2xl border-dashed">
      <CardHeader className="pb-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <CardTitle className="text-sm font-medium text-muted-foreground">
            🔧 Debug (somente DEV)
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {open ? "ocultar" : "mostrar"}
          </span>
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={runFetch} disabled={loading}>
              Testar conexão (fetchInstances)
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Número para teste"
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
              className="max-w-xs"
            />
            <Button size="sm" variant="outline" onClick={runSend} disabled={loading}>
              Testar envio
            </Button>
          </div>
          {result && (
            <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-[11px]">
              {result}
            </pre>
          )}
        </CardContent>
      )}
    </Card>
  );
}

