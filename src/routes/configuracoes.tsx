import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Copy, Check } from "lucide-react";
import { PrivateRoute } from "@/components/PrivateRoute";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — ZapCobrança" }] }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const [apiKey, setApiKey] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "production">(
    "sandbox",
  );
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setWebhookUrl(`${window.location.origin}/api/asaas-webhook`);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("get_tenant_secrets_status");
      if (!error && data && data.length > 0) {
        const row = data[0];
        setHasKey(!!row.has_asaas_key);
        setEnvironment(
          row.asaas_environment === "production" ? "production" : "sandbox",
        );
      }
      setLoading(false);
    })();
  }, []);

  const handleCopy = async () => {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      toast.success("URL copiada!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const args: Record<string, string> = { _asaas_environment: environment };
      if (apiKey.trim()) args._asaas_api_key = apiKey.trim();
      const { error } = await supabase.rpc(
        "update_tenant_secrets",
        args as never,
      );
      if (error) throw error;
      toast.success("Configurações salvas!");
      setApiKey("");
      setHasKey(true);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PrivateRoute>
      <AppShell title="Configurações">
        <PageHeader
          title="Configurações"
          subtitle="Gerencie integrações, dados da empresa e preferências."
        />

        <Card>
          <CardHeader>
            <CardTitle>Integração Asaas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs">Chave de API Asaas</Label>
              <Input
                type="password"
                placeholder={
                  hasKey
                    ? "•••••••••••• (chave já configurada)"
                    : "Cole sua chave de API"
                }
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={loading}
              />
              <p className="text-[11px] text-muted-foreground">
                A chave fica armazenada de forma segura e nunca é exposta no
                navegador.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Ambiente</Label>
              <Select
                value={environment}
                onValueChange={(v) =>
                  setEnvironment(v as "sandbox" | "production")
                }
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
                  <SelectItem value="production">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">URL do Webhook</Label>
              <div className="flex gap-2">
                <Input value={webhookUrl} readOnly className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  title="Copiar URL"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Cole esta URL no painel do Asaas em: Configurações →
                Notificações → Webhooks → Nova URL.
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving || loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {saving ? "Salvando..." : "Salvar configurações Asaas"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </AppShell>
    </PrivateRoute>
  );
}
