import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { PrivateRoute } from "@/components/PrivateRoute";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/whatsapp")({
  head: () => ({ meta: [{ title: "WhatsApp — ZapCobrança" }] }),
  component: () => (
    <PrivateRoute>
      <AppShell title="WhatsApp">
        <PageHeader
          title="WhatsApp"
          subtitle="Conecte sua instância e envie cobranças automáticas."
        />
        <div className="bg-card rounded-xl border">
          <EmptyState
            icon={MessageCircle}
            title="WhatsApp não conectado"
            subtitle="Configure sua instância da Evolution API em Configurações."
          />
        </div>
      </AppShell>
    </PrivateRoute>
  ),
});
