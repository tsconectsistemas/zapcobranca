import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { 
  Plus, 
  Settings, 
  Trash2, 
  ArrowUpDown, 
  CheckCircle2, 
  AlertCircle,
  Gem,
  Info,
  ChevronRight,
  TrendingUp,
  CreditCard,
  Users,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

export const Route = createFileRoute("/admin/planos")({
  component: AdminPlanos,
});

interface SaaSPlan {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number | null;
  max_customers: number | null;
  features: string[];
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
}

interface PlanStats {
  plan_id: string;
  tenants_count: number;
  mrr: number;
}

function AdminPlanos() {
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [stats, setStats] = useState<Record<string, PlanStats>>({});
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<SaaSPlan | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const openEditModal = (plan: SaaSPlan) => {
    setEditingPlan({ ...plan });
    setIsModalOpen(true);
  };

  const handleSavePlan = async () => {
    if (!editingPlan) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("saas_plans")
        .update({
          name: editingPlan.name,
          description: editingPlan.description,
          price_monthly: editingPlan.price_monthly,
          price_yearly: editingPlan.price_yearly,
          max_customers: editingPlan.max_customers,
          is_active: editingPlan.is_active,
          is_featured: editingPlan.is_featured,
          features: editingPlan.features,
        })
        .eq("id", editingPlan.id);

      if (error) throw error;
      toast.success("Plano atualizado com sucesso!");
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Error updating plan:", err);
      toast.error("Erro ao salvar alterações");
    } finally {
      setSaving(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: pData, error: pErr } = await supabase
        .from("saas_plans")
        .select("*")
        .order("sort_order", { ascending: true });

      if (pErr) throw pErr;

      // Fetch usage stats per plan
      const { data: tData, error: tErr } = await supabase
        .from("tenants")
        .select("plan, active");

      if (tErr) throw tErr;

      const planStats: Record<string, PlanStats> = {};
      (pData || []).forEach(p => {
        planStats[p.id] = { plan_id: p.id, tenants_count: 0, mrr: 0 };
      });

      (tData || []).forEach(t => {
        if (t.plan && planStats[t.plan]) {
          planStats[t.plan].tenants_count++;
          if (t.active) {
            const plan = (pData || []).find(p => p.id === t.plan);
            if (plan) {
              planStats[t.plan].mrr += Number(plan.price_monthly);
            }
          }
        }
      });

      setPlans((pData || []) as SaaSPlan[]);
      setStats(planStats);
    } catch (err) {
      console.error("Error fetching plans:", err);
      toast.error("Erro ao carregar planos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner label="Carregando planos..." />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestão de Planos</h1>
          <p className="text-gray-400">Configure os planos oferecidos na plataforma</p>
        </div>
        <Button className="bg-[#1D9E75] hover:bg-[#1D9E75]/90">
          <Plus className="mr-2 h-4 w-4" />
          Novo plano
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <PlanCard 
            key={plan.id} 
            plan={plan} 
            stats={stats[plan.id]} 
            onRefresh={fetchData}
            onEdit={() => openEditModal(plan)}
          />
        ))}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#1A1D27] border-white/5 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Plano: {editingPlan?.name}</DialogTitle>
          </DialogHeader>
          
          {editingPlan && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome do Plano</Label>
                <Input 
                  value={editingPlan.name} 
                  onChange={(e) => setEditingPlan({...editingPlan, name: e.target.value})}
                  className="bg-[#0F1117] border-white/10"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Preço Mensal (R$)</Label>
                  <Input 
                    type="number"
                    value={editingPlan.price_monthly} 
                    onChange={(e) => setEditingPlan({...editingPlan, price_monthly: Number(e.target.value)})}
                    className="bg-[#0F1117] border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço Anual (R$)</Label>
                  <Input 
                    type="number"
                    value={editingPlan.price_yearly || 0} 
                    onChange={(e) => setEditingPlan({...editingPlan, price_yearly: Number(e.target.value)})}
                    className="bg-[#0F1117] border-white/10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Limite de Clientes (0 para ilimitado)</Label>
                <Input 
                  type="number"
                  value={editingPlan.max_customers || 0} 
                  onChange={(e) => setEditingPlan({...editingPlan, max_customers: Number(e.target.value) || null})}
                  className="bg-[#0F1117] border-white/10"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/5">
                <div className="space-y-0.5">
                  <Label>Plano em Destaque</Label>
                  <p className="text-[10px] text-gray-500">Exibido com borda verde na Landing Page</p>
                </div>
                <Switch 
                  checked={editingPlan.is_featured} 
                  onCheckedChange={(val) => setEditingPlan({...editingPlan, is_featured: val})}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/5">
                <div className="space-y-0.5">
                  <Label>Plano Ativo</Label>
                  <p className="text-[10px] text-gray-500">Permite novas assinaturas</p>
                </div>
                <Switch 
                  checked={editingPlan.is_active} 
                  onCheckedChange={(val) => setEditingPlan({...editingPlan, is_active: val})}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="text-gray-400">
              Cancelar
            </Button>
            <Button 
              className="bg-[#1D9E75] hover:bg-[#1D9E75]/90" 
              onClick={handleSavePlan}
              disabled={saving}
            >
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Migration Tool Placeholder */}
      <div className="bg-[#1A1D27] rounded-xl border border-white/5 p-6 border-l-4 border-l-[#1D9E75]">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg bg-[#1D9E75]/10 border border-[#1D9E75]/20">
            <Users className="h-5 w-5 text-[#1D9E75]" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white">Migrar revendas entre planos</h3>
            <p className="text-sm text-gray-400 mt-1">Ferramenta para mover assinantes de um plano para outro em lote.</p>
            <div className="mt-6 flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">De:</label>
                <select className="block w-48 bg-[#0F1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#1D9E75]">
                  <option value="">Selecionar plano</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-center h-10 w-10">
                <ChevronRight className="h-5 w-5 text-gray-700" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Para:</label>
                <select className="block w-48 bg-[#0F1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#1D9E75]">
                  <option value="">Selecionar plano</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <Button variant="outline" className="border-white/10 text-gray-400">
                Migrar em lote
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ plan, stats, onRefresh, onEdit }: { plan: SaaSPlan, stats: PlanStats, onRefresh: () => void, onEdit: () => void }) {
  const toggleActive = async () => {
    const { error } = await supabase
      .from("saas_plans")
      .update({ is_active: !plan.is_active })
      .eq("id", plan.id);
    
    if (error) {
      toast.error("Erro ao atualizar plano");
      return;
    }
    toast.success("Plano atualizado");
    onRefresh();
  };

  return (
    <div className={cn(
      "bg-[#1A1D27] rounded-xl border border-white/5 overflow-hidden flex flex-col transition-all",
      plan.is_featured && "border-[#1D9E75]/40 shadow-lg shadow-[#1D9E75]/5 ring-1 ring-[#1D9E75]/20"
    )}>
      <div className="p-6 flex-1">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <div className={cn("h-2 w-2 rounded-full", plan.is_active ? "bg-[#1D9E75]" : "bg-gray-600")} />
            <span className={cn("text-xs font-bold uppercase tracking-wider", plan.is_active ? "text-[#1D9E75]" : "text-gray-500")}>
              {plan.is_active ? "Ativo" : "Inativo"}
            </span>
          </div>
          {plan.is_featured && (
            <span className="bg-[#1D9E75]/10 text-[#1D9E75] text-[10px] font-bold uppercase px-2 py-0.5 rounded flex items-center gap-1 border border-[#1D9E75]/20">
              <Gem className="h-3 w-3" />
              Destaque
            </span>
          )}
        </div>

        <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
        <p className="text-xs text-gray-500 mb-4">{plan.description || "Sem descrição"}</p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-3 rounded-lg bg-black/20 border border-white/5">
            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Mensal</p>
            <p className="text-lg font-bold text-white">R$ {plan.price_monthly.toFixed(2).replace(".", ",")}</p>
          </div>
          <div className="p-3 rounded-lg bg-black/20 border border-white/5">
            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Anual</p>
            <p className="text-lg font-bold text-white">R$ {plan.price_yearly?.toFixed(2).replace(".", ",") || "—"}</p>
          </div>
        </div>

        <div className="space-y-2 mb-6 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Limite clientes:</span>
            <span className="text-white font-medium">{plan.max_customers || "Ilimitado"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Revendas:</span>
            <span className="text-white font-medium">{stats?.tenants_count || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">MRR:</span>
            <span className="text-[#1D9E75] font-bold">R$ {stats?.mrr.toFixed(2).replace(".", ",") || "0,00"}</span>
          </div>
        </div>

        <div className="border-t border-white/5 pt-4 space-y-2">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2">Benefícios:</p>
          {plan.features.slice(0, 4).map((f, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-gray-400">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#1D9E75] shrink-0 mt-0.5" />
              <span className="line-clamp-1">{f}</span>
            </div>
          ))}
          {plan.features.length > 4 && (
            <p className="text-[10px] text-gray-600 italic">+{plan.features.length - 4} outros...</p>
          )}
        </div>
      </div>

      <div className="bg-black/20 p-4 border-t border-white/5 flex gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1 bg-transparent border-white/10 hover:bg-white/5 text-xs"
          onClick={onEdit}
        >
          <Settings className="mr-2 h-3.5 w-3.5" />
          Editar
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1 bg-transparent border-white/10 hover:bg-white/5 text-xs"
          onClick={toggleActive}
        >
          {plan.is_active ? <><AlertCircle className="mr-2 h-3.5 w-3.5" /> Desativar</> : <><CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Ativar</>}
        </Button>
        <Button variant="ghost" size="icon" className="text-gray-600 hover:text-white">
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
