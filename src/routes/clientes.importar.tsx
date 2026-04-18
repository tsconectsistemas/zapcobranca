import { createFileRoute } from "@tanstack/react-router";
import { PrivateRoute } from "@/components/PrivateRoute";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/clientes/importar")({
  head: () => ({ meta: [{ title: "Importar clientes — ZapCobrança" }] }),
  component: () => (
    <PrivateRoute>
      <AppShell title="Importar clientes">
        <PageHeader
          title="Importar clientes"
          subtitle="Importe sua lista de clientes a partir de uma planilha XLSX ou CSV."
        />
        <div className="bg-card rounded-xl border p-6">
          <p className="text-sm text-muted-foreground">Em breve.</p>
        </div>
      </AppShell>
    </PrivateRoute>
  ),
});
