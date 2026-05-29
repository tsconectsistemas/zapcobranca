import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { PrivateRoute } from "@/components/PrivateRoute";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Stepper } from "@/components/Stepper";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  downloadTemplate,
  parseXlsxFile,
  type ImportRow,
} from "@/lib/xlsx-import";

export const Route = createFileRoute("/clientes/importar")({
  head: () => ({ meta: [{ title: "Importar clientes — ZapCobrança" }] }),
  component: ImportarPage,
});

type Step = 1 | 2 | 3;

type RowClassification = "new" | "update" | "unchanged";

interface ClassifiedRow extends ImportRow {
  _classification: RowClassification;
}

interface ImportResult {
  inserted: number;
  updated: number;
  errors: { row: number; message: string }[];
}

const STEPS = [
  { id: 1, label: "Upload" },
  { id: 2, label: "Revisão" },
  { id: 3, label: "Resultado" },
];

function ImportarPage() {
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<
    { row: number; message: string }[]
  >([]);
  const [classified, setClassified] = useState<ClassifiedRow[]>([]);
  const [classifying, setClassifying] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);

  const navigate = useNavigate();
  const { tenant } = useAuth();

  const handleFileSelected = useCallback(async (selected: File) => {
    setFile(selected);
    try {
      const { rows: parsed, errors } = await parseXlsxFile(selected);
      setRows(parsed);
      setParseErrors(errors);
      if (errors.length > 0) {
        toast.error(`${errors.length} linha(s) com erro de leitura`);
      } else {
        toast.success(`${parsed.length} linha(s) lida(s) com sucesso`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível ler a planilha");
      setRows([]);
    }
  }, []);

  const goToReview = useCallback(async () => {
    if (!tenant) return;
    setClassifying(true);
    try {
      const usernames = rows.map((r) => r.username);
      const { data: existing, error } = await supabase
        .from("customers")
        .select(
          "username, name, whatsapp, monthly_value, expiration_date, status, screens, plan, password_iptv, pix_emv_payload, notes, reseller_tag"
        )
        .eq("tenant_id", tenant.id)
        .in("username", usernames);

      if (error) throw error;

      const existingMap = new Map(
        (existing ?? []).map((c) => [c.username, c])
      );

      const out: ClassifiedRow[] = rows.map((r) => {
        const found = existingMap.get(r.username);
        if (!found) return { ...r, _classification: "new" };
        const fieldsToCompare: (keyof ImportRow)[] = [
          "name",
          "whatsapp",
          "monthly_value",
          "expiration_date",
          "status",
          "screens",
          "password_iptv",
          "pix_emv_payload",
          "notes",
          "reseller_tag",
        ];
        const changed = fieldsToCompare.some((f) => {
          const a = r[f] ?? null;
          const b = (found as Record<string, unknown>)[f as string] ?? null;
          return String(a ?? "") !== String(b ?? "");
        });
        return { ...r, _classification: changed ? "update" : "unchanged" };
      });

      setClassified(out);
      setStep(2);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao consultar clientes existentes");
    } finally {
      setClassifying(false);
    }
  }, [rows, tenant]);

  const runImport = useCallback(async () => {
    if (!tenant) return;
    setImporting(true);
    setStep(3);
    const toImport = classified.filter((r) => r._classification !== "unchanged");
    setProgress({ current: 0, total: toImport.length });

    const inserted = classified.filter((r) => r._classification === "new").length;
    const updated = classified.filter((r) => r._classification === "update").length;
    const errors: { row: number; message: string }[] = [];

    const BATCH = 50;
    for (let i = 0; i < toImport.length; i += BATCH) {
      const batch = toImport.slice(i, i + BATCH);
      
      // Deduplicate by username to avoid "ON CONFLICT DO UPDATE command cannot affect row a second time"
      const uniqueRows = new Map();
      batch.forEach(r => {
        uniqueRows.set(r.username, r);
      });

      const payload = Array.from(uniqueRows.values()).map((r) => ({
        tenant_id: tenant.id,
        username: r.username,
        password_iptv: r.password_iptv,
        expiration_date: r.expiration_date,
        status: r.status,
        screens: r.screens,
        iptv_created_at: r.iptv_created_at,
        last_access: r.last_access,
        notes: r.notes,
        reseller_tag: r.reseller_tag,
        pix_emv_payload: r.pix_emv_payload,
        whatsapp: r.whatsapp,
        monthly_value: r.monthly_value,
        name: r.name,
      }));

      const { error } = await supabase
        .from("customers")
        .upsert(payload, {
          onConflict: "tenant_id,username",
          ignoreDuplicates: false,
        });

      if (error) {
        batch.forEach((r) =>
          errors.push({ row: r._rowNumber, message: error.message })
        );
      }
      setProgress({ current: Math.min(i + BATCH, toImport.length), total: toImport.length });
    }

    setResult({
      inserted: inserted - errors.length / 2,
      updated,
      errors,
    });
    setImporting(false);

    if (errors.length === 0) {
      toast.success("Importação concluída!");
    } else {
      toast.error(`Importação concluída com ${errors.length} erro(s)`);
    }
  }, [classified, tenant]);

  const reset = useCallback(() => {
    setStep(1);
    setFile(null);
    setRows([]);
    setParseErrors([]);
    setClassified([]);
    setResult(null);
    setProgress({ current: 0, total: 0 });
  }, []);

  return (
    <PrivateRoute>
      <AppShell title="Importar clientes">
        <PageHeader
          title="Importar clientes"
          subtitle="Importe sua lista de clientes a partir de uma planilha XLSX."
        />
        <Stepper steps={STEPS} current={step} />

        {step === 1 && (
          <UploadStep
            file={file}
            rows={rows}
            parseErrors={parseErrors}
            onFileSelected={handleFileSelected}
            onContinue={goToReview}
            classifying={classifying}
          />
        )}

        {step === 2 && (
          <ReviewStep
            rows={classified}
            onBack={() => setStep(1)}
            onConfirm={runImport}
          />
        )}

        {step === 3 && (
          <ResultStep
            importing={importing}
            progress={progress}
            result={result}
            onAnother={reset}
            onComplete={() => navigate({ to: "/clientes/completar" })}
            onSeeAll={() => navigate({ to: "/clientes" })}
          />
        )}
      </AppShell>
    </PrivateRoute>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function UploadStep({
  file,
  rows,
  parseErrors,
  onFileSelected,
  onContinue,
  classifying,
}: {
  file: File | null;
  rows: ImportRow[];
  parseErrors: { row: number; message: string }[];
  onFileSelected: (f: File) => void;
  onContinue: () => void;
  classifying: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) onFileSelected(f);
    },
    [onFileSelected]
  );

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "bg-card border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border"
        )}
      >
        <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-base font-medium text-foreground">
          Arraste seu arquivo XLSX aqui
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          ou clique para selecionar
        </p>
        <p className="text-xs text-muted-foreground mt-3">
          Formatos aceitos: .xlsx, .xls
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFileSelected(f);
          }}
        />
      </div>

      <div className="flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            downloadTemplate();
          }}
        >
          <Download className="mr-2 h-4 w-4" />
          Baixar modelo de planilha
        </Button>
      </div>

      {file && (
        <div className="bg-card border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(file.size)} • {rows.length} linha(s) detectada(s)
              </p>
            </div>
            <Upload className="h-5 w-5 text-primary shrink-0" />
          </div>

          {parseErrors.length > 0 && (
            <div className="text-xs text-destructive bg-destructive/10 rounded-md p-2 max-h-24 overflow-auto">
              {parseErrors.slice(0, 5).map((e, i) => (
                <div key={i}>
                  Linha {e.row}: {e.message}
                </div>
              ))}
              {parseErrors.length > 5 && (
                <div>...e mais {parseErrors.length - 5} erro(s)</div>
              )}
            </div>
          )}

          <Button
            onClick={onContinue}
            disabled={rows.length === 0 || classifying}
            className="w-full sm:w-auto"
          >
            {classifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Pré-visualizar dados
          </Button>
        </div>
      )}
    </div>
  );
}

