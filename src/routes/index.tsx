import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { 
  Zap, 
  CheckCircle2, 
  ArrowRight, 
  Menu, 
  X, 
  ChevronDown,
  Play,
  Smartphone,
  Users,
  BarChart,
  Shield,
  Upload,
  Globe,
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const [content, setContent] = useState<Record<string, any>>({});
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [{ data: cData }, { data: pData }] = await Promise.all([
          supabase.from("landing_content").select("*"),
          supabase.from("saas_plans").select("*").eq("is_active", true).order("sort_order", { ascending: true })
        ]);

        const mappedContent = (cData || []).reduce((acc: any, curr) => {
          acc[curr.id] = curr.content;
          return acc;
        }, {});

        setContent(mappedContent);
        setPlans(pData || []);
      } catch (err) {
        console.error("Error fetching landing data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><LoadingSpinner /></div>;

  const hero = content.hero || {};
  const stats = content.stats?.items || [];
  const features = content.features?.items || [];

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 overflow-x-hidden">
      {/* NAVBAR */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Logo size="md" />
          
          <div className="hidden lg:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-slate-600 hover:text-[#1D9E75] transition-colors">Funcionalidades</a>
            <a href="#plans" className="text-sm font-medium text-slate-600 hover:text-[#1D9E75] transition-colors">Planos</a>
            <a href="#faq" className="text-sm font-medium text-slate-600 hover:text-[#1D9E75] transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild className="hidden sm:inline-flex text-slate-600">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild className="bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white shadow-lg shadow-[#1D9E75]/20">
              <Link to="/cadastro">Começar grátis</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="pt-40 pb-20 px-6">
        <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
          {hero.badge && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1D9E75]/10 text-[#1D9E75] text-xs font-bold uppercase tracking-wider mb-6 border border-[#1D9E75]/20">
              <Zap className="h-3 w-3 fill-[#1D9E75]" />
              {hero.badge}
            </div>
          )}
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 max-w-4xl mb-6">
            {hero.title || "Gerencie cobranças IPTV no piloto automático"}
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mb-10 leading-relaxed">
            {hero.subtitle || "Notificações automáticas via WhatsApp, PIX integrado e gestão completa de assinantes para revendas IPTV."}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg" asChild className="bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white px-8 h-14 text-lg font-bold shadow-xl shadow-[#1D9E75]/20">
              <Link to="/cadastro">{hero.cta_primary || "Começar grátis"}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="border-slate-200 text-slate-600 px-8 h-14 text-lg font-bold hover:bg-slate-50">
              <a href="#plans">{hero.cta_secondary || "Ver planos"}</a>
            </Button>
          </div>

          {/* Screenshot Mockup */}
          <div className="mt-20 relative w-full max-w-5xl">
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10" />
            <div className="rounded-2xl border border-slate-200 shadow-2xl overflow-hidden bg-white aspect-video p-4">
              <div className="w-full h-full rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300">
                <BarChart className="h-20 w-20 opacity-20" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section className="py-12 bg-slate-50 border-y border-slate-100 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat: any, i: number) => (
            <div key={i} className="text-center">
              <p className="text-3xl font-extrabold text-slate-900">{stat.value}</p>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-widest mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES GRID */}
      <section id="features" className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4">Tudo que sua revenda precisa</h2>
            <p className="text-slate-500 max-w-2xl mx-auto">Recursos desenvolvidos especificamente para facilitar a vida do revendedor IPTV.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f: any, i: number) => (
              <div key={i} className="p-8 rounded-2xl border border-slate-100 bg-white hover:border-[#1D9E75]/30 hover:shadow-xl hover:shadow-[#1D9E75]/5 transition-all group">
                <div className="h-12 w-12 rounded-xl bg-[#1D9E75]/10 flex items-center justify-center text-[#1D9E75] mb-6 group-hover:scale-110 transition-transform">
                  <Zap className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{f.title}</h3>
                <p className="text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING SECTION */}
      <section id="plans" className="py-24 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6">Planos que cabem no seu bolso</h2>
            <div className="flex items-center justify-center gap-4">
              <span className={cn("text-sm font-bold", billingCycle === "monthly" ? "text-slate-900" : "text-slate-400")}>Mensal</span>
              <button 
                onClick={() => setBillingCycle(prev => prev === "monthly" ? "yearly" : "monthly")}
                className="w-12 h-6 rounded-full bg-[#1D9E75] relative flex items-center px-1"
              >
                <div className={cn("h-4 w-4 rounded-full bg-white transition-all", billingCycle === "yearly" ? "translate-x-6" : "translate-x-0")} />
              </button>
              <span className={cn("text-sm font-bold flex items-center gap-2", billingCycle === "yearly" ? "text-slate-900" : "text-slate-400")}>
                Anual
                <span className="text-[10px] bg-[#1D9E75]/10 text-[#1D9E75] px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Até 30% OFF</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {plans.map((plan: any) => (
              <div 
                key={plan.id} 
                className={cn(
                  "p-8 rounded-3xl bg-white border border-slate-100 flex flex-col relative transition-all hover:scale-105 hover:z-10",
                  plan.is_featured && "border-[#1D9E75] shadow-2xl shadow-[#1D9E75]/10 ring-1 ring-[#1D9E75]"
                )}
              >
                {plan.is_featured && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#1D9E75] text-white text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg">Popular</span>
                )}
                <h3 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                <p className="text-slate-500 text-sm mb-6">{plan.description}</p>
                <div className="mb-8">
                  <span className="text-4xl font-extrabold text-slate-900">
                    R$ {billingCycle === "monthly" ? plan.price_monthly.toFixed(0) : plan.price_yearly.toFixed(0)}
                  </span>
                  <span className="text-slate-400 font-medium">/mês</span>
                </div>
                <div className="space-y-4 mb-8 flex-1">
                  {(plan.features || []).map((feat: string, j: number) => (
                    <div key={j} className="flex items-start gap-3 text-sm text-slate-600">
                      <CheckCircle2 className="h-5 w-5 text-[#1D9E75] shrink-0" />
                      {feat}
                    </div>
                  ))}
                </div>
                <Button asChild className={cn("w-full h-12 font-bold", plan.is_featured ? "bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white" : "bg-slate-900 hover:bg-slate-800 text-white")}>
                  <Link to="/cadastro">Começar agora</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-100 pt-20 pb-10 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 md:col-span-2">
              <Logo size="md" />
              <p className="mt-4 text-slate-500 max-w-sm">
                A plataforma #1 para gestão de cobranças IPTV do Brasil. Simplicidade e automação para sua revenda.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-6">Plataforma</h4>
              <ul className="space-y-4 text-sm text-slate-600">
                <li><a href="#features" className="hover:text-[#1D9E75]">Funcionalidades</a></li>
                <li><a href="#plans" className="hover:text-[#1D9E75]">Preços</a></li>
                <li><Link to="/login" className="hover:text-[#1D9E75]">Login</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-6">Suporte</h4>
              <ul className="space-y-4 text-sm text-slate-600">
                <li className="flex items-center gap-2"><Mail className="h-4 w-4" /> suporte@zapcobranca.com.br</li>
                <li className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> (11) 99999-9999</li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-400 font-medium uppercase tracking-widest">
            <span>© 2026 ZapCobrança. Todos os direitos reservados.</span>
            <div className="flex gap-6">
              <a href="#" className="hover:text-slate-900">Privacidade</a>
              <a href="#" className="hover:text-slate-900">Termos</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
