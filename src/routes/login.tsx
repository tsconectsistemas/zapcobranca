import { createFileRoute } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — ZapCobrança" },
      { name: "description", content: "Acesse sua conta ZapCobrança." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-6">
        <Logo size="lg" />
        <h1 className="text-2xl font-semibold">Entrar</h1>
        <p className="text-muted-foreground">Tela de login em breve.</p>
      </div>
    </div>
  );
}
