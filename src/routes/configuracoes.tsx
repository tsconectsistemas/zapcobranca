import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { PrivateRoute } from "@/components/PrivateRoute";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — ZapCobrança" }] }),
  component: () => (
    <PrivateRoute>
      <AppShell title="Configurações">
        <PageHeader
          title="Configurações"
          subtitle="Gerencie integrações, dados da empresa e preferências."
        />
        <div className="bg-card rounded-xl border">
          <EmptyState
            icon={Settings}
            title="Em breve"
            subtitle="Aqui você configurará Asaas, Evolution API (WhatsApp) e dados da revenda."
          />
        </div>
      </AppShell>
    </PrivateRoute>
  ),
});
