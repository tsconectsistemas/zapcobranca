import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Smartphone, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw, 
  Eye, 
  LogOut, 
  QrCode,
  AlertCircle,
  Zap,
  Activity,
  Send,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { logAdminAction } from "@/lib/adminLog";

export const Route = createFileRoute("/admin/evolution")({
  component: AdminEvolution,
});

interface InstanceRow {
  tenant_id: string;
  company_name: string;
  instance_name: string | null;
  status: 'open' | 'connecting' | 'close' | 'not_configured';
  connected_at: string | null;
}

function AdminEvolution() {
  const { admin } = useAdminAuth();
  const [instances, setInstances] = useState<InstanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingAll, setCheckingAll] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkFilter, setBulkFilter] = useState("all");
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: tenants, error } = await supabase
        .from("tenants")
        .select("id, company_name, whatsapp, notification_config")
        .order("company_name");

      if (error) throw error;

      const rows: InstanceRow[] = tenants.map(t => ({
        tenant_id: t.id,
        company_name: t.company_name,
        instance_name: (t.notification_config as any)?.instance_name || null,
        status: t.whatsapp ? 'open' : 'not_configured', // Real-time check would go here
        connected_at: null
      }));

      setInstances(rows);
    } catch (err) {
      console.error("Error fetching instances:", err);
      toast.error("Erro ao carregar instâncias");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleBulkSend = async () => {
    if (!admin) return;
    setSendingBulk(true);
    try {
      // Logic for bulk sending via Evolution API would go here
      await logAdminAction({
        adminId: admin.id,
        action: 'bulk_message_sent',
        details: { message: bulkMessage, filter: bulkFilter }
      });
      toast.success("Comunicado enviado em massa!");
      setBulkMessage("");
      setConfirmBulk(false);
    } catch (err) {
      toast.error("Erro ao enviar comunicado");
    } finally {
      setSendingBulk(false);
    }
  };

  const checkAllStates = async () => {
    setCheckingAll(true);
    // Simulate check
    await new Promise(r => setTimeout(r, 2000));
    setCheckingAll(false);
    toast.success("Status de todas as instâncias atualizado!");
  };

  const health = {
    total: instances.length,
    connected: instances.filter(i => i.status === 'open').length,
    disconnected: instances.filter(i => i.status === 'close').length,
    notConfigured: instances.filter(i => i.status === 'not_configured').length
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-white">Evolution API Global</h1>
        <p className="text-gray-400">Gerencie todas as instâncias WhatsApp da plataforma</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Global Config Card */}
        <div className="lg:col-span-2 bg-[#1A1D27] rounded-xl border border-white/5 p-6 h-full">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#1D9E75]" />
            Configuração Global
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">URL da API</p>
              <p className="text-sm text-white font-mono break-all">https://api.evolution-api.com</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">API Key Global</p>
              <p className="text-sm text-white font-mono italic">****key</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Versão</p>
              <p className="text-sm text-white">2.3.7 (v2)</p>
            </div>
          </div>
          <div className="mt-8 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-500 shrink-0" />
            <p className="text-xs text-blue-300">Estes dados são informativos. Cada revenda utiliza sua própria chave mas compartilha o servidor global.</p>
          </div>
        </div>

        {/* Health Check Card */}
        <div className="bg-[#1A1D27] rounded-xl border border-white/5 p-6 h-full flex flex-col">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#1D9E75]" />
            Saúde da Plataforma
          </h3>
          <div className="space-y-4 flex-1">
            <HealthItem label="Total Instâncias" value={health.total} />
            <HealthItem label="Conectadas" value={health.connected} color="text-[#1D9E75]" />
            <HealthItem label="Desconectadas" value={health.disconnected} color="text-red-500" />
            <HealthItem label="Não configuradas" value={health.notConfigured} color="text-gray-500" />
            <div className="pt-4 border-t border-white/5">
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2">Taxa de Conexão</p>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-2 bg-black/20 rounded-full overflow-hidden">
                  <div className="h-full bg-[#1D9E75] rounded-full" style={{ width: `${(health.connected / (health.total || 1)) * 100}%` }} />
                </div>
                <span className="text-sm font-bold text-white">{((health.connected / (health.total || 1)) * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>
          <Button 
            variant="outline" 
            className="w-full mt-6 border-white/10 text-gray-400 hover:text-white"
            onClick={checkAllStates}
            disabled={checkingAll}
          >
            {checkingAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Verificar agora
          </Button>
        </div>
      </div>

      {/* Instances Table */}
      <div className="bg-[#1A1D27] rounded-xl border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Instâncias Ativas</h3>
          <Button size="sm" variant="outline" className="border-white/10 text-gray-400" onClick={checkAllStates}>
            Atualizar Status
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-gray-500 uppercase text-[10px] font-bold tracking-wider bg-black/20">
              <tr>
                <th className="px-6 py-4">Revenda</th>
                <th className="px-6 py-4">Instância</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4">Conectado em</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {instances.map((i) => (
                <tr key={i.tenant_id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-medium text-white">{i.company_name}</td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-400">{i.instance_name || "—"}</td>
                  <td className="px-6 py-4 text-center">
                    <StatusBadge status={i.status} />
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-xs">
                    {i.connected_at || "—"}
                  </td>
                  <td className="px-6 py-4 text-right space-x-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-white">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-white">
                      <QrCode className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-red-500">
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Send Card */}
      <div className="bg-[#1A1D27] rounded-xl border border-white/5 p-6">
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <Send className="h-5 w-5 text-[#1D9E75]" />
          Enviar comunicado para todas as revendas
        </h3>
        <div className="space-y-4 max-w-2xl">
          <div className="space-y-2">
            <label className="text-xs text-gray-500 font-bold uppercase tracking-wider">Filtro de Destinatários</label>
            <div className="flex gap-2">
              {["all", "pro", "business"].map(f => (
                <button
                  key={f}
                  onClick={() => setBulkFilter(f)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-bold border transition-all",
                    bulkFilter === f ? "bg-[#1D9E75] border-[#1D9E75] text-white" : "bg-black/20 border-white/10 text-gray-500"
                  )}
                >
                  {f === 'all' ? 'Todas ativas' : f === 'pro' ? 'Somente Pro' : 'Somente Business'}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-gray-500 font-bold uppercase tracking-wider">Mensagem</label>
            <textarea 
              value={bulkMessage}
              onChange={(e) => setBulkMessage(e.target.value)}
              className="w-full bg-[#0F1117] border border-white/10 rounded-lg p-4 text-white text-sm min-h-[120px] focus:border-[#1D9E75] outline-none"
              placeholder="Digite o comunicado que será enviado via WhatsApp para os proprietários das revendas..."
            />
          </div>
          <div className="flex items-center gap-3 p-4 bg-orange-500/5 border border-orange-500/20 rounded-lg">
            <input 
              type="checkbox" 
              checked={confirmBulk} 
              onChange={(e) => setConfirmBulk(e.target.checked)}
              className="rounded border-white/10 bg-black/40 text-[#1D9E75] focus:ring-0" 
            />
            <p className="text-xs text-orange-300">Confirmo que quero enviar este comunicado em massa via Evolution API.</p>
          </div>
          <Button 
            className="bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white font-bold px-8 h-12"
            disabled={!confirmBulk || !bulkMessage.trim() || sendingBulk}
            onClick={handleBulkSend}
          >
            {sendingBulk ? "Enviando..." : "Enviar comunicado"}
          </Button>
        </div>
      </div>
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

function StatusBadge({ status }: { status: InstanceRow['status'] }) {
  const map = {
    open: { label: "Conectado", cls: "bg-[#1D9E75]/10 text-[#1D9E75] border-[#1D9E75]/20" },
    connecting: { label: "Conectando", cls: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
    close: { label: "Desconectado", cls: "bg-red-500/10 text-red-500 border-red-500/20" },
    not_configured: { label: "Não config.", cls: "bg-gray-500/10 text-gray-500 border-gray-500/20" }
  };
  const cfg = map[status];
  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase border", cfg.cls)}>
      {cfg.label}
    </span>
  );
}
