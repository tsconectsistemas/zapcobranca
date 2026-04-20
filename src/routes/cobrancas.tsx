import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DollarSign } from "lucide-react";
import { PrivateRoute } from "@/components/PrivateRoute";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/cobrancas")({
  head: () => ({ meta: [{ title: "Cobranças — ZapCobrança" }] }),
  component: CobrancasPage,
});

interface PaymentRow {
  id: string;
  amount: number | null;
  paid_at: string | null;
  previous_expiration: string | null;
  new_expiration: string | null;
  customer_id: string;
  customers: { id: string; name: string | null; username: string } | null;
}

function formatCurrency(v: number | null): string {
  return (v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function CobrancasPage() {
  const { tenant } = useAuth();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("payments")
        .select(
          "id, amount, paid_at, previous_expiration, new_expiration, customer_id, customers(id, name, username)",
        )
        .eq("tenant_id", tenant.id)
        .order("paid_at", { ascending: false })
        .limit(100);
      setPayments((data as unknown as PaymentRow[]) || []);
      setLoading(false);
    })();
  }, [tenant]);

  return (
    <PrivateRoute>
      <AppShell title="Cobranças">
        <PageHeader
          title="Cobranças"
          subtitle="Histórico de pagamentos confirmados via webhook do Asaas."
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pagamentos recentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : payments.length === 0 ? (
              <EmptyState
                icon={DollarSign}
                title="Nenhum pagamento recebido ainda"
                subtitle="Configure o webhook do Asaas em Configurações para começar a receber confirmações."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Pago em</TableHead>
                      <TableHead>Vencimento anterior</TableHead>
                      <TableHead>Novo vencimento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {p.customers ? (
                            <Link
                              to="/clientes/$id"
                              params={{ id: p.customers.id }}
                              className="hover:underline"
                            >
                              {p.customers.name || p.customers.username}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-emerald-600 font-semibold">
                          {formatCurrency(p.amount)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(p.paid_at)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(p.previous_expiration)}
                        </TableCell>
                        <TableCell>{formatDate(p.new_expiration)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </AppShell>
    </PrivateRoute>
  );
}
