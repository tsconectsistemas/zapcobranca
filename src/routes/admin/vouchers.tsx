import { useState, useEffect, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { 
  Plus, 
  Search, 
  Ticket, 
  RefreshCw, 
  Copy, 
  Trash2, 
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ExternalLink,
  Calendar,
  CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { format, parseISO, isAfter, isBefore } from "date-fns";

export const Route = createFileRoute("/admin/vouchers")({
  component: AdminVouchers,
});

interface Voucher {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  plan_id: string | null;
  max_uses: number | null;
  current_uses: number;
  valid_from: string | null;
  valid_until: string | null;
  active: boolean;
  created_at: string;
}

function AdminVouchers() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("vouchers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVouchers(data as Voucher[]);
    } catch (err) {
      console.error("Error fetching vouchers:", err);
      toast.error("Erro ao carregar vouchers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredVouchers = useMemo(() => {
    if (!search) return vouchers;
    return vouchers.filter(v => 
      v.code.toLowerCase().includes(search.toLowerCase()) || 
      (v.description && v.description.toLowerCase().includes(search.toLowerCase()))
    );
  }, [vouchers, search]);

  const stats = useMemo(() => {
    const now = new Date();
    return {
      active: vouchers.filter(v => v.active && (!v.valid_until || isAfter(parseISO(v.valid_until), now))).length,
      usesToday: 0, // Mock for now, would need a query on voucher_uses
      usesMonth: 0,
      totalDiscount: vouchers.reduce((acc, v) => acc + (v.current_uses * 0), 0) // Complex to calculate accurately here
    };
  }, [vouchers]);

  const getVoucherStatus = (v: Voucher) => {
    const now = new Date();
    if (!v.active) return { label: "Desativado", color: "text-red-500 bg-red-500/10 border-red-500/20" };
    if (v.max_uses && v.current_uses >= v.max_uses) return { label: "Esgotado", color: "text-orange-500 bg-orange-500/10 border-orange-500/20" };
    if (v.valid_until && isBefore(parseISO(v.valid_until), now)) return { label: "Expirado", color: "text-gray-500 bg-gray-500/10 border-gray-500/20" };
    return { label: "Ativo", color: "text-[#1D9E75] bg-[#1D9E75]/10 border-[#1D9E75]/20" };
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado!");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Vouchers e Cupons</h1>
          <p className="text-gray-400">Crie códigos de desconto para novos assinantes</p>
        </div>
        <Button className="bg-[#1D9E75] hover:bg-[#1D9E75]/90">
          <Plus className="mr-2 h-4 w-4" />
          Criar voucher
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatMiniCard label="Vouchers ativos" value={stats.active} icon={Ticket} />
        <StatMiniCard label="Usos hoje" value={stats.usesToday} icon={RefreshCw} />
        <StatMiniCard label="Usos este mês" value={stats.usesMonth} icon={Calendar} />
        <StatMiniCard label="Desconto total" value={`R$ ${stats.totalDiscount.toFixed(2)}`} icon={CreditCard} />
      </div>

      {/* Table & Search */}
      <div className="bg-[#1A1D27] rounded-xl border border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5 bg-black/10">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input 
              placeholder="Buscar por código ou descrição..." 
              className="pl-10 bg-[#0F1117] border-white/10 text-white focus:border-[#1D9E75]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="p-20 flex justify-center">
            <LoadingSpinner label="Buscando vouchers..." />
          </div>
        ) : filteredVouchers.length === 0 ? (
          <div className="p-20 text-center text-gray-500 italic">
            Nenhum voucher encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-gray-500 uppercase text-[10px] font-bold tracking-wider bg-black/20">
                <tr>
                  <th className="px-6 py-4 whitespace-nowrap">Código</th>
                  <th className="px-6 py-4 whitespace-nowrap">Desconto</th>
                  <th className="px-6 py-4 whitespace-nowrap">Plano</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center">Usos</th>
                  <th className="px-6 py-4 whitespace-nowrap">Válido até</th>
                  <th className="px-6 py-4 whitespace-nowrap">Status</th>
                  <th className="px-6 py-4 whitespace-nowrap text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredVouchers.map((v) => {
                  const status = getVoucherStatus(v);
                  return (
                    <tr key={v.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <code className="bg-black/40 px-2 py-1 rounded text-white font-mono font-bold text-sm border border-white/5 group-hover:border-[#1D9E75]/30 transition-colors">
                            {v.code}
                          </code>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1 truncate max-w-[120px]">{v.description || "Sem descrição"}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-white font-bold">
                          {v.discount_type === "percent" ? `${v.discount_value}%` : `R$ ${v.discount_value}`}
                        </span>
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">
                          {v.discount_type === "percent" ? "Percentual" : "Valor Fixo"}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-gray-400 uppercase font-bold tracking-widest">{v.plan_id || "Todos"}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-white font-medium">{v.current_uses} / {v.max_uses || "∞"}</span>
                          {v.max_uses && (
                            <div className="w-12 h-1 bg-black/20 rounded-full mt-1 overflow-hidden">
                              <div 
                                className="h-full bg-[#1D9E75]" 
                                style={{ width: `${Math.min((v.current_uses / v.max_uses) * 100, 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-xs">
                        {v.valid_until ? format(parseISO(v.valid_until), "dd/MM/yyyy") : "Sem expiração"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase border",
                          status.color
                        )}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-gray-500 hover:text-white"
                            onClick={() => copyCode(v.code)}
                            title="Copiar código"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-gray-500 hover:text-white"
                            title="Ver usos"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-gray-500 hover:text-white"
                            title="Editar"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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

function StatMiniCard({ label, value, icon: Icon }: any) {
  return (
    <div className="bg-[#1A1D27] rounded-xl border border-white/5 p-4 flex items-center gap-4">
      <div className="p-2 rounded-lg bg-[#1D9E75]/10 border border-[#1D9E75]/20">
        <Icon className="h-5 w-5 text-[#1D9E75]" />
      </div>
      <div>
        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{label}</p>
        <p className="text-lg font-bold text-white">{value}</p>
      </div>
    </div>
  );
}
