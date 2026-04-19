/**
 * Utilitários para extração e construção de payloads PIX (EMV BR Code).
 */

export function extractPixKey(emvPayload: string): string {
  if (!emvPayload) return "";

  // Tentativa via regex (campo 26, subcampo 01)
  const match = emvPayload.match(
    /2658[0-9]{2}0014BR\.GOV\.BCB\.PIX[0-9]{2}(.+?)(?=52)/i
  );
  if (match) {
    const inner = match[0];
    const keyMatch = inner.match(/01([0-9]{2})(.+)/);
    if (keyMatch) {
      const len = parseInt(keyMatch[1], 10);
      return keyMatch[2].substring(0, len);
    }
  }

  // Fallback: parse manual de campos EMV (TLV)
  let i = 0;
  while (i < emvPayload.length - 4) {
    const id = emvPayload.substring(i, i + 2);
    const len = parseInt(emvPayload.substring(i + 2, i + 4), 10);
    if (Number.isNaN(len)) break;
    const val = emvPayload.substring(i + 4, i + 4 + len);
    if (id === "26") {
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
    i += 4 + len;
  }
  return "";
}

export function buildPixPayload(
  pixKey: string,
  valor: number,
  nome: string,
  cidade: string,
  txId: string = "zapcobranca"
): string {
  const field = (id: string, val: string) =>
    id + val.length.toString().padStart(2, "0") + val;

  const gui = field("00", "BR.GOV.BCB.PIX");
  const key = field("01", pixKey);
  const merchant = field("26", gui + key);
  const valorStr = valor.toFixed(2);
  const nomeLim = nome
    .substring(0, 25)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const cidadeLim = cidade
    .substring(0, 15)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const txIdLim = txId.replace(/\s/g, "").substring(0, 25);
  const addData = field("62", field("05", txIdLim));

  const payload =
    "000201" +
    "010212" +
    merchant +
    "52040000" +
    "5303986" +
    field("54", valorStr) +
    "5802BR" +
    field("59", nomeLim) +
    field("60", cidadeLim) +
    addData +
    "6304";

  function crc16(str: string): string {
    let crc = 0xffff;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      }
    }
    return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
  }

  return payload + crc16(payload);
}
