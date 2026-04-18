import { cn } from "@/lib/utils";

export type CustomerStatus =
  | "active"
  | "expired"
  | "expiring_soon"
  | "suspended";

const STATUS_MAP: Record<
  CustomerStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Ativo",
    className: "bg-accent text-accent-foreground",
  },
  expired: {
    label: "Expirado",
    className: "bg-destructive/10 text-destructive",
  },
  expiring_soon: {
    label: "Vencendo",
    className: "bg-warning/15 text-warning-foreground",
  },
  suspended: {
    label: "Suspenso",
    className: "bg-muted text-muted-foreground",
  },
};

interface StatusBadgeProps {
  status: CustomerStatus | string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config =
    STATUS_MAP[status as CustomerStatus] ?? STATUS_MAP.suspended;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
