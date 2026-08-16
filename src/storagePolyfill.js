/**
 * Erebos was originally built for Claude.ai's "Artifacts" sandbox, which provides a
 * built-in `window.storage` API (get/set/delete/list, with a personal/shared flag).
 * That API does not exist in a normal browser, so this file recreates it on top of
 * localStorage so the game can run standalone (e.g. deployed on Vercel).
 *
 * IMPORTANT LIMITATION:
 * localStorage is per-browser only. In the original Claude.ai environment, "shared"
 * storage (used by the player marketplace) was genuinely shared across every user of
 * the artifact. Here, "shared" data is really just local to each visitor's own browser,
 * so the marketplace will work for testing but will NOT let two different real players
 * trade with each other. To get real cross-player trading you'd need to swap this file
 * out for calls to a real backend/database (e.g. Supabase, Firebase, or your own API)
 * that exposes the same get/set/delete/list shape.
 */

const PREFIX = "erebos-storage:";

function keyFor(key, shared) {
  return PREFIX + (shared ? "shared:" : "personal:") + key;
}

if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key, shared = false) {
      const raw = localStorage.getItem(keyFor(key, shared));
      if (raw === null) {
        throw new Error(`Key not found: ${key}`);
      }
      return { key, value: raw, shared };
    },

    async set(key, value, shared = false) {
      try {
        localStorage.setItem(keyFor(key, shared), value);
        return { key, value, shared };
      } catch (e) {
        console.error("storage.set failed:", e);
        return null;
      }
    },

    async delete(key, shared = false) {
      localStorage.removeItem(keyFor(key, shared));
      return { key, deleted: true, shared };
    },

    async list(prefix = "", shared = false) {
      const full = keyFor(prefix, shared);
      const base = keyFor("", shared);
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(full)) keys.push(k.slice(base.length));
      }
      return { keys, prefix, shared };
    },
  };
}
