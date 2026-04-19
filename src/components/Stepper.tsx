import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Step {
  id: number;
  label: string;
}

interface StepperProps {
  steps: Step[];
  current: number;
  className?: string;
}

export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol
      className={cn(
        "flex items-center w-full mb-6 text-sm font-medium",
        className
      )}
    >
      {steps.map((step, idx) => {
        const isDone = step.id < current;
        const isActive = step.id === current;
        return (
          <li
            key={step.id}
            className={cn(
              "flex items-center",
              idx < steps.length - 1 && "flex-1"
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border text-xs",
                  isDone &&
                    "bg-primary text-primary-foreground border-primary",
                  isActive &&
                    "border-primary text-primary bg-primary/10",
                  !isDone && !isActive && "border-border text-muted-foreground"
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : step.id}
              </span>
              <span
                className={cn(
                  "hidden sm:inline",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 mx-3 h-px",
                  isDone ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
