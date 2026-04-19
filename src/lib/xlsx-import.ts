import * as XLSX from "xlsx";

export interface ImportRow {
  username: string;
  password_iptv: string | null;
  expiration_date: string | null;
  status: string;
  screens: number | null;
  iptv_created_at: string | null;
  last_access: string | null;
  notes: string | null;
  reseller_tag: string | null;
  pix_emv_payload: string | null;
  whatsapp: string | null;
  monthly_value: number | null;
  name: string | null;
  _rowNumber: number;
  _errors: string[];
}

const COLUMN_ALIASES: Record<string, keyof ImportRow> = {
  usuario: "username",
  usuário: "username",
  senha: "password_iptv",
  expiracao: "expiration_date",
  expiração: "expiration_date",
  status: "status",
  telas: "screens",
  "cliente adicionado": "iptv_created_at",
  "ultimo acesso": "last_access",
  "último acesso": "last_access",
  notas: "notes",
  revenda: "reseller_tag",
  "chave pix": "pix_emv_payload",
  whatsapp: "whatsapp",
  valor: "monthly_value",
  nome: "name",
};

function normalizeKey(k: string): string {
  return k.trim().toLowerCase();
}

/**
 * Parses dates in formats: "DD/MM/YYYY HH:mm:ss", "DD/MM/YYYY",
 * Excel serial number, or ISO string. Returns ISO string or null.
 */
function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    // Excel serial date
    const utcDays = Math.floor(value - 25569);
    const utcSeconds = utcDays * 86400;
    const date = new Date(utcSeconds * 1000);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  const str = String(value).trim();
  if (!str) return null;

  // DD/MM/YYYY [HH:mm:ss]
  const m = str.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (m) {
    const [, dd, mm, yyyy, hh, mi, ss] = m;
    const date = new Date(
      Date.UTC(
        Number(yyyy),
        Number(mm) - 1,
        Number(dd),
        Number(hh ?? 0),
        Number(mi ?? 0),
        Number(ss ?? 0)
      )
    );
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  const fallback = new Date(str);
  if (!Number.isNaN(fallback.getTime())) return fallback.toISOString();
  return null;
}

function toDateOnly(iso: string | null): string | null {
  if (!iso) return null;
  return iso.substring(0, 10);
}

function parseStatus(value: unknown): string {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "expirado" || s === "expired") return "expired";
  return "active";
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  const cleaned = String(value)
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
}

function parseInteger(value: unknown): number | null {
  const n = parseNumber(value);
  if (n === null) return null;
  return Math.round(n);
}

function parseString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

export interface ParseResult {
  rows: ImportRow[];
  totalRows: number;
  errors: { row: number; message: string }[];
}

export async function parseXlsxFile(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], totalRows: 0, errors: [{ row: 0, message: "Planilha vazia" }] };
  }
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });

  const rows: ImportRow[] = [];
  const errors: { row: number; message: string }[] = [];

  json.forEach((raw, idx) => {
    const rowNumber = idx + 2; // +1 for header, +1 for 1-indexed
    const mapped: Record<string, unknown> = {};
    for (const key of Object.keys(raw)) {
      const target = COLUMN_ALIASES[normalizeKey(key)];
      if (target) mapped[target] = raw[key];
    }

    const username = parseString(mapped.username);
    if (!username) {
      errors.push({ row: rowNumber, message: "Coluna 'Usuario' obrigatória ausente" });
      return;
    }

    const row: ImportRow = {
      username,
      password_iptv: parseString(mapped.password_iptv),
      expiration_date: toDateOnly(parseDate(mapped.expiration_date)),
      status: parseStatus(mapped.status),
      screens: parseInteger(mapped.screens),
      iptv_created_at: parseDate(mapped.iptv_created_at),
      last_access: parseDate(mapped.last_access),
      notes: parseString(mapped.notes),
      reseller_tag: parseString(mapped.reseller_tag),
      pix_emv_payload: parseString(mapped.pix_emv_payload),
      whatsapp: parseString(mapped.whatsapp),
      monthly_value: parseNumber(mapped.monthly_value),
      name: parseString(mapped.name),
      _rowNumber: rowNumber,
      _errors: [],
    };

    rows.push(row);
  });

  return { rows, totalRows: json.length, errors };
}

export function downloadTemplate() {
  const sample = [
    {
      Usuario: "cliente_exemplo",
      Senha: "senha123",
      Expiração: "31/12/2025 23:59:59",
      Status: "Ativo",
      Telas: 2,
      "Cliente Adicionado": "01/01/2025 10:00:00",
      "Último Acesso": "15/01/2025 20:30:00",
      Notas: "Cliente preferencial",
      Revenda: "TAG_REVENDA",
      "Chave PIX":
        "00020126360014BR.GOV.BCB.PIX0114+5511999999999520400005303986540510.005802BR5913LOJA EXEMPLO6009SAO PAULO62070503***6304ABCD",
      WhatsApp: "(11) 99999-9999",
      Valor: 49.9,
      Nome: "Cliente Exemplo",
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clientes");
  XLSX.writeFile(wb, "modelo_zapcobranca.xlsx");
}
