import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/tenants/$id")({
  component: () => (
    <div className="bg-[#1A1D27] rounded-xl border border-white/5 p-8 text-center">
      <h1 className="text-xl font-bold text-white mb-2">Detalhes da Revenda</h1>
      <p className="text-gray-400">Em desenvolvimento.</p>
    </div>
  ),
});
