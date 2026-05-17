import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Eye, 
  RefreshCw, 
  Pause, 
  Play, 
  MessageCircle, 
  Trash2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Building2,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import toast from "react-hot-toast";

export const Route = createFileRoute("/admin/tenants")({
  component: AdminTenants,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      filter: (search.filter as string) || "all",
      q: (search.q as string) || "",
    };
  },
});

interface TenantListItem {
  id: string;
  company_name: string;
  email: string;
  plan: string;
  whatsapp: string | null;
  active: boolean;
  created_at: string;
  max_customers: number | null;
  customers_count?: number;
}

function AdminTenants() {
  const { filter, q } = Route.useSearch();
  const navigate = useNavigate();
  
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(q);
  const [activeFilter, setActiveFilter] = useState(filter);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: tData, error: tErr } = await supabase
        .from("tenants")
        .select("id, company_name, email, plan, whatsapp, active, created_at, max_customers")
        .order("created_at", { ascending: false });

      if (tErr) throw tErr;

      const tenantIds = (tData || []).map(t => t.id);
      if (tenantIds.length > 0) {
        const { data: counts } = await supabase
          .from("customers")
          .select("tenant_id");
        
        const countMap = (counts || []).reduce((acc: any, curr) => {
          acc[curr.tenant_id] = (acc[curr.tenant_id] || 0) + 1;
          return acc;
        }, {});

        setTenants((tData || []).map(t => ({
          ...t,
          customers_count: countMap[t.id] || 0
        })) as TenantListItem[]);
      } else {
        setTenants([]);
      }
    } catch (err) {
      console.error("Error fetching tenants:", err);
      toast.error("Erro ao carregar revendas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredTenants = useMemo(() => {
    let list = tenants;

    // Filter by search
    if (search) {
      const query = search.toLowerCase();
      list = list.filter(t => 
        t.company_name.toLowerCase().includes(query) || 
        t.email.toLowerCase().includes(query) ||
        (t.whatsapp && t.whatsapp.includes(query))
      );
    }

    // Filter by category
    if (activeFilter !== "all") {
      if (activeFilter === "active") list = list.filter(t => t.active);
      else if (activeFilter === "suspended") list = list.filter(t => !t.active);
      else list = list.filter(t => t.plan === activeFilter);
    }

    return list;
  }, [tenants, search, activeFilter]);

  const toggleTenantStatus = async (tenant: TenantListItem) => {
    const newStatus = !tenant.active;
    const { error } = await supabase
      .from("tenants")
      .update({ active: newStatus })
      .eq("id", tenant.id);

    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }

    toast.success(`Revenda ${newStatus ? "reativada" : "suspensa"} com sucesso`);
    fetchData();
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    navigate({ search: (prev: any) => ({ ...prev, q: val }) });
  };

  const handleFilter = (val: string) => {
    setActiveFilter(val);
    navigate({ search: (prev: any) => ({ ...prev, filter: val }) });
  };

  const deleteTenant = async (tenant: TenantListItem) => {
    const confirmName = window.prompt(`Para excluir a revenda "${tenant.company_name}", digite o nome dela exatamente:`);
    if (confirmName !== tenant.company_name) {
      if (confirmName !== null) toast.error("Nome incorreto. Exclusão cancelada.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("tenants").delete().eq("id", tenant.id);
    if (error) {
      toast.error("Erro ao excluir revenda");
      setLoading(false);
      return;
    }

    toast.success("Revenda excluída com sucesso");
    fetchData();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Revendas</h1>
          <p className="text-gray-400">Gerencie todas as revendas da plataforma</p>
        </div>
        <div className="px-4 py-2 bg-[#1A1D27] rounded-lg border border-white/5 text-sm">
          <span className="text-gray-500">Total: </span>
          <span className="text-white font-bold">{tenants.length}</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-[#1A1D27] rounded-xl border border-white/5 p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input 
              placeholder="Buscar por nome, e-mail ou WhatsApp..." 
              className="pl-10 bg-[#0F1117] border-white/10 text-white focus:border-[#1D9E75]"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {["all", "active", "suspended", "free", "pro", "business"].map((f) => (
              <button
                key={f}
                onClick={() => handleFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-all uppercase tracking-wider",
                  activeFilter === f 
                    ? "bg-[#1D9E75] border-[#1D9E75] text-white" 
                    : "bg-[#0F1117] border-white/10 text-gray-500 hover:text-white"
                )}
              >
                {f === "all" ? "Todas" : f === "active" ? "Ativas" : f === "suspended" ? "Suspensas" : f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-[#1A1D27] rounded-xl border border-white/5 overflow-hidden">
        {loading ? (
          <div className="p-20 flex justify-center">
            <LoadingSpinner label="Buscando revendas..." />
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="p-20 text-center">
            <Building2 className="h-12 w-12 text-gray-700 mx-auto mb-4" />
            <h3 className="text-white font-medium">Nenhuma revenda encontrada</h3>
            <p className="text-gray-500 text-sm">Ajuste os filtros ou o termo de busca.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-gray-500 uppercase text-[10px] font-bold tracking-wider bg-black/20">
                <tr>
                  <th className="px-6 py-4 whitespace-nowrap">Revenda</th>
                  <th className="px-6 py-4 whitespace-nowrap">Plano</th>
                  <th className="px-6 py-4 whitespace-nowrap">Clientes</th>
                  <th className="px-6 py-4 whitespace-nowrap">Conexão</th>
                  <th className="px-6 py-4 whitespace-nowrap">Cadastro</th>
                  <th className="px-6 py-4 whitespace-nowrap">Status</th>
                  <th className="px-6 py-4 whitespace-nowrap text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTenants.map((t) => (
                  <tr key={t.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#1D9E75]/20 to-[#1D9E75]/10 flex items-center justify-center text-[#1D9E75] font-bold text-sm shrink-0 border border-[#1D9E75]/20">
                          {t.company_name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate max-w-[200px]">{t.company_name}</p>
                          <p className="text-xs text-gray-500 truncate max-w-[200px]">{t.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                        t.plan === "free" && "bg-gray-500/10 text-gray-500 border border-gray-500/20",
                        t.plan === "pro" && "bg-[#1D9E75]/10 text-[#1D9E75] border border-[#1D9E75]/20",
                        t.plan === "business" && "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                      )}>
                        {t.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-gray-300 font-medium">{t.customers_count || 0} / {t.max_customers || "∞"}</span>
                        <div className="w-24 h-1 bg-black/20 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full",
                              t.max_customers && (t.customers_count || 0) >= t.max_customers ? "bg-red-500" : "bg-[#1D9E75]"
                            )}
                            style={{ width: `${t.max_customers ? Math.min(((t.customers_count || 0) / t.max_customers) * 100, 100) : 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <div className={cn("h-2 w-2 rounded-full", t.whatsapp ? "bg-[#1D9E75]" : "bg-gray-600")} />
                          <span className="text-[10px] text-gray-400 uppercase tracking-tighter">Zap</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={cn("h-2 w-2 rounded-full", t.whatsapp ? "bg-blue-500" : "bg-gray-600")} />
                          <span className="text-[10px] text-gray-400 uppercase tracking-tighter">Asaas</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-gray-300 text-xs">{format(parseISO(t.created_at), "dd/MM/yyyy")}</span>
                        <span className="text-[10px] text-gray-500 italic">há {differenceInDays(new Date(), parseISO(t.created_at))} dias</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {t.active ? (
                        <span className="text-[10px] font-bold uppercase text-[#1D9E75] bg-[#1D9E75]/10 px-2 py-0.5 rounded border border-[#1D9E75]/20">Ativa</span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">Suspensa</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[#1A1D27] border-white/5 text-gray-300 w-48">
                          <DropdownMenuItem asChild>
                            <Link to={`/admin/tenants/${t.id}`} className="cursor-pointer">
                              <Eye className="mr-2 h-4 w-4" />
                              Ver detalhes
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.success("Modal de troca de plano em breve")}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Mudar plano
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/5" />
                          <DropdownMenuItem 
                            onClick={() => toggleTenantStatus(t)}
                            className={cn(t.active ? "text-yellow-500" : "text-[#1D9E75]")}
                          >
                            {t.active ? (
                              <><Pause className="mr-2 h-4 w-4" /> Suspender conta</>
                            ) : (
                              <><Play className="mr-2 h-4 w-4" /> Reativar conta</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteTenant(t)} className="text-red-500 focus:text-red-500">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir conta
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
