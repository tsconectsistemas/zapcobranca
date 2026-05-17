import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parse } from "date-fns";
import { CalendarIcon, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { maskWhatsApp } from "@/lib/masks";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CustomerFormData {
  id?: string;
  name: string | null;
  whatsapp: string | null;
  username: string;
  password_iptv: string | null;
  screens: number;
  plan: string | null;
  monthly_value: number | null;
  expiration_date: string | null; // YYYY-MM-DD
  status: string;
  pix_emv_payload: string | null;
  asaas_customer_id: string | null;
  notes: string | null;
}

const schema = z.object({
  name: z.string().trim().max(120).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(20).optional().or(z.literal("")),
  username: z
    .string()
    .trim()
    .min(1, "Usuário é obrigatório")
    .max(80, "Máximo 80 caracteres"),
  password_iptv: z.string().trim().max(120).optional().or(z.literal("")),
  screens: z
    .number({ message: "Informe um número" })
    .int()
    .min(1, "Mínimo 1")
    .max(10, "Máximo 10"),
  plan: z.string().trim().max(60).optional().or(z.literal("")),
  monthly_value: z
    .number({ message: "Informe um valor" })
    .min(0)
    .max(100000)
    .nullable(),
  expiration_date: z.string().nullable(),
  status: z.enum(["active", "suspended", "cancelled"]),
  pix_emv_payload: z.string().trim().max(2000).optional().or(z.literal("")),
  asaas_customer_id: z.string().trim().max(100).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

type FormSchema = z.infer<typeof schema>;

interface CustomerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: CustomerFormData | null;
  onSaved: () => void;
}

export function CustomerModal({
  open,
  onOpenChange,
  initial,
  onSaved,
}: CustomerModalProps) {
  const { tenant } = useAuth();
  const isEdit = Boolean(initial?.id);
  const [showQr, setShowQr] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const defaults = useMemo<FormSchema>(
    () => ({
      name: initial?.name ?? "",
      whatsapp: initial?.whatsapp ?? "",
      username: initial?.username ?? "",
      password_iptv: initial?.password_iptv ?? "",
      screens: initial?.screens ?? 1,
      plan: initial?.plan ?? "",
      monthly_value: initial?.monthly_value ?? null,
      expiration_date: initial?.expiration_date ?? null,
      status: (initial?.status as FormSchema["status"]) ?? "active",
      pix_emv_payload: initial?.pix_emv_payload ?? "",
      asaas_customer_id: initial?.asaas_customer_id ?? "",
      notes: initial?.notes ?? "",
    }),
    [initial]
  );

  const form = useForm<FormSchema>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) form.reset(defaults);
  }, [open, defaults, form]);

  const pixPayload = form.watch("pix_emv_payload");

  const onSubmit = async (data: FormSchema) => {
    if (!tenant) return;
    setSubmitting(true);
    try {
      // Uniqueness check (tenant_id, username)
      const { data: existing, error: checkErr } = await supabase
        .from("customers")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("username", data.username.trim())
        .maybeSingle();

      if (checkErr) throw checkErr;
      if (existing && existing.id !== initial?.id) {
        form.setError("username", {
          message: "Já existe um cliente com este usuário",
        });
        setSubmitting(false);
        return;
      }

      const payload = {
        tenant_id: tenant.id,
        name: data.name?.trim() || null,
        whatsapp: data.whatsapp?.trim() || null,
        username: data.username.trim(),
        password_iptv: data.password_iptv?.trim() || null,
        screens: data.screens,
        plan: data.plan?.trim() || null,
        monthly_value: data.monthly_value,
        expiration_date: data.expiration_date,
        status: data.status,
        pix_emv_payload: data.pix_emv_payload?.trim() || null,
        asaas_customer_id: data.asaas_customer_id?.trim() || null,
        notes: data.notes?.trim() || null,
      };

      if (isEdit && initial?.id) {
        const { error } = await supabase
          .from("customers")
          .update(payload)
          .eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert(payload);
        if (error) throw error;
      }

      toast.success("Cliente salvo com sucesso!");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Erro ao salvar cliente";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const expirationDate = form.watch("expiration_date");
  const expirationAsDate = expirationDate
    ? parse(expirationDate, "yyyy-MM-dd", new Date())
    : undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Editar cliente" : "Novo cliente"}
            </DialogTitle>
          </DialogHeader>

          <form
            id="customer-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6 py-2"
          >
            {/* Dados pessoais */}
            <Section title="Dados pessoais">
              <Field label="Nome completo" error={form.formState.errors.name?.message}>
                <Input
                  {...form.register("name")}
                  placeholder="João da Silva"
                />
              </Field>
              <Field
                label="WhatsApp"
                error={form.formState.errors.whatsapp?.message}
                hint="Necessário para envio de notificações"
              >
                <Input
                  value={form.watch("whatsapp") ?? ""}
                  onChange={(e) =>
                    form.setValue("whatsapp", maskWhatsApp(e.target.value), {
                      shouldValidate: true,
                    })
                  }
                  placeholder="(11) 99999-9999"
                  inputMode="tel"
                />
              </Field>
            </Section>

            {/* Acesso IPTV */}
            <Section title="Acesso IPTV">
              <Field
                label="Usuário"
                required
                error={form.formState.errors.username?.message}
              >
                <Input
                  {...form.register("username")}
                  placeholder="usuario_iptv"
                  autoComplete="off"
                />
              </Field>
              <Field
                label="Senha IPTV"
                error={form.formState.errors.password_iptv?.message}
              >
                <Input
                  {...form.register("password_iptv")}
                  placeholder="senha"
                  autoComplete="off"
                />
              </Field>
              <Field
                label="Telas"
                required
                error={form.formState.errors.screens?.message}
              >
                <Input
                  type="number"
                  min={1}
                  max={10}
                  {...form.register("screens", { valueAsNumber: true })}
                />
              </Field>
              <Field label="Plano" error={form.formState.errors.plan?.message}>
                <Input {...form.register("plan")} placeholder="Premium" />
              </Field>
            </Section>

            {/* Cobrança */}
            <Section title="Cobrança">
              <Field
                label="Valor mensal (R$)"
                error={form.formState.errors.monthly_value?.message}
              >
                <Input
                  type="text"
                  inputMode="decimal"
                  value={
                    form.watch("monthly_value") === null
                      ? ""
                      : String(form.watch("monthly_value")).replace(".", ",")
                  }
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d,.-]/g, "");
                    if (raw === "") {
                      form.setValue("monthly_value", null);
                      return;
                    }
                    const n = parseFloat(raw.replace(",", "."));
                    form.setValue(
                      "monthly_value",
                      Number.isNaN(n) ? null : n,
                      { shouldValidate: true }
                    );
                  }}
                  placeholder="49,90"
                />
              </Field>
              <Field
                label="Data de vencimento"
                error={form.formState.errors.expiration_date?.message}
              >
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !expirationAsDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expirationAsDate
                        ? format(expirationAsDate, "dd/MM/yyyy")
                        : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expirationAsDate}
                      onSelect={(d) =>
                        form.setValue(
                          "expiration_date",
                          d ? format(d, "yyyy-MM-dd") : null
                        )
                      }
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </Field>
              <Field label="Status">
                <Select
                  value={form.watch("status")}
                  onValueChange={(v) =>
                    form.setValue("status", v as FormSchema["status"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="suspended">Suspenso</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </Section>

            {/* Integração Asaas */}
            <Section title="Integração Asaas" cols={2}>
              <Field
                label="ID do Cliente Asaas (cus_...)"
                hint="Use para vincular cobranças manuais do Sandbox"
                error={form.formState.errors.asaas_customer_id?.message}
              >
                <Input
                  {...form.register("asaas_customer_id")}
                  placeholder="cus_000000000000"
                />
              </Field>
              <div className="flex flex-col gap-2">
                <Field
                  label="Payload PIX EMV"
                  hint="Opcional se usar ID do Cliente"
                  error={form.formState.errors.pix_emv_payload?.message}
                >
                  <Input
                    {...form.register("pix_emv_payload")}
                    placeholder="000201..."
                  />
                </Field>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  disabled={!pixPayload?.trim()}
                  onClick={() => setShowQr(true)}
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  QR Code
                </Button>
              </div>
            </Section>

            {/* Observações */}
            <Section title="Observações" cols={1}>
              <Field label="Notas" error={form.formState.errors.notes?.message}>
                <Textarea
                  {...form.register("notes")}
                  rows={3}
                  placeholder="Informações adicionais sobre o cliente"
                />
              </Field>
            </Section>
          </form>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="customer-form"
              disabled={submitting}
            >
              {submitting ? "Salvando..." : "Salvar cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showQr} onOpenChange={setShowQr}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Code PIX</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            {pixPayload?.trim() ? (
              <>
                <div className="bg-white p-3 rounded-lg">
                  <QRCodeSVG value={pixPayload.trim()} size={220} />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Aponte a câmera do app do banco para pagar.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Cole um payload PIX para gerar o QR Code.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Section({
  title,
  children,
  cols = 2,
}: {
  title: string;
  children: React.ReactNode;
  cols?: 1 | 2;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground border-b pb-1">
        {title}
      </h3>
      <div
        className={cn(
          "grid gap-3",
          cols === 2 ? "sm:grid-cols-2" : "grid-cols-1"
        )}
      >
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {hint && !error && (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      )}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