function classificationBadge(c: RowClassification) {
  const map: Record<RowClassification, { label: string; cls: string }> = {
    new: { label: "Novo", cls: "bg-accent text-accent-foreground" },
    update: { label: "Atualizar", cls: "bg-primary/15 text-primary" },
    unchanged: {
      label: "Sem alteração",
      cls: "bg-muted text-muted-foreground",
    },
  };
  const b = map[c];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        b.cls
      )}
    >
      {b.label}
    </span>
  );
}

function ReviewStep({
  rows,
  onBack,
  onConfirm,
}: {
  rows: ClassifiedRow[];
  onBack: () => void;
  onConfirm: () => void;
}) {
  const counts = useMemo(() => {
    const total = rows.length;
    const novos = rows.filter((r) => r._classification === "new").length;
    const atualizar = rows.filter((r) => r._classification === "update").length;
    const sem = rows.filter((r) => r._classification === "unchanged").length;
    return { total, novos, atualizar, sem };
  }, [rows]);

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };
  const formatMoney = (v: number | null) =>
    v === null ? null : `R$ ${v.toFixed(2).replace(".", ",")}`;

  const missingCellCls =
    "bg-warning/15 text-warning-foreground";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Total" value={counts.total} />
        <SummaryCard label="Novos" value={counts.novos} accent="primary" />
        <SummaryCard label="Atualizar" value={counts.atualizar} accent="primary" />
        <SummaryCard label="Sem alteração" value={counts.sem} />
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[480px]">
          <TooltipProvider>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Usuário</th>
                  <th className="px-3 py-2 font-medium">Nome</th>
                  <th className="px-3 py-2 font-medium">WhatsApp</th>
                  <th className="px-3 py-2 font-medium">Valor</th>
                  <th className="px-3 py-2 font-medium">Vencimento</th>
                  <th className="px-3 py-2 font-medium">Telas</th>
                  <th className="px-3 py-2 font-medium">PIX</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._rowNumber} className="border-t">
                    <td className="px-3 py-2">
                      {classificationBadge(r._classification)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.username}
                    </td>
                    <MissingCell value={r.name} cls={missingCellCls} />
                    <MissingCell value={r.whatsapp} cls={missingCellCls} />
                    <MissingCell
                      value={formatMoney(r.monthly_value)}
                      cls={missingCellCls}
                    />
                    <td className="px-3 py-2">
                      {formatDate(r.expiration_date)}
                    </td>
                    <td className="px-3 py-2">{r.screens ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.pix_emv_payload ? "✓" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TooltipProvider>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={onConfirm} disabled={counts.total === 0}>
          Confirmar importação
        </Button>
      </div>
    </div>
  );
}

