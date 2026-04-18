import { createFileRoute } from "@tanstack/react-router";
import { Users, AlertTriangle, XCircle, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PrivateRoute } from "@/components/PrivateRoute";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Início — ZapCobrança" },
      {
        name: "description",
        content: "Painel com métricas das suas cobranças e clientes IPTV.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <PrivateRoute>
      <AppShell title="Início">
        <PageHeader
          title="Visão geral"
          subtitle="Acompanhe o status da sua revenda em tempo real."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MetricCard
            label="Clientes ativos"
            value="0"
            icon={Users}
            tone="success"
          />
          <MetricCard
            label="Vencendo hoje"
            value="0"
            icon={AlertTriangle}
            tone="warning"
          />
          <MetricCard
            label="Inadimplentes"
            value="0"
            icon={XCircle}
            tone="destructive"
          />
          <MetricCard
            label="Receita do mês"
            value="R$ 0,00"
            icon={Wallet}
            tone="info"
          />
        </div>

        <div className="mt-6 bg-card rounded-xl border p-6">
          <p className="text-sm text-muted-foreground">
            Os dados em tempo real aparecerão aqui assim que você cadastrar
            clientes e configurar suas integrações.
          </p>
        </div>
      </AppShell>
    </PrivateRoute>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: "success" | "warning" | "destructive" | "info";
}

function MetricCard({ label, value, icon: Icon, tone }: MetricCardProps) {
  const toneStyles: Record<MetricCardProps["tone"], string> = {
    success: "bg-accent text-primary",
    warning: "bg-warning/15 text-warning-foreground",
    destructive: "bg-destructive/10 text-destructive",
    info: "bg-secondary/10 text-secondary",
  };

  return (
    <div className="bg-card rounded-xl border p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            toneStyles[tone]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
