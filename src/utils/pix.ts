/**
 * Utilitários para manipulação de payloads PIX (EMV BR Code).
 * Adaptado da lógica TLV do Google Sheets para garantir compatibilidade com diversos bancos (Inter, etc).
 */

interface TLVField {
  id: string;
  value: string;
}

/**
 * Parse TLV top-level do EMV/BR Code.
 */
function parseTLVTopLevel(emv: string): TLVField[] {
  const s = String(emv).trim();
  const out: TLVField[] = [];
  let i = 0;
  const N = s.length;

  while (i + 4 <= N) {
    const id = s.substring(i, i + 2);
    const lenStr = s.substring(i + 2, i + 4);
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(lenStr)) {
      break;
    }
    const len = parseInt(lenStr, 10);
    const startVal = i + 4;
    const endVal = startVal + len;

    if (endVal > N) {
      break;
    }
    const value = s.substring(startVal, endVal);
    out.push({ id, value });

    i = endVal;
    if (id === "63") break;
  }

  return out;
}

/**
 * Reconstrói a string TLV a partir do array.
 */
function buildTLV(fields: TLVField[]): string {
  return fields
    .map(f => f.id + String(f.value.length).padStart(2, "0") + f.value)
    .join("");
}

/**
 * Calcula CRC16-CCITT (polinômio 0x1021).
 */
function calcularCRC16(str: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= (str.charCodeAt(i) & 0xFF) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      else crc = (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Insere/atualiza o valor no PIX usando lógica TLV robusta.
 */
export function inserirValorNoPix_TLV(pix: string, valor: number): string {
  if (!pix) return "";
  
  // Se não for um payload EMV, não tentamos manipular
  if (!pix.startsWith("000201")) return pix;

  const valorStr = valor.toFixed(2);
  let fields = parseTLVTopLevel(pix);

  // Remove CRC (63) e Valor (54) antigos
  fields = fields.filter(f => f.id !== "63" && f.id !== "54");

  // Novo campo de valor
  const f54 = { id: "54", value: valorStr };

  // Insere após campo 53 ou antes de 58
  const idx53 = fields.findIndex(f => f.id === "53");
  if (idx53 !== -1) {
    fields.splice(idx53 + 1, 0, f54);
  } else {
    const idx58 = fields.findIndex(f => f.id === "58");
    if (idx58 !== -1) fields.splice(idx58, 0, f54);
    else fields.push(f54);
  }

  // Reconstrói e calcula novo CRC
  const semCRC = buildTLV(fields) + "6304";
  const crc = calcularCRC16(semCRC);
  
  return semCRC + crc;
}

/**
 * Extrai a chave PIX (Legado/Fallback)
 */
export function extractPixKey(emvPayload: string): string {
  if (!emvPayload) return "";
  if (!emvPayload.startsWith("000201")) return emvPayload;

  const fields = parseTLVTopLevel(emvPayload);
  const merchantField = fields.find(f => f.id === "26");
  
  if (merchantField) {
    const val = merchantField.value;
    let j = 0;
    while (j < val.length - 4) {
      const sid = val.substring(j, j + 2);
      const slen = parseInt(val.substring(j + 2, j + 4), 10);
      if (Number.isNaN(slen)) break;
      const sval = val.substring(j + 4, j + 4 + slen);
      if (sid === "01") return sval;
      j += 4 + slen;
    }
  }
  
  return emvPayload;
}
