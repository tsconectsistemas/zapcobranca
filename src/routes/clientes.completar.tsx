import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { PrivateRoute } from "@/components/PrivateRoute";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/clientes/completar")({
  head: () => ({ meta: [{ title: "Completar clientes — ZapCobrança" }] }),
  component: CompletarPage,
});

interface CustomerRow {
  id: string;
  username: string;
  name: string | null;
  whatsapp: string | null;
  monthly_value: number | null;
  expiration_date: string | null;
}

type FilterTab = "all" | "whatsapp" | "value" | "name";

const TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "Todos incompletos" },
  { id: "whatsapp", label: "Faltando WhatsApp" },
  { id: "value", label: "Faltando Valor" },
  { id: "name", label: "Faltando Nome" },
];

function isIncomplete(c: CustomerRow): boolean {
  return !c.name || !c.whatsapp || c.monthly_value === null;
}

function CompletarPage() {
  const { tenant } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkValue, setBulkValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!tenant) return;
    const load = async () => {
      setLoading(true);
      const [{ data, error }, { count }] = await Promise.all([
        supabase
          .from("customers")
          .select("id, username, name, whatsapp, monthly_value, expiration_date")
          .eq("tenant_id", tenant.id)
          .order("username")
          .limit(2000),
        supabase
          .from("customers")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id),
      ]);
      if (error) {
        toast.error("Erro ao carregar clientes");
        setLoading(false);
        return;
      }
      setCustomers((data ?? []) as CustomerRow[]);
      setTotalCount(count ?? 0);
      setLoading(false);
    };
    load();
  }, [tenant]);

  const incomplete = useMemo(
    () => customers.filter(isIncomplete),
    [customers]
  );

  const filtered = useMemo(() => {
    switch (tab) {
      case "whatsapp":
        return incomplete.filter((c) => !c.whatsapp);
      case "value":
        return incomplete.filter((c) => c.monthly_value === null);
      case "name":
        return incomplete.filter((c) => !c.name);
      default:
        return incomplete;
    }
  }, [incomplete, tab]);

  const completeCount = totalCount - incomplete.length;
  const pct =
    totalCount === 0 ? 100 : Math.round((completeCount / totalCount) * 100);

  const updateField = async (
    id: string,
    field: "name" | "whatsapp" | "monthly_value",
    value: string | number | null
  ) => {
    setSavingId(id);
    const { error } = await supabase
      .from("customers")
      .update({ [field]: value })
      .eq("id", id);
    setSavingId(null);
    if (error) {
      toast.error("Erro ao salvar");
      return false;
    }
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
    return true;
  };

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(filtered.map((c) => c.id)));
    } else {
      setSelected(new Set());
    }
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const applyBulkValue = async () => {
    const cleaned = bulkValue.replace(",", ".").trim();
    const num = parseFloat(cleaned);
    if (Number.isNaN(num) || num < 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase
      .from("customers")
      .update({ monthly_value: num })
      .in("id", ids);
    if (error) {
      toast.error("Erro ao aplicar valor");
      return;
    }
    setCustomers((prev) =>
      prev.map((c) =>
        selected.has(c.id) ? { ...c, monthly_value: num } : c
      )
    );
    toast.success(`${ids.length} cliente(s) atualizado(s)`);
    setSelected(new Set());
    setBulkValue("");
  };

  return (
    <PrivateRoute>
      <AppShell title="Completar clientes">
        <PageHeader
          title="Completar dados dos clientes"
          subtitle={`${incomplete.length} cliente(s) precisam de atenção`}
        />

        <div className="bg-card border rounded-xl p-4 mb-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Clientes completos: {completeCount} / {totalCount}
            </span>
            <span className="font-medium">{pct}%</span>
          </div>
          <Progress value={pct} />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-colors",
                tab === t.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {selected.size > 0 && (
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm font-medium">
              {selected.size} cliente(s) selecionado(s)
            </span>
            <div className="flex flex-1 gap-2 sm:justify-end items-center">
              <div className="flex items-center gap-1">
                <span className="text-sm">R$</span>
                <Input
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  placeholder="0,00"
                  className="w-24 h-8"
                />
              </div>
              <Button size="sm" onClick={applyBulkValue}>
                Aplicar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelected(new Set())}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <LoadingSpinner label="Carregando clientes..." />
        ) : filtered.length === 0 ? (
          <div className="bg-card border rounded-xl">
            <EmptyState
              title="Tudo em dia!"
              subtitle="Nenhum cliente com dados incompletos neste filtro."
            />
          </div>
        ) : (
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="px-3 py-2 w-8">
                      <Checkbox
                        checked={
                          filtered.length > 0 &&
                          filtered.every((c) => selected.has(c.id))
                        }
                        onCheckedChange={(v) => toggleAll(v === true)}
                      />
                    </th>
                    <th className="px-3 py-2 font-medium">Usuário</th>
                    <th className="px-3 py-2 font-medium">Nome</th>
                    <th className="px-3 py-2 font-medium">WhatsApp</th>
                    <th className="px-3 py-2 font-medium">Valor mensal</th>
                    <th className="px-3 py-2 font-medium">Vencimento</th>
                    <th className="px-3 py-2 font-medium w-12">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <CustomerEditRow
                      key={c.id}
                      customer={c}
                      selected={selected.has(c.id)}
                      saving={savingId === c.id}
                      onToggle={(v) => toggleOne(c.id, v)}
                      onUpdate={(field, value) => updateField(c.id, field, value)}
                      onView={() =>
                        navigate({
                          to: "/clientes/$id",
                          params: { id: c.id },
                        })
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </AppShell>
    </PrivateRoute>
  );
}

function CustomerEditRow({
  customer,
  selected,
  saving,
  onToggle,
  onUpdate,
  onView,
}: {
  customer: CustomerRow;
  selected: boolean;
  saving: boolean;
  onToggle: (v: boolean) => void;
  onUpdate: (
    field: "name" | "whatsapp" | "monthly_value",
    value: string | number | null
  ) => Promise<boolean>;
  onView: () => void;
}) {
  const [savedField, setSavedField] = useState<string | null>(null);

  const handleSave = async (
    field: "name" | "whatsapp" | "monthly_value",
    raw: string
  ) => {
    let value: string | number | null = raw.trim();
    if (field === "monthly_value") {
      if (value === "") value = null;
      else {
        const n = parseFloat(String(value).replace(",", "."));
        value = Number.isNaN(n) ? null : n;
      }
    } else if (value === "") {
      value = null;
    }
    const current =
      field === "monthly_value"
        ? customer.monthly_value
        : (customer[field] as string | null);
    if (String(current ?? "") === String(value ?? "")) return;
    const ok = await onUpdate(field, value);
    if (ok) {
      setSavedField(field);
      setTimeout(() => setSavedField(null), 1500);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  return (
    <tr className="border-t">
      <td className="px-3 py-2">
        <Checkbox
          checked={selected}
          onCheckedChange={(v) => onToggle(v === true)}
        />
      </td>
      <td className="px-3 py-2 font-mono text-xs">{customer.username}</td>
      <td className="px-3 py-2">
        <EditableCell
          initial={customer.name ?? ""}
          placeholder="Nome"
          onSave={(v) => handleSave("name", v)}
          saved={savedField === "name"}
        />
      </td>
      <td className="px-3 py-2">
        <EditableCell
          initial={customer.whatsapp ?? ""}
          placeholder="(99) 99999-9999"
          onSave={(v) => handleSave("whatsapp", v)}
          saved={savedField === "whatsapp"}
        />
      </td>
      <td className="px-3 py-2">
        <EditableCell
          initial={
            customer.monthly_value === null
              ? ""
              : customer.monthly_value.toFixed(2).replace(".", ",")
          }
          placeholder="0,00"
          onSave={(v) => handleSave("monthly_value", v)}
          saved={savedField === "monthly_value"}
        />
      </td>
      <td className="px-3 py-2 text-muted-foreground">
        {formatDate(customer.expiration_date)}
      </td>
      <td className="px-3 py-2">
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Button size="icon" variant="ghost" onClick={onView}>
            <Eye className="h-4 w-4" />
          </Button>
        )}
      </td>
    </tr>
  );
}

function EditableCell({
  initial,
  placeholder,
  onSave,
  saved,
}: {
  initial: string;
  placeholder: string;
  onSave: (value: string) => void | Promise<void>;
  saved: boolean;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    setValue(initial);
  }, [initial]);

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onSave(value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={cn(
          "w-full bg-transparent border border-transparent hover:border-input focus:border-primary rounded px-2 py-1 text-sm outline-none transition-colors",
          !value && "bg-warning/10"
        )}
      />
      {saved && <span className="text-xs text-primary">✓</span>}
    </div>
  );
}
