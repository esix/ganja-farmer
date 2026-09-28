// Watcom C runtime stdio as the game uses it (stage 2): fopen/fread/fwrite/fclose/fseek/ftell on the virtual
// DOS file system, printf to the console, and the C++ `cin >> char*` extractor.
// Stage 1 reproduced the CRT's FILE structures, buffers, stream lists and DOS handle calls in emulated memory,
// because PCX_Load read FILE fields directly; since pictures are PNGs nothing does. A FILE* is now an opaque
// non-zero number and the stream lives in JS. What the game observes is kept:
//   - fopen returns 0 for a missing file opened for reading; "w" creates/truncates; 'b' = binary, else text;
//   - text mode as this CRT does it: reading drops every '\r' and takes the byte after it as is ("\r\n" ->
//     '\n'), and a 0x1A byte ends the current fread (it is consumed; a later fread goes on after it); writing turns '\n'
//     into "\r\n". SCORES.DAT is written in text mode, so its binary scores depend on this;
//   - fread/fwrite return whole items (bytes / size); a written file reaches the file system (and
//     localStorage) when it is closed;
//   - printf: literal text, "%s" and "%%" (all the game uses), '\n' -> "\r\n", to the DOS console.
import { register } from '../runtime/registry.js';
import { u8, R8, readCString } from '../runtime/mem.js';
import * as vfs from '../platform/vfs.js';
import * as con from '../platform/console.js';

const streams = new Map(); // FILE* -> { name, data: Uint8Array | number[], pos, write, binary }
let nextFp = 0x7f000010;   // opaque, never dereferenced

export function fopen(name, mode) {
  const n = readCString(name);
  const m = readCString(mode);
  const binary = m.includes('b');
  let s;
  if (m[0] === 'r') {
    const data = vfs.read(n);
    if (!data) return 0;
    s = { name: n, data, pos: 0, write: false, binary };
  } else if (m[0] === 'w') {
    s = { name: n, data: [], pos: 0, write: true, binary };
  } else {
    throw new Error(`fopen: mode "${m}" is not used by the game`);
  }
  const fp = nextFp;
  nextFp += 0x10;
  streams.set(fp, s);
  return fp;
}

export function fread(buf, size, n, fp) {
  const s = streams.get(fp >>> 0);
  if (!s || s.write) return 0;
  const bytes = Math.imul(n, size) >>> 0;
  let got = 0;
  if (s.binary) {
    got = Math.min(bytes, s.data.length - s.pos);
    u8.set(s.data.subarray(s.pos, s.pos + got), buf);
    s.pos += got;
  } else {
    while (got < bytes && s.pos < s.data.length) {
      let c = s.data[s.pos++];
      if (c === 0x0d) {
        if (s.pos >= s.data.length) break;
        c = s.data[s.pos++];
      }
      if (c === 0x1a) break;
      u8[buf + got++] = c;
    }
  }
  return Math.floor(got / (size >>> 0));
}

export function fwrite(buf, size, n, fp) {
  const s = streams.get(fp >>> 0);
  if (!s || !s.write) return 0;
  const bytes = Math.imul(n, size) >>> 0;
  for (let i = 0; i < bytes; i++) {
    const c = u8[buf + i];
    if (c === 0x0a && !s.binary) s.data.push(0x0d);
    s.data.push(c);
  }
  return Math.floor(bytes / (size >>> 0));
}

export function fclose(fp) {
  const s = streams.get(fp >>> 0);
  if (!s) return -1;
  streams.delete(fp >>> 0);
  if (s.write) vfs.write(s.name, new Uint8Array(s.data));
  return 0;
}

// Binary streams only (Load_File measures a file with fseek(0, SEEK_END) / ftell / fseek(0, SEEK_SET)).
export function fseek(fp, offset, whence) {
  const s = streams.get(fp >>> 0);
  if (!s || s.write || !s.binary) throw new Error('fseek: only binary read streams are used by the game');
  const len = s.data.length;
  const p = whence === 0 ? offset : whence === 1 ? s.pos + offset : len + offset;
  if (p < 0) return -1;
  s.pos = Math.min(p, len);
  return 0;
}
export function ftell(fp) {
  const s = streams.get(fp >>> 0);
  return s ? s.pos : -1;
}

export function printf(fmt, ...args) {
  const out = [];
  let count = 0; // characters formatted; the '\r' added in front of '\n' is not counted (fputc)
  const put = (c) => { count++; if (c === 0x0a) out.push(0x0d); out.push(c); };
  let ai = 0;
  for (let p = fmt; R8(p) !== 0; p++) {
    const c = R8(p);
    if (c !== 0x25) { put(c); continue; }
    const s = R8(++p);
    if (s === 0x73) for (let q = args[ai++] >>> 0; R8(q) !== 0; q++) put(R8(q));
    else if (s === 0x25) put(0x25);
    else throw new Error('printf: conversion %' + String.fromCharCode(s) + ' is not used by the game');
  }
  con.write(out);
  return count;
}

// 0x2231a istream &operator>>(istream &is, char *buf) on cin (0x64eb8). Unreachable: its only caller, 0x10676,
// calls it when [0x31ee0] != 0, and nothing but the start-up's BSS clear writes 0x31ee0.
export function istreamExtractCstr() {
  throw new Error('cin >> char* is unreachable in this game (0x31ee0 is never set)');
}

export function initFiles() { streams.clear(); }
export function closeAllAtExit() { for (const fp of [...streams.keys()]) fclose(fp); }

register(0x2264a, 'fopen_2264a', fopen);
register(0x1e110, 'fread_1e110', fread);
register(0x2270d, 'fwrite_2270d', fwrite);
register(0x228ed, 'fclose_228ed', fclose);
register(0x23ee1, 'fseek_23ee1', fseek);
register(0x24b81, 'ftell_24b81', ftell);
register(0x23783, 'printf_23783', printf);
register(0x2231a, 'istream_extract_cstr_2231a', istreamExtractCstr);
