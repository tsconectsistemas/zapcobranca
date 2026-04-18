import { createFileRoute } from "@tanstack/react-router";
import { PrivateRoute } from "@/components/PrivateRoute";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ZapCobrança" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <PrivateRoute>
      <DashboardContent />
    </PrivateRoute>
  );
}

function DashboardContent() {
  const { tenant, user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <Logo size="sm" />
          <Button variant="outline" size="sm" onClick={signOut}>
            Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Olá, {tenant?.company_name ?? "revenda"} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {user?.email} · plano{" "}
            <span className="font-medium text-foreground">
              {tenant?.plan ?? "free"}
            </span>{" "}
            · limite de {tenant?.max_customers ?? 50} clientes
          </p>
        </div>

        <div className="bg-card rounded-xl border p-6">
          <p className="text-muted-foreground">
            Painel em construção. Em breve você verá métricas de cobranças e
            clientes aqui.
          </p>
        </div>
      </main>
    </div>
  );
}
