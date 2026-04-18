import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — ZapCobrança" }] }),
  component: () => (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Configurações</h1>
      <p className="text-muted-foreground mt-2">Em breve.</p>
    </div>
  ),
});
