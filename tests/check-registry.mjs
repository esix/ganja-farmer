// Static integration check: every F.<key> referenced in src must be
// registered by some module, and the key's address suffix must match the
// address it is registered at. Usage: node tests/check-registry.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src/', import.meta.url).pathname;
const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p); else if (n.endsWith('.js')) files.push(p);
  }
})(root);

const registered = new Map(); // key -> file
const byAddr = new Map(); // address -> key (registry.js throws on a duplicate address or key at load time)
const refs = new Map(); // key -> [files]
let bad = 0;
for (const f of files) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(/register\(\s*0x([0-9a-fA-F]+)\s*,\s*'([A-Za-z_0-9]+)'/g)) {
    const [, addr, key] = m;
    if (!key.toLowerCase().endsWith('_' + addr.toLowerCase())) {
      console.log(`BAD KEY ${key} registered at 0x${addr} (${f})`); bad++;
    }
    if (registered.has(key)) { console.log(`DUPLICATE KEY ${key} (${registered.get(key)}, ${f})`); bad++; }
    const a = parseInt(addr, 16);
    if (byAddr.has(a)) { console.log(`DUPLICATE ADDRESS 0x${addr} (${byAddr.get(a)}, ${key})`); bad++; }
    byAddr.set(a, key);
    registered.set(key, f);
  }
  for (const m of s.matchAll(/\bF\.([A-Za-z_0-9]+)/g)) {
    if (!refs.has(m[1])) refs.set(m[1], []);
    refs.get(m[1]).push(f.slice(root.length));
  }
}
const missing = [...refs.keys()].filter((k) => !registered.has(k)).sort();
console.log(`${registered.size} registered, ${refs.size} referenced, ${missing.length} missing`);
for (const k of missing) console.log(`  missing ${k}  <- ${[...new Set(refs.get(k))].join(', ')}`);
process.exit(bad ? 1 : 0);
