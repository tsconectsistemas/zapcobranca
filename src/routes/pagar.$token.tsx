import { createFileRoute } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/pagar/$token")({
  head: () => ({
    meta: [
      { title: "Pagar — ZapCobrança" },
      { name: "description", content: "Página de pagamento do cliente." },
    ],
  }),
  component: PagarPage,
});

function PagarPage() {
  const { token } = Route.useParams();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-6">
        <Logo size="md" />
        <h1 className="text-2xl font-semibold">Pagamento</h1>
        <p className="text-muted-foreground break-all">Token: {token}</p>
        <p className="text-muted-foreground">Tela em breve.</p>
      </div>
    </div>
  );
}
