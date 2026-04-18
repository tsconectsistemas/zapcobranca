import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZapCobrança — Gestão de cobranças para revendas IPTV" },
      {
        name: "description",
        content:
          "Plataforma de gestão de cobranças e assinaturas para revendedores de IPTV no Brasil.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="flex justify-center">
          <Logo size="lg" showTagline />
        </div>
        <p className="text-muted-foreground">
          Bem-vindo! O sistema está sendo configurado.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link to="/login">Entrar</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/cadastro">Cadastrar revenda</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
