import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  MessageCircle,
  MoreVertical,
  Pencil,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { PrivateRoute } from "@/components/PrivateRoute";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CustomerModal,
  type CustomerFormData,
} from "@/components/CustomerModal";
import { ManualRenewalModal } from "@/components/ManualRenewalModal";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/clientes/")({
  head: () => ({ meta: [{ title: "Clientes — ZapCobrança" }] }),
  component: ClientesPage,
});

interface CustomerListItem {
  id: string;
  username: string;
  name: string | null;
  whatsapp: string | null;
  monthly_value: number | null;
  expiration_date: string | null;
  status: string | null;
  screens: number | null;
  plan: string | null;
  password_iptv: string | null;
  pix_emv_payload: string | null;
  asaas_customer_id: string | null;
  notes: string | null;
}

type FilterId =
  | "all"
  | "active"
  | "expiring_today"
  | "expiring_3"
  | "expired"
  | "suspended";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "active", label: "Ativos" },
  { id: "expiring_today", label: "Vencendo hoje" },
  { id: "expiring_3", label: "Vencendo em 3 dias" },
  { id: "expired", label: "Expirados" },
  { id: "suspended", label: "Suspensos" },
];

type SortKey = "exp_asc" | "exp_desc" | "name_asc" | "value_desc";

