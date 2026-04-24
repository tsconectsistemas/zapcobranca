import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { usePlanLimits } from "@/hooks/usePlanLimits";

/**
 * Sticky yellow banner shown when usage >= 80% of plan limit.
 * Mount near the top of authenticated pages (or inside AppShell).
 */
export function PlanUsageBanner() {
  const { isNearLimit, currentCount, maxCount, planName, isExpired } = usePlanLimits();

  if (isExpired) {
    return (
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Seu plano {planName} expirou. Renove para reativar todos os recursos.
        </span>
        <Link to="/planos" className="font-semibold underline-offset-2 hover:underline">
          Ver planos →
        </Link>
      </div>
    );
  }

  if (!isNearLimit) return null;

  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-amber-300/60 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200">
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        Você está usando {currentCount} de {maxCount} clientes disponíveis. Faça upgrade para
        continuar crescendo.
      </span>
      <Link to="/planos" className="font-semibold underline-offset-2 hover:underline">
        Upgrade →
      </Link>
    </div>
  );
}
