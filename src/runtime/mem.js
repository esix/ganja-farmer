// Flat 32-bit address space mirroring the original GANJAFRM.EXE image.
// Addresses are identical to the unpacked image (re/unpacked/flat.bin):
//   0x10000..0x2F87E  object 1 (code)      — not stored here; code is JS
//   0x30000..0x66FFF  object 2 (data+BSS)  — initialized part from data/data_init.bin
//   0xA0000..0xAF9FF  VGA mode 13h framebuffer
//   0x100000..        heap (malloc)
// All multi-byte accesses are little-endian and may be unaligned (as on x86).

export const MEM_SIZE = 0x800000;
export const DATA_BASE = 0x30000;
export const DATA_INIT_SIZE = 7904;
export const DATA_END = 0x30000 + 223184;
export const VGA_BASE = 0xa0000;
export const HEAP_BASE = 0x100000;
export const BIOS_FONT_8X8 = 0xffa6e; // F000:FA6E, 128 chars x 8 bytes (system BIOS ROM font)

export const buffer = new ArrayBuffer(MEM_SIZE);
export const u8 = new Uint8Array(buffer);
const dv = new DataView(buffer);

// Reads. R32 is signed int32 (C `int`), R32u unsigned; R16/R8 unsigned, R16s/R8s signed.
export const R8 = (a) => u8[a];
export const R8s = (a) => (u8[a] << 24) >> 24;
export const R16 = (a) => dv.getUint16(a, true);
export const R16s = (a) => dv.getInt16(a, true);
export const R32 = (a) => dv.getInt32(a, true);
export const R32u = (a) => dv.getUint32(a, true);

// Writes truncate like the corresponding x86 store.
export const W8 = (a, v) => { u8[a] = v; };
export const W16 = (a, v) => { dv.setUint16(a, v & 0xffff, true); };
export const W32 = (a, v) => { dv.setInt32(a, v | 0, true); };

// 32-bit float/double (x87 loads/stores of float/double variables).
export const RF32 = (a) => dv.getFloat32(a, true);
export const WF32 = (a, v) => { dv.setFloat32(a, v, true); };
export const RF64 = (a) => dv.getFloat64(a, true);
export const WF64 = (a, v) => { dv.setFloat64(a, v, true); };

// C string helpers (NUL-terminated, bytes as Latin-1 / CP437 codes).
export function readCString(a) {
  let s = '';
  for (let c; (c = u8[a]) !== 0; a++) s += String.fromCharCode(c);
  return s;
}
export function writeCString(a, s) {
  for (let i = 0; i < s.length; i++) u8[a + i] = s.charCodeAt(i) & 0xff;
  u8[a + s.length] = 0;
}

export function loadInitialData(bytes) {
  if (bytes.length !== DATA_INIT_SIZE) throw new Error('data_init.bin size mismatch');
  u8.fill(0, DATA_BASE, DATA_END);
  u8.set(bytes, DATA_BASE);
}

// ROM contents the game reads directly: the BIOS 8x8 font (data/font8x8.bin, taken from
// DOSBox-X int10_font_08, which DOSBox installs at exactly this address).
export function loadRomFont(bytes) {
  if (bytes.length !== 1024) throw new Error('font8x8.bin size mismatch');
  u8.set(bytes, BIOS_FONT_8X8);
}

// Snapshot/restore for tests.
export function snapshot() { return u8.slice(); }
export function restore(s) { u8.set(s); }
