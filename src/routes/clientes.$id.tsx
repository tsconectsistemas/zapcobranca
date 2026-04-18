import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/clientes/$id")({
  head: () => ({ meta: [{ title: "Detalhes do cliente — ZapCobrança" }] }),
  component: ClienteDetalhes,
});

function ClienteDetalhes() {
  const { id } = Route.useParams();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Cliente {id}</h1>
      <p className="text-muted-foreground mt-2">Em breve.</p>
    </div>
  );
}
