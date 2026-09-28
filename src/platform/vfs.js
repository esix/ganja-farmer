// Virtual DOS file system: the game's working directory (assets/game/).
// Names are case-insensitive (DOS). Files are raw bytes; text-mode translation
// is the CRT's job (lib/), not this layer's.
// Writes persist through a pluggable store (localStorage in the browser).

const files = new Map(); // UPPERCASE name -> Uint8Array
let store = null; // { load(name) -> Uint8Array|null, save(name, bytes) }

export function setStore(s) { store = s; }

// Fetch one file, retrying transient network failures (timeouts, resets) and 5xx responses.
export async function fetchBytes(url, tries = 5, timeoutMs = 10000) {
  let lastErr;
  for (let attempt = 1; attempt <= tries; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { signal: ctl.signal, cache: 'no-cache' });
      if (r.ok) return new Uint8Array(await r.arrayBuffer());
      lastErr = new Error(`HTTP ${r.status}`);
      if (r.status < 500) break; // 404 etc.: retrying won't help
    } catch (e) {
      lastErr = e;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((res) => setTimeout(res, 250 * attempt));
  }
  throw new Error(`failed to load ${url}: ${lastErr && lastErr.message}`);
}

export async function mountFromUrl(baseUrl, manifestUrl, onProgress) {
  const names = await (await fetch(manifestUrl, { cache: 'no-cache' })).json();
  // A few requests at a time: firing all ~100 at once made some time out over the LAN.
  const CONCURRENCY = 4;
  let next = 0, done = 0;
  async function worker() {
    while (next < names.length) {
      const n = names[next++];
      files.set(n.toUpperCase(), await fetchBytes(baseUrl + n));
      done++;
      if (onProgress) onProgress(done, names.length, n);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (store) {
    for (const n of names) {
      const saved = store.load(n.toUpperCase());
      if (saved) files.set(n.toUpperCase(), saved);
    }
  }
}

export function mountBytes(name, bytes) { files.set(name.toUpperCase(), bytes); }

export function names() { return [...files.keys()]; }
export function exists(name) { return files.has(name.toUpperCase()); }
export function read(name) { return files.get(name.toUpperCase()) || null; }
export function write(name, bytes) {
  const k = name.toUpperCase();
  files.set(k, bytes);
  if (store) store.save(k, bytes);
}

export const localStorageStore = {
  load(name) {
    try {
      const s = localStorage.getItem('ganja:' + name);
      if (s == null) return null;
      const bin = atob(s);
      const b = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
      return b;
    } catch { return null; }
  },
  save(name, bytes) {
    try {
      let bin = '';
      for (const c of bytes) bin += String.fromCharCode(c);
      localStorage.setItem('ganja:' + name, btoa(bin));
    } catch { /* storage unavailable: file lives only in memory */ }
  },
};
