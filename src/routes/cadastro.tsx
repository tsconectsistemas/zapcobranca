import { createFileRoute } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Cadastro de revenda — ZapCobrança" },
      {
        name: "description",
        content: "Cadastre sua revenda IPTV na plataforma ZapCobrança.",
      },
    ],
  }),
  component: CadastroPage,
});

function CadastroPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-6">
        <Logo size="lg" />
        <h1 className="text-2xl font-semibold">Cadastrar revenda</h1>
        <p className="text-muted-foreground">Tela de cadastro em breve.</p>
      </div>
    </div>
  );
}
