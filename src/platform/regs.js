// Register-set helpers for emulated software interrupts (io.js backend `int(num, regs)`).
//
// Input: a plain object with the registers the original loaded before the INT, under any of the
// x86 names: eax/ax/ah/al, ebx/bx/bh/bl, ecx/cx/ch/cl, edx/dx/dh/dl, esi/si, edi/di, ds, es.
// Narrow names override the corresponding bits of the wide one (so {eax: X, ah: 0x25} works).
// Output: every general register in all widths plus ds/es and cflag (0/1, the carry flag as the
// Watcom REGS.x.cflag / DPMI CF convention), so a port can read whichever name it needs.

const GP = ['a', 'b', 'c', 'd'];

export function loadRegs(r) {
  const s = { eax: 0, ebx: 0, ecx: 0, edx: 0, esi: 0, edi: 0, ds: 0, es: 0, cflag: 0 };
  for (const g of GP) {
    let v = (r['e' + g + 'x'] ?? 0) >>> 0;
    if (r[g + 'x'] !== undefined) v = ((v & 0xffff0000) | (r[g + 'x'] & 0xffff)) >>> 0;
    if (r[g + 'h'] !== undefined) v = ((v & 0xffff00ff) | ((r[g + 'h'] & 0xff) << 8)) >>> 0;
    if (r[g + 'l'] !== undefined) v = ((v & 0xffffff00) | (r[g + 'l'] & 0xff)) >>> 0;
    s['e' + g + 'x'] = v;
  }
  for (const x of ['si', 'di']) {
    let v = (r['e' + x] ?? 0) >>> 0;
    if (r[x] !== undefined) v = ((v & 0xffff0000) | (r[x] & 0xffff)) >>> 0;
    s['e' + x] = v;
  }
  s.ds = (r.ds ?? 0) & 0xffff;
  s.es = (r.es ?? 0) & 0xffff;
  return s;
}

// Expand a state produced by loadRegs (possibly modified) into the all-widths output object.
export function outRegs(s) {
  const o = { ds: s.ds & 0xffff, es: s.es & 0xffff, cflag: s.cflag ? 1 : 0 };
  for (const g of GP) {
    const v = s['e' + g + 'x'] >>> 0;
    o['e' + g + 'x'] = v;
    o[g + 'x'] = v & 0xffff;
    o[g + 'h'] = (v >>> 8) & 0xff;
    o[g + 'l'] = v & 0xff;
  }
  for (const x of ['si', 'di']) {
    o['e' + x] = s['e' + x] >>> 0;
    o[x] = s['e' + x] & 0xffff;
  }
  return o;
}

export const lo16 = (v) => v & 0xffff;
export const set16 = (v, w) => ((v & 0xffff0000) | (w & 0xffff)) >>> 0;
export const setHi8 = (v, b) => ((v & 0xffff00ff) | ((b & 0xff) << 8)) >>> 0;
export const setLo8 = (v, b) => ((v & 0xffffff00) | (b & 0xff)) >>> 0;
