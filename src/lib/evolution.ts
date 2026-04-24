const HTTP_PROTOCOL_RE = /^https?:\/\//i;

export function stripEvolutionApiUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function normalizeEvolutionApiUrl(value: string) {
  const cleaned = stripEvolutionApiUrl(value);
  if (!cleaned) return "";
  return HTTP_PROTOCOL_RE.test(cleaned) ? cleaned : `http://${cleaned}`;
}

export function getEvolutionApiUrlCandidates(value: string) {
  const cleaned = stripEvolutionApiUrl(value);
  if (!cleaned) return [] as string[];

  if (cleaned.startsWith("https://")) {
    return [cleaned, `http://${cleaned.slice("https://".length)}`];
  }

  if (cleaned.startsWith("http://")) {
    return [cleaned, `https://${cleaned.slice("http://".length)}`];
  }

  return [`http://${cleaned}`, `https://${cleaned}`];
}
