import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  ListTodo, 
  Calendar, 
  User, 
  Target, 
  Info, 
  Download,
  Filter,
  Search,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/admin/logs")({
  component: AdminLogs,
});

interface AdminLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: any;
  ip_address: string | null;
  created_at: string;
  admin_name?: string;
}

function AdminLogs() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_logs")
        .select(`
          *,
          admin_users(name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      setLogs((data || []).map(log => ({
        ...log,
        admin_name: (log.admin_users as any)?.name || "Admin"
      })));
    } catch (err) {
      console.error("Error fetching logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getActionConfig = (action: string) => {
    const map: Record<string, { label: string, cls: string }> = {
      plan_change: { label: "Plano alterado", cls: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
      suspend: { label: "Suspensão", cls: "bg-red-500/10 text-red-500 border-red-500/20" },
      reactivate: { label: "Reativação", cls: "bg-[#1D9E75]/10 text-[#1D9E75] border-[#1D9E75]/20" },
      delete: { label: "Exclusão", cls: "bg-red-900/10 text-red-900 border-red-900/20" },
      message_sent: { label: "Mensagem enviada", cls: "bg-teal-500/10 text-teal-500 border-teal-500/20" },
      bulk_message_sent: { label: "Envio em massa", cls: "bg-teal-700/10 text-teal-700 border-teal-700/20" },
      voucher_created: { label: "Voucher criado", cls: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
      login: { label: "Login admin", cls: "bg-gray-500/10 text-gray-500 border-gray-500/20" }
    };
    return map[action] || { label: action, cls: "bg-gray-500/10 text-gray-500 border-gray-500/20" };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Logs de Auditoria</h1>
          <p className="text-gray-400">Registro de todas as ações administrativas</p>
        </div>
        <Button variant="outline" className="border-white/10 text-gray-400 hover:text-white">
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <div className="bg-[#1A1D27] rounded-xl border border-white/5 p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input 
              placeholder="Buscar por revenda, admin ou ação..." 
              className="pl-10 bg-[#0F1117] border-white/10 text-white focus:border-[#1D9E75]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {["Todos", "Plano", "Suspensão", "Mensagem", "Voucher"].map((f) => (
              <button
                key={f}
                className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-white/10 bg-black/20 text-gray-500 hover:text-white transition-colors"
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#1A1D27] rounded-xl border border-white/5 overflow-hidden">
        {loading ? (
          <div className="p-20 flex justify-center">
            <LoadingSpinner label="Buscando logs..." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-gray-500 uppercase text-[10px] font-bold tracking-wider bg-black/20">
                <tr>
                  <th className="px-6 py-4">Data/Hora</th>
                  <th className="px-6 py-4">Admin</th>
                  <th className="px-6 py-4">Ação</th>
                  <th className="px-6 py-4">Alvo</th>
                  <th className="px-6 py-4">Detalhes</th>
                  <th className="px-6 py-4 text-right">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log) => {
                  const cfg = getActionConfig(log.action);
                  return (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-400 text-xs">
                        {format(parseISO(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-black/40 border border-white/5 flex items-center justify-center text-[10px] font-bold text-[#1D9E75]">
                            {log.admin_name?.charAt(0)}
                          </div>
                          <span className="text-white font-medium">{log.admin_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase border", cfg.cls)}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-xs">
                        {log.target_type && (
                          <span className="bg-white/5 px-1.5 py-0.5 rounded mr-1.5">{log.target_type}</span>
                        )}
                        {log.target_id || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] text-gray-500 hover:text-white px-2">
                          <Info className="h-3 w-3 mr-1" /> Ver JSON
                        </Button>
                      </td>
                      <td className="px-6 py-4 text-right text-[10px] text-gray-600 font-mono">
                        {log.ip_address || "127.0.0.1"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
