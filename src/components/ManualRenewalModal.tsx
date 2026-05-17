import { useState } from "react";
import { addMonths, addDays, format, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import toast from "react-hot-toast";
import { RefreshCw } from "lucide-react";

interface ManualRenewalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: {
    id: string;
    name: string | null;
    username: string;
    expiration_date: string | null;
    monthly_value: number | null;
  } | null;
  onDone: () => void;
}

export function ManualRenewalModal({
  open,
  onOpenChange,
  customer,
  onDone,
}: ManualRenewalModalProps) {
  const { tenant } = useAuth();
  const [months, setMonths] = useState("1");
  const [loading, setLoading] = useState(false);

  if (!customer) return null;

  const handleRenew = async () => {
    if (!tenant || !customer) return;
    setLoading(true);

    try {
      const currentExp = customer.expiration_date
        ? parseISO(customer.expiration_date)
        : new Date();
      
      // If already expired, start from today
      const baseDate = currentExp < new Date() ? new Date() : currentExp;
      const newExp = addMonths(baseDate, parseInt(months));
      const newExpStr = format(newExp, "yyyy-MM-dd");

      // 1. Update customer
      const { error: custErr } = await supabase
        .from("customers")
        .update({
          expiration_date: newExpStr,
          status: "active",
        })
        .eq("id", customer.id);

      if (custErr) throw custErr;

      // 2. Register payment
      const { error: payErr } = await supabase.from("payments").insert({
        tenant_id: tenant.id,
        customer_id: customer.id,
        amount: (customer.monthly_value || 0) * parseInt(months),
        paid_at: new Date().toISOString(),
        previous_expiration: customer.expiration_date,
        new_expiration: newExpStr,
        raw_webhook: { manual: true, reason: "Manual renewal by owner" },
      });

      if (payErr) {
        console.error("Error registering payment record:", payErr);
        // We don't throw here because the customer was already updated successfully
        // but it's good to know.
      }

      toast.success(`Cliente renovado até ${format(newExp, "dd/MM/yyyy")}`);
      onDone();
      onOpenChange(false);
    } catch (error) {
      console.error("Renewal error:", error);
      toast.error("Erro ao renovar cliente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Renovação Manual
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div>
            <p className="text-sm font-medium">Cliente</p>
            <p className="text-sm text-muted-foreground">
              {customer.name || customer.username} ({customer.username})
            </p>
          </div>

          <div className="space-y-2">
            <Label>Período de renovação</Label>
            <Select value={months} onValueChange={setMonths}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Mês (30 dias)</SelectItem>
                <SelectItem value="2">2 Meses (60 dias)</SelectItem>
                <SelectItem value="3">3 Meses (90 dias)</SelectItem>
                <SelectItem value="6">6 Meses</SelectItem>
                <SelectItem value="12">1 Ano</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground italic">
            * O vencimento será estendido a partir da data atual ou do vencimento atual (o que for maior).
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button onClick={handleRenew} disabled={loading}>
            {loading ? "Renovando..." : "Confirmar Pagamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
