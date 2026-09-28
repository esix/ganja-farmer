// DOS file handle services (platform emulation of INT 21h, not code from GANJAFRM.EXE).
// The CRT (lib/crt_stdio.js) calls these exactly where the binary executes INT 21h:
//   3Dh open (0x2440a, 0x24559)  3Ch create (0x2450b)  3Eh close (0x24c32, ...)  3Fh read (0x23ba1)
//   40h write (0x247cc; CX=0 truncates, used for O_TRUNC at 0x24490)  42h lseek (0x24bf6, 0x247a2)
//   4400h IOCTL get device info (0x27334; bit 7 = device)  68h commit (0x27349 path)
// Every function returns {cf, ax/value} like the INT would (cf=1: ax = DOS error code).
// Files live in platform/vfs.js (raw bytes, case-insensitive names). Handles 0..4 are the predefined
// devices (CON, CON, CON, AUX, PRN); files get the lowest free handle >= 5.
// UNCERTAIN (DOS behaviour, not in the binary): no 8.3 name truncation, no sharing modes, no
// read-only attribute enforcement; a seek to a negative position is stored as the uint32 wrap and reads
// there return 0 bytes.
import * as vfs from './vfs.js';
import * as con from './console.js';

const MAX_HANDLES = 20; // the CRT's limit is [0x31690] = 20 (checked after open at 0x24425)
const DEV = { con: 'CON', aux: 'AUX', prn: 'PRN' };
let handles;

export function reset() {
  content.clear();
  handles = new Array(MAX_HANDLES).fill(null);
  handles[0] = { dev: DEV.con };
  handles[1] = { dev: DEV.con };
  handles[2] = { dev: DEV.con };
  handles[3] = { dev: DEV.aux };
  handles[4] = { dev: DEV.prn };
}

const ERR_FILE_NOT_FOUND = 2;
const ERR_TOO_MANY = 4;
const ERR_ACCESS = 5;
const ERR_BAD_HANDLE = 6;

function norm(name) { return name.trim().toUpperCase(); }

function newHandle(h) {
  for (let i = 5; i < MAX_HANDLES; i++) if (!handles[i]) { handles[i] = h; return i; }
  return -1;
}

// File contents shared by all handles on the same name (DOS shares one file): name -> {data, size}.
// Loaded from vfs on first open; every change is written back to vfs (persisted by its store).
const content = new Map();
function contentOf(n) {
  let c = content.get(n);
  if (!c) {
    const b = vfs.read(n);
    if (!b) return null;
    c = { data: b.slice(), size: b.length };
    content.set(n, c);
  }
  return c;
}
function commitBytes(d) { vfs.write(d.name, d.f.data.slice(0, d.f.size)); }

// AH=3Dh: AL = access (0 read, 1 write, 2 read/write) | sharing bits (ignored)
export function open(name, al) {
  const n = norm(name);
  const f = contentOf(n);
  if (!f) return { cf: 1, ax: ERR_FILE_NOT_FOUND };
  const h = newHandle({ name: n, f, pos: 0, access: al & 3 });
  if (h < 0) return { cf: 1, ax: ERR_TOO_MANY };
  return { cf: 0, ax: h };
}

// AH=3Ch: create or truncate; CX = attributes (bit 0 read-only: UNCERTAIN, not enforced)
export function create(name, attr) {
  const n = norm(name);
  const f = { data: new Uint8Array(0), size: 0 };
  const h = newHandle({ name: n, f, pos: 0, access: 2 });
  if (h < 0) return { cf: 1, ax: ERR_TOO_MANY };
  content.set(n, f);
  commitBytes(handles[h]);
  return { cf: 0, ax: h };
}

export function close(h) {
  if (h < 0 || h >= MAX_HANDLES || !handles[h]) return { cf: 1, ax: ERR_BAD_HANDLE };
  const d = handles[h];
  handles[h] = null;
  // forget the cached contents once no handle uses the file (vfs may be changed from outside)
  if (!d.dev && !handles.some((x) => x && x.f === d.f)) content.delete(d.name);
  return { cf: 0, ax: 0 };
}

// AH=3Fh. Returns {cf, ax: count, bytes}
export function read(h, n) {
  const d = handles[h];
  if (!d) return { cf: 1, ax: ERR_BAD_HANDLE };
  if (d.dev === DEV.con) {
    const b = con.readCooked(n);
    return { cf: 0, ax: b.length, bytes: b };
  }
  if (d.dev) return { cf: 0, ax: 0, bytes: new Uint8Array(0) }; // AUX/PRN: UNCERTAIN, not used by the game
  if (d.access === 1) return { cf: 1, ax: ERR_ACCESS };
  const f = d.f;
  const start = Math.min(d.pos, f.size);
  const end = Math.min(f.size, start + n);
  const b = f.data.slice(start, end);
  d.pos = (d.pos + b.length) >>> 0;
  return { cf: 0, ax: b.length, bytes: b };
}

// True if a read of handle h would have to wait for the user (CON with no completed line).
export function readWouldBlock(h) {
  const d = handles[h];
  return !!d && d.dev === DEV.con && !con.lineAvailable();
}

// AH=40h. CX=0 on a file truncates/extends it to the current position.
export function write(h, bytes) {
  const d = handles[h];
  if (!d) return { cf: 1, ax: ERR_BAD_HANDLE };
  if (d.dev === DEV.con) return { cf: 0, ax: con.write(bytes) };
  if (d.dev) return { cf: 0, ax: bytes.length };
  if (d.access === 0) return { cf: 1, ax: ERR_ACCESS };
  const f = d.f;
  if (bytes.length === 0) {
    const nd = new Uint8Array(d.pos);
    nd.set(f.data.subarray(0, Math.min(d.pos, f.size)));
    f.data = nd;
    f.size = d.pos;
    commitBytes(d);
    return { cf: 0, ax: 0 };
  }
  const end = d.pos + bytes.length;
  if (end > f.data.length) {
    const nd = new Uint8Array(Math.max(end, f.data.length * 2));
    nd.set(f.data.subarray(0, f.size));
    f.data = nd;
  }
  if (d.pos > f.size) f.data.fill(0, f.size, d.pos); // UNCERTAIN: DOS leaves the gap undefined
  f.data.set(bytes, d.pos);
  d.pos = end;
  if (end > f.size) f.size = end;
  commitBytes(d);
  return { cf: 0, ax: bytes.length };
}

// AH=42h, AL = whence (0 set, 1 cur, 2 end), offset = CX:DX (int32). Returns {cf, value: new pos (uint32)}
export function lseek(h, offset, whence) {
  const d = handles[h];
  if (!d) return { cf: 1, ax: ERR_BAD_HANDLE };
  if (whence > 2) return { cf: 1, ax: 1 };
  if (d.dev) return { cf: 0, value: 0 };
  const base = whence === 0 ? 0 : whence === 1 ? d.pos : d.f.size;
  d.pos = (base + (offset | 0)) >>> 0;
  return { cf: 0, value: d.pos };
}

// AX=4400h: DX bit 7 set for devices.
export function ioctlGetInfo(h) {
  const d = handles[h];
  if (!d) return { cf: 1, ax: ERR_BAD_HANDLE };
  return { cf: 0, dx: d.dev ? 0x80 : 0 };
}

export function commit(h) { return handles[h] ? { cf: 0, ax: 0 } : { cf: 1, ax: ERR_BAD_HANDLE }; }

reset();
