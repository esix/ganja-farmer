// Every ported function is registered here and every call between ported
// functions goes through F, so tests can substitute callees.
//
// Key format: `<name>_<addr>` (e.g. `main_1aa02`), or `sub_<addr>` while unnamed.
// ADDR maps original code addresses to keys, for indirect calls through
// function pointers stored in memory.
export const F = Object.create(null);
export const ADDR = Object.create(null);

export function register(addr, key, fn) {
  if (F[key]) throw new Error('duplicate registration ' + key);
  if (ADDR[addr] !== undefined) throw new Error('duplicate registration of address 0x' + addr.toString(16) + ' (' + ADDR[addr] + ', ' + key + ')');
  F[key] = fn;
  ADDR[addr] = key;
  fn.addr = addr;
  return fn;
}

// Indirect call through a code address read from memory.
export function callPtr(addr, ...args) {
  const key = ADDR[addr >>> 0];
  if (!key) throw new Error('indirect call to unported address 0x' + (addr >>> 0).toString(16));
  return F[key](...args);
}
