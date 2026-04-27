// Server-only orchestration for Evolution API v2.
// All Evolution traffic goes through here so the tenant API key never reaches
// the browser. The actual HTTP client lives in src/lib/evolution.ts.
import {
  createInstance,
  deleteInstance,
  fetchInstances,
  getConnectionState,
  getQRCode,
  getEvolutionApiUrlCandidates,
  logoutInstance,
  normalizeEvolutionApiUrl,
  sendTextMessage,
  type EvoResult,
} from "./evolution";

export {
  createInstance,
  deleteInstance,
  fetchInstances,
  getConnectionState,
  getQRCode,
  logoutInstance,
  sendTextMessage,
};

/**
 * Probe candidate protocols (https first, http fallback) and return the URL
 * that responds successfully to /instance/fetchInstances. Avoids saving an
 * URL that will silently fail later because of a bad protocol.
 */
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
        return { success: true, data: { apiUrl: normalizeEvolutionApiUrl(candidate) } };
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
