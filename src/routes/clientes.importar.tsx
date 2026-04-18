import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/clientes/importar")({
  head: () => ({ meta: [{ title: "Importar clientes — ZapCobrança" }] }),
  component: () => (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Importar clientes</h1>
      <p className="text-muted-foreground mt-2">Em breve.</p>
    </div>
  ),
});
