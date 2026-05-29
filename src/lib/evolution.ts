// Evolution API v2 client + URL helpers.
// The client functions here are intended to be called from server-side code
// only (server functions / server routes). Calling Evolution directly from
// the browser would hit CORS and leak the API key — always proxy via a
// server function.

const HTTP_PROTOCOL_RE = /^https?:\/\//i;

export function stripEvolutionApiUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

/** Normalize URL: strip trailing slash, default to https:// when no protocol given. */
export function normalizeEvolutionApiUrl(value: string) {
  const cleaned = stripEvolutionApiUrl(value);
  if (!cleaned) return "";
  return HTTP_PROTOCOL_RE.test(cleaned) ? cleaned : `https://${cleaned}`;
}

/** Returns ordered candidates to try when probing for a working protocol. */
export function getEvolutionApiUrlCandidates(value: string) {
  const cleaned = stripEvolutionApiUrl(value);
  if (!cleaned) return [] as string[];

  if (cleaned.startsWith("https://")) {
    return [cleaned, `http://${cleaned.slice("https://".length)}`];
  }
  if (cleaned.startsWith("http://")) {
    return [cleaned, `https://${cleaned.slice("http://".length)}`];
  }
  return [`https://${cleaned}`, `http://${cleaned}`];
}

/**
 * Build a v2-compliant instance name from a tenant id.
 * Rules: only [a-z0-9_], max 30 chars. Format: zap_<first 8 hex of uuid>.
 */
export function buildInstanceName(tenantId: string): string {
  const safe = tenantId.replace(/-/g, "").substring(0, 8).toLowerCase();
  return `zap_${safe}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Evolution API v2 — HTTP client
// ─────────────────────────────────────────────────────────────────────────

const getHeaders = (apiKey: string) => ({
  "Content-Type": "application/json",
  apikey: apiKey,
});

export type EvoResult<T = unknown> =
  | { success: true; data?: T; error?: undefined }
  | { success: false; error: string; data?: undefined };

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractError(parsed: unknown, status: number): string {
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    const msg = obj.message ?? obj.error ?? obj.response;
    if (typeof msg === "string") return msg;
    if (Array.isArray(msg)) return msg.map(String).join("; ");
  }
  if (typeof parsed === "string" && parsed) return parsed;
  return `HTTP ${status}`;
}

// POST /instance/create
export async function createInstance(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
): Promise<EvoResult> {
  try {
    const url = `${stripEvolutionApiUrl(apiUrl)}/instance/create`;
    const response = await fetch(url, {
      method: "POST",
      headers: getHeaders(apiKey),
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      }),
    });
    const data = await parseBody(response);
    if (!response.ok) {
      return { success: false, error: extractError(data, response.status) };
    }
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// GET /instance/connect/{instanceName} — returns base64 QR
export async function getQRCode(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
): Promise<EvoResult<{ base64: string | null; code: string | null }>> {
  try {
    const url = `${stripEvolutionApiUrl(apiUrl)}/instance/connect/${encodeURIComponent(instanceName)}`;
    const response = await fetch(url, { method: "GET", headers: getHeaders(apiKey) });
    const data = (await parseBody(response)) as Record<string, any> | null;
    if (!response.ok) {
      return { success: false, error: extractError(data, response.status) };
    }
    const base64 = data?.base64 || data?.qrcode?.base64 || null;
    const code = data?.code || data?.qrcode?.code || null;
    return { success: true, data: { base64, code } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// GET /instance/connectionState/{instanceName}
export async function getConnectionState(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
): Promise<EvoResult<{ state: "open" | "connecting" | "close" | string }>> {
  try {
    const url = `${stripEvolutionApiUrl(apiUrl)}/instance/connectionState/${encodeURIComponent(instanceName)}`;
    const response = await fetch(url, { method: "GET", headers: getHeaders(apiKey) });
    const data = (await parseBody(response)) as Record<string, any> | null;
    if (!response.ok) {
      return { success: false, error: extractError(data, response.status) };
    }
    const state = data?.instance?.state || data?.state || "close";
    return { success: true, data: { state } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// POST /message/sendText/{instanceName}
export async function sendTextMessage(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
  number: string,
  text: string,
): Promise<EvoResult> {
  try {
    const cleaned = String(number).replace(/\D/g, "");
    const formatted = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;

    const url = `${stripEvolutionApiUrl(apiUrl)}/message/sendText/${encodeURIComponent(instanceName)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: getHeaders(apiKey),
      body: JSON.stringify({ number: formatted, text }),
    });
    const data = await parseBody(response);
    if (!response.ok) {
      return { success: false, error: extractError(data, response.status) };
    }
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// GET /instance/fetchInstances
export async function fetchInstances(
  apiUrl: string,
  apiKey: string,
): Promise<EvoResult<unknown[]>> {
  try {
    const url = `${stripEvolutionApiUrl(apiUrl)}/instance/fetchInstances`;
    const response = await fetch(url, { method: "GET", headers: getHeaders(apiKey) });
    const data = await parseBody(response);
    if (!response.ok) {
      return { success: false, error: extractError(data, response.status) };
    }
    return { success: true, data: Array.isArray(data) ? data : [] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// DELETE /instance/logout/{instanceName}
export async function logoutInstance(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
): Promise<EvoResult> {
  try {
    const url = `${stripEvolutionApiUrl(apiUrl)}/instance/logout/${encodeURIComponent(instanceName)}`;
    const response = await fetch(url, { method: "DELETE", headers: getHeaders(apiKey) });
    if (!response.ok) {
      const data = await parseBody(response);
      return { success: false, error: extractError(data, response.status) };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// DELETE /instance/delete/{instanceName}
export async function deleteInstance(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
): Promise<EvoResult> {
  try {
    const url = `${stripEvolutionApiUrl(apiUrl)}/instance/delete/${encodeURIComponent(instanceName)}`;
    const response = await fetch(url, { method: "DELETE", headers: getHeaders(apiKey) });
    if (!response.ok) {
      const data = await parseBody(response);
      return { success: false, error: extractError(data, response.status) };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
