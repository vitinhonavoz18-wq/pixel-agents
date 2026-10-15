/**
 * Web: there is no OS keystore. The token lives in this browser's
 * localStorage (documented in Config); use a token scoped to the projects you
 * open from this browser and revoke it from the backend when done.
 */
const ls = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

const store = {
  get: async (key: string) => ls()?.getItem(key) ?? null,
  set: async (key: string, value: string) => {
    ls()?.setItem(key, value);
  },
  remove: async (key: string) => {
    ls()?.removeItem(key);
  },
};

export const secureStorage = store;
export const prefs = store;
