import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Eye, 
  EyeOff,
  LogOut, 
  QrCode,
  AlertCircle,
  Zap,
  Activity,
  Loader2,
  ExternalLink,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { logAdminAction } from "@/lib/adminLog";

export const Route = createFileRoute("/admin/evolution")({
  component: AdminEvolution,
});

interface GlobalSettings {
  evolution_api_url: string;
  evolution_api_key: string;
  app_url: string;
}

interface EvolutionInstance {
  instanceName: string;
  owner: string;
  profileName: string;
  profilePicture: string;
  status: string;
  serverUrl: string;
  apikey: string;
  integration: string;
  tenant_id?: string;
  company_name?: string;
}

function AdminEvolution() {
  const { admin } = useAdminAuth();
  const [settings, setSettings] = useState<GlobalSettings>({
    evolution_api_url: "",
    evolution_api_key: "",
    app_url: ""
  });
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "failed" | "idle">("idle");
  const [showKey, setShowKey] = useState(false);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("global_settings")
        .select("id, value");
      
      if (error) throw error;

      const mapped = Object.fromEntries(data.map(s => [s.id, s.value]));
      setSettings({
        evolution_api_url: mapped.evolution_api_url || "",
        evolution_api_key: mapped.evolution_api_key || "",
        app_url: mapped.app_url || "https://zapcobranca.com.br"
      });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar configurações");
    }
  };

  const testConnection = async () => {
    if (!settings.evolution_api_url || !settings.evolution_api_key) return;
    setTesting(true);
    try {
      const res = await fetch(`${settings.evolution_api_url}/instance/fetchInstances`, {
        headers: { apikey: settings.evolution_api_key }
      });
      if (res.ok) {
        setConnectionStatus("connected");
        const data = await res.json();
        
        // Fetch tenants to map names
        const { data: tenants } = await supabase.from("tenants").select("id, company_name");
        
        const mappedInstances = data.map((inst: any) => {
          // instance name format: zap_[tenant_id_first_8]
          const tenant = tenants?.find(t => inst.instanceName.includes(t.id.substring(0, 8)));
          return {
            ...inst,
            company_name: tenant?.company_name || "Desconhecido",
            tenant_id: tenant?.id
          };
        });
        setInstances(mappedInstances);
      } else {
        setConnectionStatus("failed");
      }
    } catch (err) {
      setConnectionStatus("failed");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!admin) return;
    setSaving(true);
    try {
      const updates = [
        { id: "evolution_api_url", value: settings.evolution_api_url, updated_by: admin.id },
        { id: "evolution_api_key", value: settings.evolution_api_key, updated_by: admin.id },
        { id: "app_url", value: settings.app_url, updated_by: admin.id }
      ];

      const { error } = await supabase
        .from("global_settings")
        .upsert(updates);

      if (error) throw error;

      await logAdminAction({
        adminId: admin.id,
        action: 'global_settings_updated',
        details: { settings: { ...settings, evolution_api_key: '***' } }
      });

      toast.success("Configurações globais salvas!");
      testConnection();
    } catch (err) {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchSettings().then(() => {
      // Small delay to ensure state is set before test
      setTimeout(testConnection, 500);
    });
  }, []);

  const stats = {
    total: instances.length,
    connected: instances.filter(i => i.status === "open").length,
    disconnected: instances.filter(i => i.status !== "open").length,
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações Globais</h1>
        <p className="text-gray-400">Integrações compartilhadas por todas as revendas</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-[#1A1D27] border-white/5">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Zap className="h-5 w-5 text-[#1D9E75]" />
                Evolution API
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {connectionStatus === "connected" ? (
                <Badge className="bg-[#1D9E75]/10 text-[#1D9E75] border-[#1D9E75]/20">● Conectada</Badge>
              ) : connectionStatus === "failed" ? (
                <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20">● Falha na conexão</Badge>
              ) : null}
              <Button size="icon" variant="outline" className="h-8 w-8 border-white/10" onClick={testConnection} disabled={testing}>
                <RefreshCw className={cn("h-4 w-4", testing && "animate-spin")} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300 font-semibold">URL da Evolution API</Label>
              <Input 
                value={settings.evolution_api_url} 
                onChange={e => setSettings({...settings, evolution_api_url: e.target.value})}
                placeholder="https://evolution.seudominio.com"
                className="bg-black/20 border-white/10 text-white placeholder:text-gray-600 focus:border-[#1D9E75]/50"
              />
              <p className="text-[10px] text-gray-500">Sem barra no final. Ex: https://evolution.seudominio.com</p>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300 font-semibold">API Key Global</Label>
              <div className="relative">
                <Input 
                  type={showKey ? "text" : "password"}
                  value={settings.evolution_api_key} 
                  onChange={e => setSettings({...settings, evolution_api_key: e.target.value})}
                  placeholder="Cole a AUTHENTICATION_API_KEY"
                  className="bg-black/20 border-white/10 text-white placeholder:text-gray-600 focus:border-[#1D9E75]/50 pr-10"
                />
                <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors">
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[10px] text-gray-500">Encontre no painel Dokploy → Evolution → Environment Variables</p>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300 font-semibold">URL pública do sistema</Label>
              <Input 
                value={settings.app_url} 
                onChange={e => setSettings({...settings, app_url: e.target.value})}
                placeholder="https://zapcobranca.com.br"
                className="bg-black/20 border-white/10 text-white placeholder:text-gray-600 focus:border-[#1D9E75]/50"
              />
              <p className="text-[10px] text-gray-500">Usada para gerar os links de pagamento enviados no WhatsApp</p>
            </div>

            <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-500 shrink-0" />
              <p className="text-xs text-blue-300">Estas configurações são usadas por todas as revendas. Cada revenda cria sua própria instância WhatsApp usando esta API compartilhada. A API Key não é visível pelas revendas.</p>
            </div>

            <Button className="w-full bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white font-bold" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Salvar configurações
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-[#1A1D27] border-white/5">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <Activity className="h-5 w-5 text-[#1D9E75]" />
              Resumo de saúde
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-black/20 rounded-lg border border-white/5">
                  <p className="text-[10px] text-gray-500 uppercase font-bold">Total</p>
                  <p className="text-xl font-bold text-white">{stats.total}</p>
                </div>
                <div className="p-3 bg-black/20 rounded-lg border border-white/5">
                  <p className="text-[10px] text-[#1D9E75] uppercase font-bold">Conectadas</p>
                  <p className="text-xl font-bold text-[#1D9E75]">{stats.connected}</p>
                </div>
                <div className="p-3 bg-black/20 rounded-lg border border-white/5">
                  <p className="text-[10px] text-red-500 uppercase font-bold">Desconectadas</p>
                  <p className="text-xl font-bold text-red-500">{stats.disconnected}</p>
                </div>
             </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#1A1D27] border-white/5">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white">Instâncias WhatsApp ativas</CardTitle>
            <CardDescription>Todas as revendas conectadas neste momento</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="border-white/10" onClick={testConnection}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar status
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-gray-500 uppercase text-[10px] font-bold tracking-wider bg-black/20">
                <tr>
                  <th className="px-6 py-4">Revenda</th>
                  <th className="px-6 py-4">Instância</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {instances.map((i, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-white">{i.company_name}</p>
                      <p className="text-[10px] text-gray-500">{i.tenant_id?.substring(0,8)}</p>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-400">{i.instanceName}</td>
                    <td className="px-6 py-4">
                      {i.status === "open" ? (
                        <Badge className="bg-[#1D9E75]/10 text-[#1D9E75] border-[#1D9E75]/20">Conectado</Badge>
                      ) : (
                        <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20">Desconectado</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-white">
                        <LogOut className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500/50 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {instances.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">Nenhuma instância encontrada</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HealthItem({ label, value, color = "text-white" }: any) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-500">{label}:</span>
      <span className={cn("font-bold", color)}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: "open" | "connecting" | "close" | "not_configured" }) {
  const map = {
    open: { label: "Conectado", cls: "bg-[#1D9E75]/10 text-[#1D9E75] border-[#1D9E75]/20" },
    connecting: { label: "Conectando", cls: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
    close: { label: "Desconectado", cls: "bg-red-500/10 text-red-500 border-red-500/20" },
    not_configured: { label: "Não config.", cls: "bg-gray-500/10 text-gray-500 border-gray-500/20" }
  };
  const cfg = map[status] || map.not_configured;
  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase border", cfg.cls)}>
      {cfg.label}
    </span>
  );
}
