import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/clientes/")({
  head: () => ({ meta: [{ title: "Clientes — ZapCobrança" }] }),
  component: () => (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Clientes</h1>
      <p className="text-muted-foreground mt-2">Em breve.</p>
    </div>
  ),
});
