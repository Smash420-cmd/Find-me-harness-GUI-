/**
 * Proxy-aware fetch helpers. In sandboxed/managed environments outbound HTTPS
 * goes through an agent proxy (HTTPS_PROXY); Node's global fetch honours it only
 * when NODE_USE_ENV_PROXY is set (Node ≥ 22.21). We opt in here so sources and
 * the validator work both behind a proxy and on a direct connection.
 */
process.env.NODE_USE_ENV_PROXY ??= "1";

const DEFAULT_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

export async function fetchText(url: string, init: RequestInit = {}): Promise<string> {
  const res = await fetch(url, { ...init, headers: { "user-agent": DEFAULT_UA, ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}

export const USER_AGENT = DEFAULT_UA;
