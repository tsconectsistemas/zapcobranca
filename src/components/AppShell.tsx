import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Users,
  DollarSign,
  MessageCircle,
  Settings,
  LogOut,
  Bell,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type WhatsAppDot = "connected" | "disconnected" | "none";

type NavRoute =
  | "/dashboard"
  | "/clientes"
  | "/cobrancas"
  | "/whatsapp"
  | "/configuracoes";

interface NavItem {
  to: NavRoute;
  label: string;
  shortLabel: string;
  icon: typeof Home;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Início", shortLabel: "Início", icon: Home },
  { to: "/clientes", label: "Clientes", shortLabel: "Clientes", icon: Users },
  {
    to: "/cobrancas",
    label: "Cobranças",
    shortLabel: "Cobranças",
    icon: DollarSign,
  },
  {
    to: "/whatsapp",
    label: "WhatsApp",
    shortLabel: "WhatsApp",
    icon: MessageCircle,
  },
  {
    to: "/configuracoes",
    label: "Configurações",
    shortLabel: "Config",
    icon: Settings,
  },
];

interface AppShellProps {
  title: string;
  children: ReactNode;
}

export function AppShell({ title, children }: AppShellProps) {
  const { tenant, user, signOut } = useAuth();
  const planLabel =
    tenant?.plan === "pro"
      ? "Plano Pro"
      : tenant?.plan === "premium"
        ? "Plano Premium"
        : "Plano Free";

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col border-r bg-card">
        <div className="px-5 py-5 border-b">
          <Logo size="sm" />
          <div className="mt-3 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {tenant?.company_name ?? "Sua revenda"}
            </p>
            <span className="mt-1 inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
              {planLabel}
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>

        <div className="border-t px-4 py-4 space-y-3">
          <p
            className="text-xs text-muted-foreground truncate"
            title={user?.email ?? ""}
          >
            {user?.email}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main column */}
      <div className="md:pl-60 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b">
          <div className="flex h-14 items-center gap-3 px-4 md:px-6">
            {/* Mobile: logo */}
            <div className="md:hidden">
              <Logo size="sm" />
            </div>

            {/* Title */}
            <h2 className="hidden md:block text-base font-semibold text-foreground truncate">
              {title}
            </h2>
            <h2 className="md:hidden flex-1 text-center text-sm font-semibold text-foreground truncate">
              {title}
            </h2>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                aria-label="Notificações"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Bell className="h-5 w-5" />
              </button>
              <span className="hidden md:inline text-sm text-muted-foreground truncate max-w-[160px]">
                {tenant?.company_name ?? user?.email}
              </span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-4 md:px-6 py-5 pb-24 md:pb-8">
          {children}
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-card border-t"
        aria-label="Navegação principal"
      >
        <ul className="grid grid-cols-5">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <BottomNavLink item={item} />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  const isActive = useIsActive(item.to);
  return (
    <Link
      to={item.to}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-accent text-secondary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className={cn("h-4 w-4", isActive && "text-primary")} />
      <span>{item.label}</span>
    </Link>
  );
}

function BottomNavLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  const isActive = useIsActive(item.to);
  return (
    <Link
      to={item.to}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
        isActive ? "text-primary" : "text-muted-foreground"
      )}
    >
      <Icon className="h-5 w-5" />
      <span>{item.shortLabel}</span>
    </Link>
  );
}

/**
 * Active when current pathname starts with the nav route
 * (so /clientes/123 also marks "Clientes" active).
 */
function useIsActive(to: string) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return pathname === to || pathname.startsWith(to + "/");
}
