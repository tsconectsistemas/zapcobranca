import { Zap } from "lucide-react";

interface LogoProps {
  showTagline?: boolean;
  size?: "sm" | "md" | "lg";
  dark?: boolean;
}

export function Logo({ showTagline = false, size = "md", dark = false }: LogoProps) {
  const sizes = {
    sm: { icon: "h-5 w-5", text: "text-lg", tagline: "text-[10px]" },
    md: { icon: "h-6 w-6", text: "text-xl", tagline: "text-xs" },
    lg: { icon: "h-8 w-8", text: "text-3xl", tagline: "text-sm" },
  };
  const s = sizes[size];

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <Zap className={`${s.icon} text-primary fill-primary`} />
        <span className={`${s.text} font-bold tracking-tight ${dark ? "text-white" : "text-foreground"}`}>
          Zap<span className="text-primary">Cobrança</span>
        </span>
      </div>
      {showTagline && (
        <span className={`${s.tagline} text-muted-foreground mt-1 ml-8`}>
          Gestão de cobranças para revendas IPTV
        </span>
      )}
    </div>
  );
}
