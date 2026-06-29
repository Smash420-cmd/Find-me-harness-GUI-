/**
 * STUB cache (empty scaffold). Always misses. Promoted to a real impl only when
 * the verify-loop hits its reliability bar (see promotion register). Until then,
 * every recall returns a miss, so the engine always does live work (Law 2-safe
 * by construction).
 */
import type { ICacheProvider } from "../index.js";

export class StubCacheProvider implements ICacheProvider {
  async get<T>(_key: string): Promise<{ hit: false } | { hit: true; value: T }> {
    return { hit: false };
  }

  async set<T>(_key: string, _value: T): Promise<void> {
    // no-op: the empty room has no shelves yet.
  }
}
