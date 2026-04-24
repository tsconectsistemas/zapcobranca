import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PlanLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  maxCount: number | null;
}

export function PlanLimitModal({ open, onOpenChange, planName, maxCount }: PlanLimitModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Limite do plano atingido 🚫</DialogTitle>
          <DialogDescription>
            Você atingiu o limite de {maxCount ?? "—"} clientes do plano {planName}. Faça upgrade
            para continuar crescendo.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Agora não
          </Button>
          <Button asChild>
            <Link to="/planos">Ver planos</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
