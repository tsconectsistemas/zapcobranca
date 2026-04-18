import { createFileRoute } from "@tanstack/react-router";
import { UserPlus, Users } from "lucide-react";
import { PrivateRoute } from "@/components/PrivateRoute";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/clientes/")({
  head: () => ({ meta: [{ title: "Clientes — ZapCobrança" }] }),
  component: () => (
    <PrivateRoute>
      <AppShell title="Clientes">
        <PageHeader
          title="Clientes"
          subtitle="Gerencie seus assinantes IPTV."
          action={
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Novo cliente
            </Button>
          }
        />
        <div className="bg-card rounded-xl border">
          <EmptyState
            icon={Users}
            title="Nenhum cliente cadastrado"
            subtitle="Comece adicionando seu primeiro cliente ou importando uma planilha."
          />
        </div>
      </AppShell>
    </PrivateRoute>
  ),
});
