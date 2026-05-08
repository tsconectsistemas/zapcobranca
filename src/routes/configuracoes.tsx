import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import toast from "react-hot-toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PrivateRoute } from "@/components/PrivateRoute";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  deleteMyAccount,
  getSettingsSnapshot,
  saveNotificationPreferences,
  saveTenantProfile,
} from "@/lib/settings.functions";
import { maskWhatsApp, unmaskDigits } from "@/lib/masks";
import { cn } from "@/lib/utils";
import { saveEvolutionConfig } from "@/lib/evolution.functions";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  MessageCircle,
  Shield,
} from "lucide-react";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — ZapCobrança" }] }),
  component: ConfiguracoesPage,
});

type AsaasEnvironment = "sandbox" | "production";

type SettingsSnapshot = Awaited<ReturnType<ReturnType<typeof useServerFn<typeof getSettingsSnapshot>>>>;

const PLAN_FEATURES: Record<
  string,
  Array<{ label: string; included: boolean }>
> = {
  free: [
    { label: "Notificações automáticas", included: true },
    { label: "Importação XLSX", included: true },
    { label: "Página de pagamento PIX", included: true },
    { label: "Clientes ilimitados", included: false },
    { label: "Multi-WhatsApp", included: false },
    { label: "Relatórios avançados", included: false },
  ],
  pro: [
    { label: "Notificações automáticas", included: true },
    { label: "Importação XLSX", included: true },
    { label: "Página de pagamento PIX", included: true },
    { label: "Clientes ilimitados", included: true },
    { label: "Multi-WhatsApp", included: true },
    { label: "Relatórios avançados", included: false },
  ],
  premium: [
    { label: "Notificações automáticas", included: true },
    { label: "Importação XLSX", included: true },
    { label: "Página de pagamento PIX", included: true },
    { label: "Clientes ilimitados", included: true },
    { label: "Multi-WhatsApp", included: true },
    { label: "Relatórios avançados", included: true },
  ],
};

