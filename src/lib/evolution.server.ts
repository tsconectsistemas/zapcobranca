// Server-only helpers for Evolution API. Never import from client code.
import {
  getEvolutionApiUrlCandidates,
  normalizeEvolutionApiUrl,
} from "./evolution";

type EvoResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; status?: number };

interface EvoConfig {
  apiUrl: string;
  apiKey: string;
}

async function evoFetch<T = unknown>(
  cfg: EvoConfig,
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
): Promise<EvoResult<T>> {
  try {
    const res = await fetch(`${normalizeEvolutionApiUrl(cfg.apiUrl)}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: cfg.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    if (!res.ok) {
      let message = `Evolution API error ${res.status}`;
      if (parsed && typeof parsed === "object" && "message" in parsed) {
        const m = (parsed as { message?: unknown }).message;
        if (m) message = String(m);
      }
      return { success: false, error: message, status: res.status };
    }
    return { success: true, data: parsed as T };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export async function resolveWorkingEvolutionApiUrl(
  apiUrl: string,
  apiKey: string,
): Promise<EvoResult<{ apiUrl: string }>> {
  const attempts: string[] = [];

  for (const candidate of getEvolutionApiUrlCandidates(apiUrl)) {
    try {
      const res = await fetch(`${candidate}/instance/fetchInstances`, {
        method: "GET",
        headers: { apikey: apiKey },
      });

      if (res.ok) {
        return { success: true, data: { apiUrl: candidate } };
      }

      attempts.push(`${candidate} (${res.status})`);
    } catch (error) {
      attempts.push(
        `${candidate} (${error instanceof Error ? error.message : "network error"})`,
      );
    }
  }

  return {
    success: false,
    error:
      attempts.length > 0
        ? `Não foi possível conectar à Evolution API. Tentativas: ${attempts.join(" · ")}`
        : "Informe uma URL válida da Evolution API.",
  };
}

export async function createInstance(
  cfg: EvoConfig,
  instanceName: string,
): Promise<EvoResult> {
  return evoFetch(cfg, "POST", "/instance/create", {
    instanceName,
    qrcode: true,
    integration: "WHATSAPP-BAILEYS",
  });
}

export async function getQRCode(
  cfg: EvoConfig,
  instanceName: string,
): Promise<EvoResult<{ base64?: string; code?: string }>> {
  return evoFetch(cfg, "GET", `/instance/connect/${encodeURIComponent(instanceName)}`);
}

export async function getConnectionState(
  cfg: EvoConfig,
  instanceName: string,
): Promise<EvoResult<{ instance?: { state?: string } } | { state?: string }>> {
  return evoFetch(
    cfg,
    "GET",
    `/instance/connectionState/${encodeURIComponent(instanceName)}`,
  );
}

export async function fetchInstance(
  cfg: EvoConfig,
  instanceName: string,
): Promise<EvoResult> {
  return evoFetch(
    cfg,
    "GET",
    `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`,
  );
}

export async function sendTextMessage(
  cfg: EvoConfig,
  instanceName: string,
  number: string,
  text: string,
): Promise<EvoResult> {
  return evoFetch(
    cfg,
    "POST",
    `/message/sendText/${encodeURIComponent(instanceName)}`,
    { number, text },
  );
}

export async function deleteInstance(
  cfg: EvoConfig,
  instanceName: string,
): Promise<EvoResult> {
  return evoFetch(
    cfg,
    "DELETE",
    `/instance/delete/${encodeURIComponent(instanceName)}`,
  );
}

export async function logoutInstance(
  cfg: EvoConfig,
  instanceName: string,
): Promise<EvoResult> {
  return evoFetch(
    cfg,
    "DELETE",
    `/instance/logout/${encodeURIComponent(instanceName)}`,
  );
}
