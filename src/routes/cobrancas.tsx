import { createFileRoute } from "@tanstack/react-router";
import { DollarSign } from "lucide-react";
import { PrivateRoute } from "@/components/PrivateRoute";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/cobrancas")({
  head: () => ({ meta: [{ title: "Cobranças — ZapCobrança" }] }),
  component: () => (
    <PrivateRoute>
      <AppShell title="Cobranças">
        <PageHeader
          title="Cobranças"
          subtitle="Histórico de pagamentos e cobranças geradas."
        />
        <div className="bg-card rounded-xl border">
          <EmptyState
            icon={DollarSign}
            title="Nenhuma cobrança ainda"
            subtitle="As cobranças aparecerão aqui assim que forem geradas."
          />
        </div>
      </AppShell>
    </PrivateRoute>
  ),
});