function ConfiguracoesPage() {
  const navigate = useNavigate();
  const { tenant, refreshTenant, signOut } = useAuth();

  const loadSettings = useServerFn(getSettingsSnapshot);
  const saveProfile = useServerFn(saveTenantProfile);
  const saveNotifications = useServerFn(saveNotificationPreferences);
  const saveEvolution = useServerFn(saveEvolutionConfig);
  const deleteAccount = useServerFn(deleteMyAccount);

  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState(tenant?.company_name ?? "");
  const [email, setEmail] = useState(tenant?.email ?? "");
  const [resellerWhatsApp, setResellerWhatsApp] = useState(maskWhatsApp(tenant?.whatsapp ?? ""));
  const [logoUrl, setLogoUrl] = useState(tenant?.logo_url ?? "");

  const [asaasEnvironment, setAsaasEnvironment] = useState<AsaasEnvironment>("sandbox");
  const [asaasApiKey, setAsaasApiKey] = useState("");
  const [hasAsaasKey, setHasAsaasKey] = useState(false);
  const [showAsaasKey, setShowAsaasKey] = useState(false);

  const [evolutionApiUrl, setEvolutionApiUrl] = useState("");
  const [evolutionApiKey, setEvolutionApiKey] = useState("");
  const [hasEvolutionKey, setHasEvolutionKey] = useState(false);
  const [showEvolutionKey, setShowEvolutionKey] = useState(false);
  const [instanceName, setInstanceName] = useState("");
  const [whatsAppStatus, setWhatsAppStatus] = useState<"connected" | "disconnected" | string>("disconnected");

  const [notificationSettings, setNotificationSettings] = useState({
    d3: true,
    d1: true,
    d0: true,
    confirmed: true,
    sendHour: 9,
  });

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAsaas, setSavingAsaas] = useState(false);
  const [savingWhatsApp, setSavingWhatsApp] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showDangerDialog, setShowDangerDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-webhook`;

  useEffect(() => {
    const sync = async () => {
      setLoading(true);
      try {
        const data = (await loadSettings()) as SettingsSnapshot;
        setCompanyName(data.tenant.companyName);
        setEmail(data.tenant.email);
        setResellerWhatsApp(maskWhatsApp(data.tenant.whatsapp));
        setLogoUrl(data.tenant.logoUrl);
        setNotificationSettings(data.tenant.notificationSettings);
        setAsaasEnvironment(data.asaas.environment);
        setHasAsaasKey(data.asaas.hasApiKey);
        setEvolutionApiUrl(data.evolution.apiUrl);
        setHasEvolutionKey(data.evolution.hasApiKey);
        setInstanceName(data.evolution.instanceName);
        setWhatsAppStatus(data.whatsapp.status);
      } catch (error) {
        console.error(error);
        toast.error("Erro ao carregar configurações");
      } finally {
        setLoading(false);
      }
    };

    void sync();
  }, [loadSettings]);

  const initials = useMemo(() => {
    const source = companyName.trim() || tenant?.company_name || "ZR";
    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }, [companyName, tenant?.company_name]);

  const currentPlan = (tenant?.plan ?? "free").toLowerCase();
  const customerCount = (tenant as typeof tenant & { customer_count?: number | null })?.customer_count ?? 0;
  const maxCustomers = tenant?.max_customers ?? 50;
  const usagePercentage = Math.min(100, Math.round((customerCount / Math.max(maxCustomers, 1)) * 100));
  const planLabel =
    currentPlan === "pro" ? "Plano Pro" : currentPlan === "premium" ? "Plano Premium" : "Plano Free";
  const planFeatures = PLAN_FEATURES[currentPlan] ?? PLAN_FEATURES.free;

  const handleCopyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      toast.success("URL copiada!");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Não foi possível copiar a URL");
    }
  };

  const handleSaveProfile = async () => {
    if (!companyName.trim()) {
      toast.error("Informe o nome da empresa");
      return;
    }

    setSavingProfile(true);
    try {
      const result = await saveProfile({
        data: {
          companyName: companyName.trim(),
          whatsapp: unmaskDigits(resellerWhatsApp),
          logoUrl: logoUrl.trim(),
        },
      });

      if (!result.success) throw new Error(result.error);

      await refreshTenant();
      toast.success("Dados salvos!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar dados");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveAsaas = async () => {
    setSavingAsaas(true);
    try {
      const args: Record<string, string> = { _asaas_environment: asaasEnvironment };
      if (asaasApiKey.trim()) args._asaas_api_key = asaasApiKey.trim();
      const { error } = await supabase.rpc("update_tenant_secrets", args as never);
      if (error) throw error;

      setHasAsaasKey(Boolean(asaasApiKey.trim()) || hasAsaasKey);
      setAsaasApiKey("");
      toast.success("Configurações Asaas salvas!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar configurações Asaas");
    } finally {
      setSavingAsaas(false);
    }
  };

  const handleSaveWhatsApp = async () => {
    if (!evolutionApiUrl.trim() || (!evolutionApiKey.trim() && !hasEvolutionKey)) {
      toast.error("Preencha a URL e a API Key da Evolution");
      return;
    }

    setSavingWhatsApp(true);
    try {
      console.log("[Config] Saving Evolution Config...");
      const result = await saveEvolution({
        data: {
          apiUrl: evolutionApiUrl.trim(),
          apiKey: evolutionApiKey.trim() || "",
        },
      });
      console.log("[Config] Save Result:", result);
      if (!result.success) throw new Error(result.error);

      setHasEvolutionKey(true);
      setEvolutionApiKey("");
      setInstanceName(result.instanceName);
      toast.success("Configurações WhatsApp salvas!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar WhatsApp");
    } finally {
      setSavingWhatsApp(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSavingNotifications(true);
    try {
      const result = await saveNotifications({ data: notificationSettings });
      if (!result.success) throw new Error(result.error);

      await refreshTenant();
      toast.success("Preferências salvas!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar preferências");
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Preencha todos os campos de senha");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("A confirmação da senha não confere");
      return;
    }
    if (!email) {
      toast.error("E-mail da conta não encontrado");
      return;
    }

    setChangingPassword(true);
    try {
      const signInResult = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (signInResult.error) throw signInResult.error;

      const updateResult = await supabase.auth.updateUser({ password: newPassword });
      if (updateResult.error) throw updateResult.error;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Senha alterada com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Erro ao alterar senha");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const result = await deleteAccount({ data: { confirmationText: deleteConfirmation } });
      if (!result.success) throw new Error(result.error);

      toast.success("Conta encerrada com sucesso");
      setShowDangerDialog(false);
      await signOut();
      await navigate({ to: "/login" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao encerrar conta");
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <PrivateRoute>
      <AppShell title="Configurações">
        <PageHeader
          title="Configurações"
          subtitle="Gerencie os dados e integrações da sua revenda"
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Dados da Revenda</CardTitle>
              <CardDescription>Atualize as informações públicas da sua operação.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-4">
                <Avatar className="h-18 w-18 rounded-lg border">
                  {logoUrl ? <AvatarImage src={logoUrl} alt="Logo da revenda" /> : null}
                  <AvatarFallback className="rounded-lg text-lg font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium">Pré-visualização da logo</p>
                  <p className="text-sm text-muted-foreground">Use uma imagem quadrada para melhor resultado.</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="company-name">Nome da empresa</Label>
                <Input
                  id="company-name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Nome da sua revenda"
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="company-email">E-mail</Label>
                <Input id="company-email" value={email} readOnly disabled className="bg-muted text-muted-foreground" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="company-whatsapp">WhatsApp da revenda</Label>
                <Input
                  id="company-whatsapp"
                  value={resellerWhatsApp}
                  onChange={(e) => setResellerWhatsApp(maskWhatsApp(e.target.value))}
                  placeholder="(11) 99999-9999"
                  inputMode="tel"
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="logo-url">Logo URL</Label>
                <Input
                  id="logo-url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://..."
                  disabled={loading}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={savingProfile || loading}>
                  {savingProfile ? <Loader2 className="animate-spin" /> : null}
                  Salvar dados
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Integração Asaas</CardTitle>
              <CardDescription>Conecte cobranças, webhooks e confirmações de pagamento.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Ambiente Asaas</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "sandbox", label: "Sandbox (testes)" },
                    { value: "production", label: "Produção" },
                  ].map((option) => {
                    const active = asaasEnvironment === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setAsaasEnvironment(option.value as AsaasEnvironment)}
                        className={cn(
                          "flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors",
                          active ? "border-primary bg-accent text-foreground" : "border-border hover:bg-muted",
                        )}
                      >
                        <span>{option.label}</span>
                        <span className={cn("h-2.5 w-2.5 rounded-full border", active ? "border-primary bg-primary" : "border-muted-foreground")} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="asaas-key">Chave de API Asaas</Label>
                <div className="relative">
                  <Input
                    id="asaas-key"
                    type={showAsaasKey ? "text" : "password"}
                    placeholder="$aas_..."
                    value={asaasApiKey}
                    onChange={(e) => setAsaasApiKey(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAsaasKey((value) => !value)}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground"
                    aria-label={showAsaasKey ? "Ocultar chave" : "Mostrar chave"}
                  >
                    {showAsaasKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>URL do Webhook</Label>
                <div className="flex gap-2">
                  <Input value={webhookUrl} readOnly className="font-mono text-xs" />
                  <Button type="button" variant="outline" size="icon" onClick={handleCopyWebhook}>
                    {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
                <span className={cn("font-medium", hasAsaasKey ? "text-success" : "text-warning")}>● </span>
                {hasAsaasKey ? "API configurada" : "API não configurada"}
              </div>

              <Accordion type="single" collapsible className="rounded-md border px-4">
                <AccordionItem value="how-to" className="border-none">
                  <AccordionTrigger>Como configurar?</AccordionTrigger>
                  <AccordionContent>
                    <ol className="list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
                      <li>Acesse sua conta em asaas.com</li>
                      <li>Vá em Configurações → Integrações → API</li>
                      <li>Copie sua chave de API e cole acima</li>
                      <li>Em Configurações → Notificações → Webhooks, adicione a URL do webhook acima</li>
                      <li>Selecione os eventos: PAYMENT_CONFIRMED, PAYMENT_RECEIVED</li>
                      <li>Salve e teste com um pagamento real</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="flex justify-end">
                <Button onClick={handleSaveAsaas} disabled={savingAsaas || loading}>
                  {savingAsaas ? <Loader2 className="animate-spin" /> : null}
                  Salvar configurações Asaas
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>WhatsApp / Evolution API</CardTitle>
              <CardDescription>Salve a conexão da API e acompanhe o estado da instância.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="evolution-url">URL da Evolution API</Label>
                <Input
                  id="evolution-url"
                  value={evolutionApiUrl}
                  onChange={(e) => setEvolutionApiUrl(e.target.value)}
                  placeholder="https://sua-api.evolution.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="evolution-key">API Key Evolution</Label>
                <div className="relative">
                  <Input
                    id="evolution-key"
                    type={showEvolutionKey ? "text" : "password"}
                    value={evolutionApiKey}
                    onChange={(e) => setEvolutionApiKey(e.target.value)}
                    placeholder="Cole sua API Key"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEvolutionKey((value) => !value)}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground"
                    aria-label={showEvolutionKey ? "Ocultar chave" : "Mostrar chave"}
                  >
                    {showEvolutionKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="instance-name">Nome da instância</Label>
                <Input id="instance-name" value={instanceName} readOnly className="bg-muted text-muted-foreground" />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/50 px-3 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  <span className={cn("font-medium", whatsAppStatus === "connected" ? "text-success" : "text-destructive")}>
                    ● {whatsAppStatus === "connected" ? "WhatsApp conectado" : "WhatsApp desconectado"}
                  </span>
                </div>
                <Link to="/whatsapp" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                  Gerenciar conexão <ExternalLink className="h-4 w-4" />
                </Link>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveWhatsApp} disabled={savingWhatsApp || loading}>
                  {savingWhatsApp ? <Loader2 className="animate-spin" /> : null}
                  Salvar configurações WhatsApp
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notificações Automáticas</CardTitle>
              <CardDescription>Defina quais lembretes serão enviados automaticamente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <NotificationSwitch
                label="Notificar 3 dias antes do vencimento"
                checked={notificationSettings.d3}
                onCheckedChange={(checked) => setNotificationSettings((prev) => ({ ...prev, d3: checked }))}
              />
              <NotificationSwitch
                label="Notificar 1 dia antes do vencimento"
                checked={notificationSettings.d1}
                onCheckedChange={(checked) => setNotificationSettings((prev) => ({ ...prev, d1: checked }))}
              />
              <NotificationSwitch
                label="Notificar no dia do vencimento"
                checked={notificationSettings.d0}
                onCheckedChange={(checked) => setNotificationSettings((prev) => ({ ...prev, d0: checked }))}
              />
              <NotificationSwitch
                label="Notificar confirmação de pagamento"
                checked={notificationSettings.confirmed}
                onCheckedChange={(checked) =>
                  setNotificationSettings((prev) => ({ ...prev, confirmed: checked }))
                }
              />

              <div className="space-y-1.5">
                <Label>Horário de envio das notificações</Label>
                <Select
                  value={String(notificationSettings.sendHour)}
                  onValueChange={(value) =>
                    setNotificationSettings((prev) => ({ ...prev, sendHour: Number(value) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">07:00</SelectItem>
                    <SelectItem value="8">08:00</SelectItem>
                    <SelectItem value="9">09:00</SelectItem>
                    <SelectItem value="10">10:00</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">As notificações serão enviadas neste horário</p>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveNotifications} disabled={savingNotifications || loading}>
                  {savingNotifications ? <Loader2 className="animate-spin" /> : null}
                  Salvar preferências
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Plano Atual</CardTitle>
              <CardDescription>Veja seus limites e recursos disponíveis no momento.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 text-base font-semibold">
                  <span className="text-success">●</span>
                  {planLabel}
                </div>
                <Separator className="my-4" />
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Clientes: {customerCount} / {maxCustomers}</span>
                    <span className="text-muted-foreground">{usagePercentage}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${usagePercentage}%` }} />
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="space-y-2 text-sm">
                  {planFeatures.map((feature) => (
                    <div key={feature.label} className="flex items-center gap-2">
                      <span className={feature.included ? "text-success" : "text-muted-foreground"}>
                        {feature.included ? "✅" : "❌"}
                      </span>
                      <span className={feature.included ? "text-foreground" : "text-muted-foreground"}>{feature.label}</span>
                    </div>
                  ))}
                </div>
                <Separator className="my-4" />
                <Button asChild variant="outline" className="w-full justify-between">
                  <Link to="/planos">Fazer upgrade para Pro →</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Segurança</CardTitle>
              <CardDescription>Atualize sua senha e proteja o acesso da conta.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Shield className="h-4 w-4 text-primary" />
                  Alterar senha
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="current-password">Senha atual</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleChangePassword} disabled={changingPassword || loading}>
                    {changingPassword ? <Loader2 className="animate-spin" /> : null}
                    Alterar senha
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-destructive/40 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <p className="font-medium text-destructive">Encerrar conta</p>
                      <p className="text-sm text-muted-foreground">
                        Esta ação é irreversível. Todos os dados serão excluídos permanentemente.
                      </p>
                    </div>
                    <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setShowDangerDialog(true)}>
                      Encerrar minha conta
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Dialog open={showDangerDialog} onOpenChange={setShowDangerDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar encerramento da conta</DialogTitle>
              <DialogDescription>
                Digite <strong>{tenant?.company_name ?? companyName}</strong> para confirmar a exclusão permanente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="delete-confirmation">Nome da empresa</Label>
              <Input
                id="delete-confirmation"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="Digite o nome exato da empresa"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDangerDialog(false)} disabled={deletingAccount}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={deletingAccount || deleteConfirmation !== (tenant?.company_name ?? companyName)}
              >
                {deletingAccount ? <Loader2 className="animate-spin" /> : null}
                Encerrar conta
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AppShell>
    </PrivateRoute>
  );
}

function NotificationSwitch({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-3">
      <Label className="text-sm leading-5">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
