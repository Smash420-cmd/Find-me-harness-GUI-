/**
 * Proxy-aware fetch helpers. In sandboxed/managed environments outbound HTTPS
 * goes through an agent proxy (HTTPS_PROXY); Node's global fetch honours it only
 * when NODE_USE_ENV_PROXY is set (Node ≥ 22.21). We opt in here so sources and
 * the validator work both behind a proxy and on a direct connection.
 */
process.env.NODE_USE_ENV_PROXY ??= "1";

const DEFAULT_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

/** The live implementation — always available for the recorder to wrap. */
export async function liveFetchText(url: string, init: RequestInit = {}): Promise<string> {
  const res = await fetch(url, { ...init, headers: { "user-agent": DEFAULT_UA, ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}

// Overridable indirection: the exam's frozen worlds (Spec 006) swap this at
// the composition root (start.ts) to record or replay all HTTP traffic. The
// sources never know — the seam is this one mutable slot (Plan 006 §1).
let impl: typeof liveFetchText = liveFetchText;

export function fetchText(url: string, init: RequestInit = {}): Promise<string> {
  return impl(url, init);
}

/** Install a replacement (or reset with no argument). Composition-root only. */
export function setFetchTextImpl(next?: typeof liveFetchText): void {
  impl = next ?? liveFetchText;
}

export const USER_AGENT = DEFAULT_UA;
