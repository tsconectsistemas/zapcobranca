import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { 
  Save, 
  ExternalLink, 
  ChevronDown, 
  Plus, 
  Trash2, 
  GripVertical,
  Zap,
  Layout,
  MessageSquare,
  HelpCircle,
  Mail,
  Smartphone,
  CheckCircle2,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

export const Route = createFileRoute("/admin/landingpage")({
  component: AdminLandingPage,
});

interface LandingSection {
  id: string;
  section: string;
  content: any;
}

function AdminLandingPage() {
  const [sections, setSections] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data, error } = await supabase
          .from("landing_content")
          .select("*");
        
        if (error) throw error;
        
        const mapped = (data || []).reduce((acc: any, curr) => {
          acc[curr.id] = curr.content;
          return acc;
        }, {});
        
        setSections(mapped);
      } catch (err) {
        console.error("Error fetching landing page content:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const updateSection = (id: string, newContent: any) => {
    setSections(prev => ({ ...prev, [id]: newContent }));
    setHasUnsavedChanges(true);
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const promises = Object.entries(sections).map(([id, content]) => 
        supabase
          .from("landing_content")
          .upsert({ id, section: id, content, updated_at: new Date().toISOString() })
      );
      
      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);
      
      if (errors.length > 0) throw new Error("Erro ao salvar algumas seções");
      
      setHasUnsavedChanges(false);
      toast.success("Conteúdo da Landing Page atualizado!");
    } catch (err) {
      console.error("Error saving landing content:", err);
      toast.error("Erro ao salvar alterações");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner label="Carregando editor da Landing Page..." />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Landing Page</h1>
          <p className="text-gray-400">Edite o conteúdo da página inicial pública</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="border-white/10 text-gray-400 hover:text-white"
            asChild
          >
            <a href="/" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Ver página ao vivo
            </a>
          </Button>
          <Button 
            className={cn(
              "shadow-lg",
              hasUnsavedChanges ? "bg-orange-600 hover:bg-orange-700" : "bg-[#1D9E75] hover:bg-[#1D9E75]/90"
            )}
            onClick={saveAll}
            disabled={saving}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Salvando..." : "Salvar todas as alterações"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Editors */}
        <div className="space-y-4">
          <SectionEditor 
            title="Hero Section" 
            icon={Zap}
            content={sections.hero}
            onChange={(content) => updateSection("hero", content)}
            fields={[
              { key: "badge", label: "Texto do Badge", type: "text" },
              { key: "title", label: "Título Principal", type: "text" },
              { key: "subtitle", label: "Subtítulo", type: "textarea" },
              { key: "cta_primary", label: "Botão Primário", type: "text" },
              { key: "cta_secondary", label: "Botão Secundário", type: "text" },
            ]}
          />

          <StatsEditor 
            content={sections.stats}
            onChange={(content) => updateSection("stats", content)}
          />

          <FeaturesEditor 
            content={sections.features}
            onChange={(content) => updateSection("features", content)}
          />

          <div className="bg-[#1A1D27] rounded-xl border border-white/5 p-4 flex items-center justify-between text-sm text-gray-500 italic">
            <span>Outras seções (Depoimentos, FAQ, Rodapé) disponíveis em breve.</span>
          </div>
        </div>

        {/* Iframe Preview (Simulated) */}
        <div className="bg-[#1A1D27] rounded-xl border border-white/5 overflow-hidden flex flex-col sticky top-24 h-[80vh]">
          <div className="p-3 bg-black/40 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <div className="ml-2 px-3 py-1 bg-black/40 rounded text-[10px] text-gray-500 border border-white/5">
                zapcobranca.com.br
              </div>
            </div>
          </div>
          <div className="flex-1 bg-white relative overflow-hidden">
            {/* Real iframe would go here, using a div for mock preview if localhost is blocked */}
            <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-center p-8 bg-gray-50">
              <div className="space-y-4">
                <Layout className="h-12 w-12 mx-auto text-gray-300" />
                <p className="text-sm font-medium text-gray-500 italic">
                  Preview em tempo real carregando...
                  <br />
                  <span className="text-[10px] uppercase font-bold tracking-widest mt-2 block">
                    {hasUnsavedChanges ? "(Alterações pendentes)" : "(Sincronizado)"}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionEditor({ title, icon: Icon, content, onChange, fields }: any) {
  if (!content) return null;

  return (
    <div className="bg-[#1A1D27] rounded-xl border border-white/5 overflow-hidden">
      <div className="p-4 bg-black/20 flex items-center gap-3 border-b border-white/5">
        <Icon className="h-5 w-5 text-[#1D9E75]" />
        <h3 className="font-bold text-white text-sm">{title}</h3>
        <ChevronDown className="h-4 w-4 ml-auto text-gray-600" />
      </div>
      <div className="p-5 space-y-4">
        {fields.map((f: any) => (
          <div key={f.key} className="space-y-1.5">
            <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{f.label}</label>
            {f.type === "textarea" ? (
              <Textarea 
                value={content[f.key] || ""} 
                onChange={(e) => onChange({ ...content, [f.key]: e.target.value })}
                className="bg-[#0F1117] border-white/10 text-white min-h-[80px]"
              />
            ) : (
              <Input 
                value={content[f.key] || ""} 
                onChange={(e) => onChange({ ...content, [f.key]: e.target.value })}
                className="bg-[#0F1117] border-white/10 text-white"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsEditor({ content, onChange }: any) {
  if (!content || !content.items) return null;

  const updateItem = (index: number, key: string, val: string) => {
    const newItems = [...content.items];
    newItems[index] = { ...newItems[index], [key]: val };
    onChange({ ...content, items: newItems });
  };

  return (
    <div className="bg-[#1A1D27] rounded-xl border border-white/5 overflow-hidden">
      <div className="p-4 bg-black/20 flex items-center gap-3 border-b border-white/5">
        <Settings className="h-5 w-5 text-[#1D9E75]" />
        <h3 className="font-bold text-white text-sm">Estatísticas</h3>
        <ChevronDown className="h-4 w-4 ml-auto text-gray-600" />
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {content.items.map((item: any, i: number) => (
            <div key={i} className="p-3 rounded-lg bg-black/20 border border-white/5 space-y-3 relative group">
              <div className="flex items-center gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-[9px] text-gray-500 uppercase font-bold">Valor</label>
                  <Input 
                    value={item.value} 
                    onChange={(e) => updateItem(i, "value", e.target.value)}
                    className="h-8 bg-[#0F1117] border-white/5 text-white text-xs"
                  />
                </div>
                <div className="flex-[2] space-y-1">
                  <label className="text-[9px] text-gray-500 uppercase font-bold">Label</label>
                  <Input 
                    value={item.label} 
                    onChange={(e) => updateItem(i, "label", e.target.value)}
                    className="h-8 bg-[#0F1117] border-white/5 text-white text-xs"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeaturesEditor({ content, onChange }: any) {
  if (!content || !content.items) return null;

  const updateItem = (index: number, key: string, val: string) => {
    const newItems = [...content.items];
    newItems[index] = { ...newItems[index], [key]: val };
    onChange({ ...content, items: newItems });
  };

  return (
    <div className="bg-[#1A1D27] rounded-xl border border-white/5 overflow-hidden">
      <div className="p-4 bg-black/20 flex items-center gap-3 border-b border-white/5">
        <CheckCircle2 className="h-5 w-5 text-[#1D9E75]" />
        <h3 className="font-bold text-white text-sm">Funcionalidades</h3>
        <ChevronDown className="h-4 w-4 ml-auto text-gray-600" />
      </div>
      <div className="p-5 space-y-4">
        {content.items.map((item: any, i: number) => (
          <div key={i} className="flex gap-4 p-4 rounded-lg bg-black/20 border border-white/5 relative group">
            <GripVertical className="h-4 w-4 text-gray-800 absolute left-1 top-1/2 -translate-y-1/2 cursor-grab" />
            <div className="h-10 w-10 rounded-lg bg-[#0F1117] border border-white/5 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5 text-[#1D9E75]" />
            </div>
            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] text-gray-500 uppercase font-bold">Título</label>
                <Input 
                  value={item.title} 
                  onChange={(e) => updateItem(i, "title", e.target.value)}
                  className="h-9 bg-[#0F1117] border-white/5 text-white text-sm font-semibold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-gray-500 uppercase font-bold">Descrição</label>
                <Textarea 
                  value={item.desc} 
                  onChange={(e) => updateItem(i, "desc", e.target.value)}
                  className="bg-[#0F1117] border-white/5 text-white text-xs min-h-[60px]"
                />
              </div>
            </div>
            <button className="h-8 w-8 rounded flex items-center justify-center text-gray-700 hover:text-red-500 hover:bg-red-500/10 transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button variant="outline" className="w-full border-dashed border-white/10 text-gray-500 hover:text-white hover:bg-white/5">
          <Plus className="mr-2 h-4 w-4" />
          Adicionar funcionalidade
        </Button>
      </div>
    </div>
  );
}
