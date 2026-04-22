import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PrivateRoute } from "@/components/PrivateRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/planos")({
  head: () => ({ meta: [{ title: "Planos — ZapCobrança" }] }),
  component: PlanosPage,
});

function PlanosPage() {
  return (
    <PrivateRoute>
      <AppShell title="Planos">
        <PageHeader
          title="Planos"
          subtitle="Escolha o plano ideal para crescer sua revenda."
        />
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Upgrade em breve</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Esta área está pronta para receber os planos Pro e Premium.
            </p>
            <Button asChild>
              <Link to="/configuracoes">Voltar para configurações</Link>
            </Button>
          </CardContent>
        </Card>
      </AppShell>
    </PrivateRoute>
  );
}