function MissingCell({
  value,
  cls,
}: {
  value: string | null | undefined;
  cls: string;
}) {
  if (value && value.trim() !== "") {
    return <td className="px-3 py-2">{value}</td>;
  }
  return (
    <td className={cn("px-3 py-2", cls)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-xs underline decoration-dotted cursor-help">
            —
          </span>
        </TooltipTrigger>
        <TooltipContent>Preencher após importação</TooltipContent>
      </Tooltip>
    </td>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "primary";
}) {
  return (
    <div className="bg-card border rounded-xl p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-2xl font-semibold mt-1",
          accent === "primary" && "text-primary"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ResultStep({
  importing,
  progress,
  result,
  onAnother,
  onComplete,
  onSeeAll,
}: {
  importing: boolean;
  progress: { current: number; total: number };
  result: ImportResult | null;
  onAnother: () => void;
  onComplete: () => void;
  onSeeAll: () => void;
}) {
  const [showErrors, setShowErrors] = useState(false);

  if (importing || !result) {
    const pct =
      progress.total === 0
        ? 0
        : Math.round((progress.current / progress.total) * 100);
    return (
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm font-medium">
            Importando clientes... {progress.current} de {progress.total}
          </p>
        </div>
        <Progress value={pct} />
      </div>
    );
  }

  const hasErrors = result.errors.length > 0;
  const inserted = Math.max(0, Math.round(result.inserted));

  return (
    <div className="space-y-4">
      <div className="bg-card border rounded-xl p-8 text-center">
        {hasErrors ? (
          <XCircle className="mx-auto h-14 w-14 text-destructive mb-3" />
        ) : (
          <CheckCircle2 className="mx-auto h-14 w-14 text-primary mb-3" />
        )}
        <h3 className="text-lg font-semibold">
          {hasErrors ? "Importação concluída com erros" : "Importação concluída!"}
        </h3>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Inseridos" value={inserted} accent="primary" />
        <SummaryCard label="Atualizados" value={result.updated} />
        <SummaryCard label="Erros" value={result.errors.length} />
      </div>

      {hasErrors && (
        <div className="bg-card border rounded-xl">
          <button
            type="button"
            className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-muted/40"
            onClick={() => setShowErrors((s) => !s)}
          >
            {showErrors ? "Ocultar" : "Ver"} {result.errors.length} erro(s)
          </button>
          {showErrors && (
            <ul className="border-t max-h-64 overflow-auto text-xs">
              {result.errors.map((e, i) => (
                <li key={i} className="px-4 py-2 border-b last:border-b-0">
                  Linha {e.row}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
        <Button variant="outline" onClick={onAnother}>
          Importar outro arquivo
        </Button>
        <Button variant="outline" onClick={onSeeAll}>
          Ver todos os clientes
        </Button>
        <Button onClick={onComplete}>Completar dados dos clientes</Button>
      </div>
    </div>
  );
}