const PAGE_SIZE = 20;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function diffDays(target: string | null): number | null {
  if (!target) return null;
  const [y, m, d] = target.split("-").map(Number);
  if (!y || !m || !d) return null;
  const t = startOfDay(new Date(y, m - 1, d));
  const today = startOfDay(new Date());
  return Math.round((t.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function expirationLabel(date: string | null): string {
  const d = diffDays(date);
  if (d === null) return "Sem vencimento";
  if (d === 0) return "Vence hoje";
  if (d === 1) return "Vence em 1 dia";
  if (d > 1) return `Vence em ${d} dias`;
  if (d === -1) return "Venceu há 1 dia";
  return `Venceu há ${Math.abs(d)} dias`;
}

function expirationTone(date: string | null, status: string | null) {
  const d = diffDays(date);
  if (status === "suspended") return "muted" as const;
  if (d === null) return "muted" as const;
  if (d < 0) return "expired" as const;
  if (d === 0) return "today" as const;
  if (d <= 3) return "soon" as const;
  return "normal" as const;
}

function effectiveStatus(c: CustomerListItem): FilterId {
  if (c.status === "suspended") return "suspended";
  const d = diffDays(c.expiration_date);
  if (d === null) return c.status === "active" ? "active" : "suspended";
  if (d < 0) return "expired";
  if (d === 0) return "expiring_today";
  if (d <= 3) return "expiring_3";
  return "active";
}

function initialsOf(c: CustomerListItem) {
  const src = c.name?.trim() || c.username;
  const parts = src.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}

function formatMoney(v: number | null) {
  if (v === null) return "—";
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

function ClientesPage() {
  const { tenant } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<FilterId>>(
    new Set(["all"])
  );
  const [sort, setSort] = useState<SortKey>("exp_asc");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerFormData | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<CustomerListItem | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);
  const [renewalCustomer, setRenewalCustomer] = useState<CustomerListItem | null>(null);

  const load = async () => {
    if (!tenant) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select(
        "id, username, name, whatsapp, monthly_value, expiration_date, status, screens, plan, password_iptv, pix_emv_payload, notes"
      )
      .eq("tenant_id", tenant.id)
      .order("username")
      .limit(2000);
    if (error) {
      toast.error("Erro ao carregar clientes");
      setLoading(false);
      return;
    }
    setCustomers((data ?? []) as CustomerListItem[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id]);

  const toggleFilter = (id: FilterId) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (id === "all") return new Set<FilterId>(["all"]);
      next.delete("all");
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) next.add("all");
      return next;
    });
    setPage(1);
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    let list = customers.filter((c) => {
      if (s) {
        const hay = `${c.name ?? ""} ${c.username} ${c.whatsapp ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      if (activeFilters.has("all")) return true;
      const eff = effectiveStatus(c);
      return activeFilters.has(eff);
    });

    list = [...list].sort((a, b) => {
      switch (sort) {
        case "exp_asc":
          return (a.expiration_date ?? "9999").localeCompare(
            b.expiration_date ?? "9999"
          );
        case "exp_desc":
          return (b.expiration_date ?? "0000").localeCompare(
            a.expiration_date ?? "0000"
          );
        case "name_asc":
          return (a.name ?? a.username).localeCompare(b.name ?? b.username);
        case "value_desc":
          return (b.monthly_value ?? 0) - (a.monthly_value ?? 0);
      }
    });
    return list;
  }, [customers, search, activeFilters, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const startIdx = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(currentPage * PAGE_SIZE, filtered.length);

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (c: CustomerListItem) => {
    setEditing({
      id: c.id,
      name: c.name,
      whatsapp: c.whatsapp,
      username: c.username,
      password_iptv: c.password_iptv,
      screens: c.screens ?? 1,
      plan: c.plan,
      monthly_value: c.monthly_value,
      expiration_date: c.expiration_date,
      status: c.status ?? "active",
      pix_emv_payload: c.pix_emv_payload,
      asaas_customer_id: c.asaas_customer_id,
      notes: c.notes,
    });
    setModalOpen(true);
  };

  const sendWhatsApp = (c: CustomerListItem) => {
    if (!c.whatsapp) {
      toast.error("Cliente sem WhatsApp cadastrado");
      return;
    }
    const digits = c.whatsapp.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("WhatsApp inválido");
      return;
    }
    const phone = digits.startsWith("55") ? digits : `55${digits}`;
    const message = `Olá ${c.name ?? c.username}, tudo bem?`;
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
  };

  const suspend = async (c: CustomerListItem) => {
    const newStatus = c.status === "suspended" ? "active" : "suspended";
    const { error } = await supabase
      .from("customers")
      .update({ status: newStatus })
      .eq("id", c.id);
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    toast.success(
      newStatus === "suspended" ? "Cliente suspenso" : "Cliente reativado"
    );
    load();
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", confirmDelete.id);
    setDeleting(false);
    if (error) {
      toast.error("Erro ao excluir cliente");
      return;
    }
    toast.success("Cliente excluído");
    setConfirmDelete(null);
    load();
  };

  const isEmpty = !loading && customers.length === 0;
  const isSearchEmpty = !loading && customers.length > 0 && filtered.length === 0;

  return (
    <PrivateRoute>
      <AppShell title="Clientes">
        <PageHeader
          title="Clientes"
          subtitle="Gerencie seus assinantes IPTV."
          action={
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/clientes/importar">
                  <Upload className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Importar XLSX</span>
                  <span className="sm:hidden">Importar</span>
                </Link>
              </Button>
              <Button size="sm" onClick={openNew}>
                <UserPlus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Novo cliente</span>
                <span className="sm:hidden">Novo</span>
              </Button>
            </div>
          }
        />

        {/* Filters bar */}
        <div className="space-y-3 mb-4">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nome, usuário ou WhatsApp..."
            className="max-w-md"
          />

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex gap-2 overflow-x-auto pb-1 flex-1">
              {FILTERS.map((f) => {
                const active = activeFilters.has(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggleFilter(f.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors",
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exp_asc">Vencimento ↑</SelectItem>
                <SelectItem value="exp_desc">Vencimento ↓</SelectItem>
                <SelectItem value="name_asc">Nome A–Z</SelectItem>
                <SelectItem value="value_desc">Valor ↓</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <LoadingSpinner label="Carregando clientes..." />
        ) : isEmpty ? (
          <div className="bg-card border rounded-xl">
            <EmptyState
              icon={Users}
              title="Nenhum cliente cadastrado"
              subtitle="Importe sua planilha IPTV ou adicione manualmente."
              action={
                <div className="flex gap-2">
                  <Button asChild variant="outline">
                    <Link to="/clientes/importar">
                      <Upload className="mr-2 h-4 w-4" />
                      Importar XLSX
                    </Link>
                  </Button>
                  <Button onClick={openNew}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Adicionar cliente
                  </Button>
                </div>
              }
            />
          </div>
        ) : isSearchEmpty ? (
          <div className="bg-card border rounded-xl">
            <EmptyState
              title="Nenhum cliente encontrado"
              subtitle={
                search
                  ? `Sem resultados para "${search}"`
                  : "Ajuste os filtros e tente novamente."
              }
            />
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {pageItems.map((c) => (
                <CustomerCard
                  key={c.id}
                  customer={c}
                  onView={() =>
                    navigate({ to: "/clientes/$id", params: { id: c.id } })
                  }
                  onEdit={() => openEdit(c)}
                  onWhatsApp={() => sendWhatsApp(c)}
                  onSuspend={() => suspend(c)}
                  onDelete={() => setConfirmDelete(c)}
                  onRenew={() => setRenewalCustomer(c)}
                />
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block bg-card border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium">Cliente</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Vencimento</th>
                      <th className="px-3 py-2 font-medium">Telas</th>
                      <th className="px-3 py-2 font-medium">Valor</th>
                      <th className="px-3 py-2 font-medium w-32 text-right">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((c) => (
                      <CustomerRow
                        key={c.id}
                        customer={c}
                        onView={() =>
                          navigate({
                            to: "/clientes/$id",
                            params: { id: c.id },
                          })
                        }
                        onEdit={() => openEdit(c)}
                        onWhatsApp={() => sendWhatsApp(c)}
                        onSuspend={() => suspend(c)}
                        onDelete={() => setConfirmDelete(c)}
                        onRenew={() => setRenewalCustomer(c)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 text-sm">
              <p className="text-muted-foreground">
                Mostrando {startIdx}-{endIdx} de {filtered.length} clientes
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        <CustomerModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          initial={editing}
          onSaved={load}
        />

        <ManualRenewalModal
          open={Boolean(renewalCustomer)}
          onOpenChange={(o) => !o && setRenewalCustomer(null)}
          customer={renewalCustomer}
          onDone={load}
        />

        <ConfirmDialog
          open={Boolean(confirmDelete)}
          onOpenChange={(o) => !o && setConfirmDelete(null)}
          title="Excluir cliente"
          description={
            confirmDelete
              ? `Tem certeza que deseja excluir ${
                  confirmDelete.name ?? confirmDelete.username
                }? Esta ação não pode ser desfeita.`
              : undefined
          }
          confirmLabel="Excluir"
          variant="destructive"
          loading={deleting}
          onConfirm={doDelete}
        />
      </AppShell>
    </PrivateRoute>
  );
}

interface RowActions {
  onView: () => void;
  onEdit: () => void;
  onWhatsApp: () => void;
  onSuspend: () => void;
  onDelete: () => void;
  onRenew: () => void;
}

function ExpirationText({
  date,
  status,
}: {
  date: string | null;
  status: string | null;
}) {
  const tone = expirationTone(date, status);
  return (
    <span
      className={cn(
        "text-xs",
        tone === "expired" && "text-destructive font-medium",
        tone === "today" && "text-destructive font-medium",
        tone === "soon" && "text-warning-foreground font-medium",
        tone === "normal" && "text-muted-foreground",
        tone === "muted" && "text-muted-foreground"
      )}
    >
      {expirationLabel(date)}
    </span>
  );
}

function StatusPill({
  customer,
}: {
  customer: CustomerListItem;
}) {
  const eff = effectiveStatus(customer);
  const map: Record<FilterId, { label: string; cls: string }> = {
    all: { label: "—", cls: "" },
    active: {
      label: "Ativo",
      cls: "bg-accent text-accent-foreground",
    },
    expired: {
      label: "Expirado",
      cls: "bg-destructive/15 text-destructive",
    },
    expiring_today: {
      label: "Vence hoje",
      cls: "bg-destructive/15 text-destructive",
    },
    expiring_3: {
      label: "Vencendo",
      cls: "bg-warning/20 text-warning-foreground",
    },
    suspended: {
      label: "Suspenso",
      cls: "bg-muted text-muted-foreground",
    },
  };
  const cfg = map[eff];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        cfg.cls
      )}
    >
      {cfg.label}
    </span>
  );
}

function ActionMenu({
  customer,
  onEdit,
  onSuspend,
  onDelete,
  onRenew,
}: {
  customer: CustomerListItem;
  onEdit: () => void;
  onSuspend: () => void;
  onDelete: () => void;
  onRenew: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onRenew}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Renovar Manual
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSuspend}>
          {customer.status === "suspended" ? "Reativar" : "Suspender"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CustomerCard({
  customer,
  onView,
  onEdit,
  onWhatsApp,
  onSuspend,
  onDelete,
  onRenew,
}: { customer: CustomerListItem } & RowActions) {
  const tone = expirationTone(customer.expiration_date, customer.status);
  return (
    <div
      className={cn(
        "bg-card border rounded-xl p-3 flex gap-3",
        tone === "expired" && "bg-destructive/5 border-destructive/30"
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
        {initialsOf(customer)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">
              {customer.name ?? customer.username}
            </p>
            <p className="text-[11px] font-mono text-muted-foreground truncate">
              {customer.username}
            </p>
          </div>
          <StatusPill customer={customer} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <ExpirationText
            date={customer.expiration_date}
            status={customer.status}
          />
          <span>
            {customer.screens ?? 1} {customer.screens === 1 ? "tela" : "telas"}
          </span>
          <span>{formatMoney(customer.monthly_value)}</span>
        </div>
        <div className="mt-2 flex justify-end gap-1">
          <Button size="icon" variant="ghost" onClick={onView}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onWhatsApp}>
            <MessageCircle className="h-4 w-4 text-primary" />
          </Button>
          <ActionMenu
            customer={customer}
            onEdit={onEdit}
            onSuspend={onSuspend}
            onDelete={onDelete}
            onRenew={onRenew}
          />
        </div>
      </div>
    </div>
  );
}

function CustomerRow({
  customer,
  onView,
  onEdit,
  onWhatsApp,
  onSuspend,
  onDelete,
  onRenew,
}: { customer: CustomerListItem } & RowActions) {
  const tone = expirationTone(customer.expiration_date, customer.status);
  return (
    <tr
      className={cn(
        "border-t",
        tone === "expired" && "bg-destructive/5"
      )}
    >
      <td className="px-3 py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
            {initialsOf(customer)}
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate">
              {customer.name ?? customer.username}
            </p>
            <p className="text-[11px] font-mono text-muted-foreground truncate">
              {customer.username}
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2">
        <StatusPill customer={customer} />
      </td>
      <td className="px-3 py-2">
        <ExpirationText
          date={customer.expiration_date}
          status={customer.status}
        />
      </td>
      <td className="px-3 py-2 text-muted-foreground">
        {customer.screens ?? 1}
      </td>
      <td className="px-3 py-2">{formatMoney(customer.monthly_value)}</td>
      <td className="px-3 py-2">
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" onClick={onView}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onWhatsApp}>
            <MessageCircle className="h-4 w-4 text-primary" />
          </Button>
          <ActionMenu
            customer={customer}
            onEdit={onEdit}
            onSuspend={onSuspend}
            onDelete={onDelete}
          />
        </div>
      </td>
    </tr>
  );
}
