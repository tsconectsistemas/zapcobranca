import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { MessageCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { unmaskDigits } from "@/lib/masks";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface SendWhatsAppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  defaultWhatsapp: string;
  defaultMessage: string;
  onSent?: () => void;
}

export function SendWhatsAppModal({
  open,
  onOpenChange,
  customerId,
  defaultWhatsapp,
  defaultMessage,
  onSent,
}: SendWhatsAppModalProps) {
  const { tenant } = useAuth();
  const [whatsapp, setWhatsapp] = useState(defaultWhatsapp);
  const [message, setMessage] = useState(defaultMessage);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setWhatsapp(defaultWhatsapp);
      setMessage(defaultMessage);
    }
  }, [open, defaultWhatsapp, defaultMessage]);

  const handleSend = async () => {
    if (!tenant) return;
    const digits = unmaskDigits(whatsapp);
    if (digits.length < 10) {
      toast.error("Número de WhatsApp inválido");
      return;
    }
    setSending(true);
    try {
      const intl = digits.startsWith("55") ? digits : `55${digits}`;
      const url = `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
      window.open(url, "_blank", "noopener,noreferrer");

      const { error } = await supabase.from("notifications").insert({
        tenant_id: tenant.id,
        customer_id: customerId,
        type: "manual",
        message,
        whatsapp_number: digits,
        success: true,
      });
      if (error) throw error;

      toast.success("Mensagem registrada no histórico");
      onSent?.();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao registrar notificação");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar cobrança via WhatsApp</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">WhatsApp</Label>
            <Input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="(11) 99999-9999"
              inputMode="tel"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Mensagem</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={12}
              className="text-sm"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            A mensagem será registrada no histórico de notificações.
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleSend} disabled={sending}>
            <MessageCircle className="mr-2 h-4 w-4" />
            {sending ? "Enviando..." : "Enviar via WhatsApp"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
