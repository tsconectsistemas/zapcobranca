import { createFileRoute, Outlet, useLocation, Navigate } from "@tanstack/react-router";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { AdminRoute } from "@/components/AdminRoute";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Building2, 
  Gem, 
  Ticket, 
  Globe, 
  Smartphone, 
  ListTodo, 
  LogOut, 
  ExternalLink,
  ChevronRight,
  Menu,
  X,
  Settings
} from "lucide-react";
import { useState, useEffect } from "react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  component: AdminLayoutRoot,
});

function AdminLayoutRoot() {
  const { pathname } = useLocation();
  const isLoginPage = pathname === "/admin/login";
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (isLoginPage) {
    return <Outlet />;
  }

  if (isMobile) {
    return (
      <div className="min-h-screen bg-[#0F1117] flex flex-col items-center justify-center p-8 text-center">
        <Logo size="lg" />
        <div className="mt-8 space-y-4">
          <Smartphone className="h-16 w-16 text-[#1D9E75] mx-auto" />
          <h1 className="text-xl font-bold text-white">Painel Desktop</h1>
          <p className="text-gray-400 text-sm">
            O painel administrativo está disponível apenas em telas maiores. 
            Acesse pelo computador para gerenciar o sistema.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AdminRoute>
      <AdminLayout />
    </AdminRoute>
  );
}

function AdminLayout() {
  const { admin, signOut } = useAdminAuth();
  const { pathname } = useLocation();

  const menuItems = [
    { label: "Dashboard", icon: LayoutDashboard, to: "/admin/dashboard" },
    { label: "Revendas", icon: Building2, to: "/admin/tenants" },
    { label: "Planos", icon: Gem, to: "/admin/planos" },
    { label: "Vouchers", icon: Ticket, to: "/admin/vouchers" },
    { label: "Landing Page", icon: Globe, to: "/admin/landingpage" },
    { label: "Evolution Global", icon: Smartphone, to: "/admin/evolution" },
    { label: "Logs", icon: ListTodo, to: "/admin/logs" },
  ];

  const getPageTitle = () => {
    const item = menuItems.find(m => pathname.startsWith(m.to));
    return item ? item.label : "Painel Admin";
  };

  return (
    <div className="flex min-h-screen bg-[#0F1117] text-gray-300">
      {/* Sidebar */}
      <aside className="w-60 bg-[#1A1D27] border-r border-white/5 flex flex-col fixed inset-y-0 z-50">
        <div className="p-6">
          <Logo size="md" />
          <div className="mt-4 inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#1D9E75]/10 border border-[#1D9E75]/20 text-[10px] font-bold text-[#1D9E75] uppercase tracking-wider">
            <Settings className="h-3 w-3" />
            Admin
          </div>
          
          <div className="mt-6 flex items-center gap-3 p-2 rounded-lg bg-black/20 border border-white/5">
            <div className="h-9 w-9 rounded-full bg-[#1D9E75] flex items-center justify-center text-white font-bold text-sm">
              {admin?.name?.charAt(0) || "A"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{admin?.name}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-tight">{admin?.role || 'Administrator'}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <a
                key={item.to}
                href={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group",
                  active 
                    ? "bg-[#1D9E75] text-white" 
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <item.icon className={cn("h-4 w-4", active ? "text-white" : "text-gray-500 group-hover:text-gray-300")} />
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-3">
          <div className="px-3">
            <p className="text-[10px] text-gray-500 truncate">{admin?.email}</p>
          </div>
          <button 
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair do admin
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 pl-60 flex flex-col">
        {/* Header */}
        <header className="h-16 border-b border-white/5 bg-[#0F1117]/80 backdrop-blur-md sticky top-0 z-40 px-8 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{getPageTitle()}</h2>
          
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-transparent border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
              asChild
            >
              <a href="/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                Ver site
              </a>
            </Button>
            
            <div className="h-8 w-px bg-white/5 mx-2" />
            
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-300">{admin?.name}</span>
              <div className="h-8 w-8 rounded-full bg-[#1A1D27] border border-white/10 flex items-center justify-center text-xs font-bold text-[#1D9E75]">
                {admin?.name?.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
