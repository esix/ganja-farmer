// Watcom C runtime stdio of GANJAFRM.EXE: fopen/fread/fwrite/fclose/fgetc/fseek/ftell/printf and the
// C++ `cin >> char*` extractor. Implemented to the behaviour of this binary's CRT (addresses cited),
// not ported instruction by instruction. The FILE structures, their buffers and the stream lists live in
// emulated memory at the original addresses, because ported code reads FILE fields directly (PCX_Load's
// inlined getc macro uses _ptr/_cnt at FILE+0/+4).
//
// FILE (0x1A bytes; static table __iob = 0x312d0..0x314d8, 20 entries; stdin 0x312d0, stdout 0x312ea,
// stderr 0x31304, stdaux 0x3131e, stdprn 0x31338 — 0x241f2 returns 0x312d0 + n*0x1a):
//   +0x00 _ptr      next byte in the buffer
//   +0x04 _cnt      bytes left to read in the buffer / bytes pending in the buffer when writing
//   +0x08 _link     -> stream link record (below)
//   +0x0c _flag     bits used by the code: 0x1 READ, 0x2 WRITE, 0x4 UNGET, 0x8 BIGBUF (CRT-allocated
//                   buffer, freed at close), 0x10 EOF, 0x20 ERR, 0x40 BINARY, 0x80 APPEND, 0x100 IOFBF,
//                   0x200 IOLBF, 0x400 IONBF, 0x800 TMPFIL, 0x1000 DIRTY (buffer holds unwritten data),
//                   0x2000 ISTTY, 0x4000 DYNAMIC (FILE malloc'd because __iob was full)
//   +0x10 _handle   DOS handle
//   +0x14 _bufsize
//   +0x18 _ungotten (1-byte fallback buffer when malloc of the buffer fails, 0x23b71)
// Stream link record (malloc(0x15), 0x2464e / 0x271de):
//   +0x00 next, +0x04 FILE*, +0x08 _base (buffer start), +0x0c orientation (0 none, 1 byte),
//   +0x10 extflags (bit 0 = commit on flush, from mode 'c'/'n' or _commode [0x312cc]), +0x14 tmpfile no.
// Lists: [0x651d4] open streams (head), [0x651d8] closed link records for reuse.
// errno = [0x651dc] (0x247f3), _doserrno = [0x651e0] (0x247f9).
import { register } from '../runtime/registry.js';
import { u8, R8, R8s, R32, R32u, W8, W32, readCString } from '../runtime/mem.js';
import { yieldCpu } from '../runtime/cpu.js';
import * as dos from '../platform/dos.js';
import * as con from '../platform/console.js';
import { malloc, free } from './crt_heap.js';

export const IOB = 0x312d0;
const IOB_END = 0x314d8;
const FILE_SIZE = 0x1a;
export const STDIN = 0x312d0;
export const STDOUT = 0x312ea;
const STDERR = 0x31304;
const IOB5 = 0x31352; // &__iob[5]
const OPEN_LIST = 0x651d4;
const FREE_LIST = 0x651d8;
const ERRNO = 0x651dc;
const DOSERRNO = 0x651e0;
const COMMODE = 0x312cc;
const FMODE = 0x314d9;
const MAX_HANDLES = 0x31690;
const UMASK = 0x316e8;

const _READ = 0x1, _WRITE = 0x2, _UNGET = 0x4, _BIGBUF = 0x8, _EOF = 0x10, _SFERR = 0x20, _BINARY = 0x40,
  _APPEND = 0x80, _IOFBF = 0x100, _IOLBF = 0x200, _IONBF = 0x400, _TMPFIL = 0x800, _DIRTY = 0x1000,
  _ISTTY = 0x2000, _DYNAMIC = 0x4000;

// FILE field access
const ptr = (fp) => R32u(fp);
const cnt = (fp) => R32(fp + 4);
const link = (fp) => R32u(fp + 8);
const flag = (fp) => R32u(fp + 0xc);
const handle = (fp) => R32(fp + 0x10);
const bufsize = (fp) => R32u(fp + 0x14);
const base = (fp) => R32u(link(fp) + 8);
const setPtr = (fp, v) => W32(fp, v);
const setCnt = (fp, v) => W32(fp + 4, v);
const setFlag = (fp, v) => W32(fp + 0xc, v);
const orFlag = (fp, b) => setFlag(fp, flag(fp) | b);
const andFlag = (fp, b) => setFlag(fp, flag(fp) & b);

// Low-level handle mode table (the original keeps it at [0x316e4]; only the APPEND bit 0x80 influences
// observable behaviour: 0x2477f seeks to the end before every write). Kept in JS.
const ioMode = new Array(20).fill(0);

function setErrno(e) { W32(ERRNO, e); } // __set_errno 0x23add

// 0x260d9: map a DOS error code to errno, set _doserrno, return -1.
// UNCERTAIN: the special cases at 0x260f0 apply when the DOS major version [0x31143] >= 3 (set at startup
// from INT 21h; assumed true — the game needs DOS 5+ for PMODE/W and STKRUN).
function dosError(code) {
  W32(DOSERRNO, code & 0xff);
  if (code < 0x100) {
    let dl = code & 0xff;
    if (dl === 0x50) dl = 0x0e;
    else if (dl === 0x20 || dl === 0x21) dl = 5;
    else if (dl > 0x13) dl = 0x13;
    setErrno(R8s(0x31674 + dl)); // table: dword [0x31671+dl] >> 24 (sar) = signed byte at 0x31674+dl
  } else {
    setErrno((code >> 8) & 0xff);
  }
  return -1;
}

// ---------------------------------------------------------------- low-level I/O (INT 21h wrappers)

// 0x23b9a: read(handle, buf, n) via AH=3Fh; -1 on error.
function qread(h, buf, n) {
  const r = dos.read(h, n);
  if (r.cf) return dosError(r.ax);
  u8.set(r.bytes, buf);
  return r.ax;
}

// 0x2477f: write(handle, buf, n) via AH=40h; for an APPEND handle first AH=42h AL=2 (0x24791..0x247a2).
// A short write sets errno = 0xC (ENOSPC, 0x247df) but returns the count.
function qwrite(h, buf, n) {
  if (ioMode[h] & 0x80) {
    const s = dos.lseek(h, 0, 2);
    if (s.cf) return dosError(s.ax);
  }
  const r = dos.write(h, u8.slice(buf, buf + n));
  if (r.cf) return dosError(r.ax);
  if (r.ax !== n) setErrno(0xc);
  return r.ax;
}

// 0x24bc4: lseek(handle, offset, whence) via AH=42h.
// ORIGINAL BUG: the error test after the INT (0x24c05: xor edx,edx; mov dx,ax; test edx,edx; jge) can
// never see a negative value, so a failing lseek returns DX:AX = (low word of offset):(DOS error code)
// and errno is not set.
function lseek(h, offset, whence) {
  const r = dos.lseek(h, offset, whence);
  if (r.cf) return (((offset & 0xffff) << 16) | (r.ax & 0xffff)) | 0;
  return r.value | 0;
}
const tell = (h) => lseek(h, 0, 1); // 0x26a23

// 0x2732b: isatty = IOCTL AX=4400h, DX bit 7.
function isatty(h) {
  const r = dos.ioctlGetInfo(h);
  if (r.cf) return 0; // UNCERTAIN: on error the original tests whatever DX held before the INT
  return (r.dx & 0x80) ? 1 : 0;
}

// 0x24c29: close(handle) via AH=3Eh; on error errno = 4 (EBADF), -1.
function dosClose(h) {
  const r = dos.close(h);
  if (r.cf) { setErrno(4); return -1; }
  ioMode[h] = 0;
  return 0;
}

// ---------------------------------------------------------------- stream internals

// 0x2474e __chktty: if not yet ISTTY and the handle is a device: set ISTTY, and IOLBF if no buffering
// mode (0x100/0x200/0x400) was chosen.
function chktty(fp) {
  if (flag(fp) & _ISTTY) return;
  if (isatty(handle(fp))) {
    orFlag(fp, _ISTTY);
    if ((flag(fp) & 0x700) === 0) orFlag(fp, _IOLBF);
  }
}

// 0x23b13 __ioalloc: choose bufsize (0x86 line-buffered, 1 unbuffered, else 0x1000) unless set,
// malloc it; on failure fall back to the 1-byte _ungotten field with IONBF.
function ioalloc(fp) {
  chktty(fp);
  if (bufsize(fp) === 0) {
    if (flag(fp) & _IOLBF) W32(fp + 0x14, 0x86);
    else if (flag(fp) & _IONBF) W32(fp + 0x14, 1);
    else W32(fp + 0x14, 0x1000);
  }
  W32(link(fp) + 8, malloc(bufsize(fp)));
  if (base(fp) === 0) {
    setFlag(fp, (flag(fp) & ~0x700) | _IONBF); // byte +0xd: and 0xf8; or 4
    W32(link(fp) + 8, fp + 0x18);
    W32(fp + 0x14, 1);
  } else {
    orFlag(fp, _BIGBUF);
  }
  setCnt(fp, 0);
  setPtr(fp, base(fp));
}

// 0x26142: flush every open stream having `mask` in its flags that is DIRTY; returns how many matched.
function flushMatching(mask) {
  let n = 0;
  for (let l = R32u(OPEN_LIST); l !== 0; l = R32u(l)) {
    const fp = R32u(l + 4);
    if (flag(fp) & mask) {
      n++;
      if (flag(fp) & _DIRTY) flush(fp);
    }
  }
  return n;
}

// 0x26171: console getche for an unbuffered stdin: ungetch buffer [0x3112c] (cleared), else INT 21h AH=01h
// (read with echo) & 0xFF.
function getche() {
  const u = R32(0x3112c);
  W32(0x3112c, 0);
  if (u !== 0) return u;
  const c = con.dosReadCharNoEcho();
  if (c === null) throw new Error('crt: console read would block (unbuffered stdin)');
  con.write([c]);
  return c & 0xff;
}

// 0x23c90 __fill_buffer: returns the new _cnt (0 on EOF/error).
function fillBuffer(fp) {
  if (base(fp) === 0) ioalloc(fp);
  if ((flag(fp) & _ISTTY) && (flag(fp) & (_IOLBF | _IONBF))) flushMatching(_ISTTY);
  andFlag(fp, ~_UNGET);
  setPtr(fp, base(fp));
  if ((flag(fp) & (_ISTTY | _IONBF)) === (_ISTTY | _IONBF) && handle(fp) === 0) {
    setCnt(fp, 0);
    const c = getche();
    if (c !== -1) {
      W8(ptr(fp), c);
      setCnt(fp, 1);
    }
  } else {
    const n = (flag(fp) & _IONBF) ? 1 : bufsize(fp);
    setCnt(fp, qread(handle(fp), ptr(fp), n));
  }
  if (cnt(fp) <= 0) {
    if (cnt(fp) === 0) orFlag(fp, _EOF);
    else { setCnt(fp, 0); orFlag(fp, _SFERR); }
  }
  return cnt(fp);
}

// 0x23c61 __filbuf: refill, then take one byte (or -1).
function filbuf(fp) {
  if (fillBuffer(fp) === 0) return -1;
  setCnt(fp, cnt(fp) - 1);
  const p = ptr(fp);
  setPtr(fp, p + 1);
  return R8(p);
}

// 0x247ff __flush. Returns 0 or -1.
function flush(fp) {
  let ret = 0;
  if (flag(fp) & _DIRTY) {
    andFlag(fp, ~_DIRTY);
    if ((flag(fp) & _WRITE) && base(fp) !== 0) {
      let p = base(fp);
      let left = cnt(fp);
      while (left !== 0 && ret === 0) {
        let w = qwrite(handle(fp), p, left);
        if (w === -1) { orFlag(fp, _SFERR); ret = -1; }
        else if (w === 0) { setErrno(0xc); orFlag(fp, _SFERR); ret = -1; }
        p += w;
        left -= w;
      }
    }
  } else if (base(fp) !== 0) {
    andFlag(fp, ~_EOF);
    if (!(flag(fp) & _ISTTY)) {
      // give back the read-ahead: lseek(handle, -_cnt, SEEK_CUR)
      let r = 0;
      if (cnt(fp) !== 0) r = lseek(handle(fp), -cnt(fp), 1);
      if (r === -1) { orFlag(fp, _SFERR); ret = -1; }
    }
  }
  setCnt(fp, 0);
  setPtr(fp, base(fp));
  if (ret === 0 && (R32u(link(fp) + 0x10) & 1)) {
    // 0x27349: commit (INT 21h AH=68h)
    const r = dos.commit(handle(fp));
    if (r.cf && dosError(r.ax) === -1) ret = -1;
  }
  return ret;
}

// 0x248fd: internal fputc(c, fp). Text mode writes '\n' as "\r\n". Flushes when the buffer is full,
// on '\n' if line-buffered (mask 0x600), always if unbuffered (mask 0x400). Returns c or -1.
function putc(c, fp) {
  const l = link(fp);
  const o = R32(l + 0xc);
  if (o !== 1) {
    if (o !== 0) return -1;
    W32(l + 0xc, 1);
  }
  if (!(flag(fp) & _WRITE)) {
    setErrno(4);
    orFlag(fp, _SFERR);
    return -1;
  }
  if (base(fp) === 0) ioalloc(fp);
  let mask = _IONBF;
  if (c === 0x0a) {
    mask = _IOLBF | _IONBF;
    if (!(flag(fp) & _BINARY)) {
      orFlag(fp, _DIRTY);
      W8(ptr(fp), 0x0d);
      setPtr(fp, ptr(fp) + 1);
      setCnt(fp, cnt(fp) + 1);
      if (cnt(fp) === bufsize(fp)) {
        if (flush(fp) !== 0) return -1;
      }
    }
  }
  orFlag(fp, _DIRTY);
  W8(ptr(fp), c);
  setPtr(fp, ptr(fp) + 1);
  setCnt(fp, cnt(fp) + 1);
  if ((flag(fp) & mask) || cnt(fp) === bufsize(fp)) {
    if (flush(fp) !== 0) return -1;
  }
  return c & 0xff;
}

// 0x246f7: unlink fp's record from the open list, OR 3 into the flag's low byte (keeps an __iob slot
// reserved: 0x2464e skips entries with flag & 3), push the record on the free list.
function freeStream(fp) {
  let prev = OPEN_LIST;
  for (let l = R32u(prev); l !== 0; prev = l, l = R32u(l)) {
    if (R32u(l + 4) === fp) {
      W8(fp + 0xc, R8(fp + 0xc) | 3);
      W32(prev, R32u(l));
      W32(l, R32u(FREE_LIST));
      W32(FREE_LIST, l);
      return;
    }
  }
}

// 0x2464e: get a FILE: reuse a record from the free list (its FILE: flag = (old & 0x4003) | 3), else the
// first __iob entry with (flag & 3) == 0 plus malloc(0x15) for its record, else malloc(0x2f) holding
// record + FILE (flag 0x4003). The FILE is zeroed. Returns FILE* or 0 (errno 5).
function allocStream() {
  let rec = R32u(FREE_LIST);
  let fp, fl;
  if (rec !== 0) {
    fp = R32u(rec + 4);
    fl = (flag(fp) & 0x4003) | 3; // and edi,0x4003; or di,3
    W32(FREE_LIST, R32u(rec));
  } else {
    fp = 0;
    for (let f = IOB; f < IOB_END; f += FILE_SIZE) {
      if ((R8(f + 0xc) & 3) === 0) { fp = f; break; }
    }
    if (fp !== 0) {
      rec = malloc(0x15);
      if (rec === 0) { setErrno(5); return 0; }
      fl = 3;
    } else {
      rec = malloc(0x2f);
      if (rec === 0) { setErrno(5); return 0; }
      fp = rec + 0x15;
      fl = 0x4003;
    }
  }
  u8.fill(0, fp, fp + FILE_SIZE);
  setFlag(fp, fl);
  W32(rec + 4, fp);
  W32(fp + 8, rec);
  W32(rec, R32u(OPEN_LIST));
  W32(OPEN_LIST, rec);
  return fp;
}

// 0x2240f: parse the fopen mode. Returns the stream flags (0 = invalid, errno 9) and the commit bit.
//   first char: 'r' -> READ, 'w' -> WRITE, 'a' -> WRITE|APPEND (0x82); anything else invalid.
//   then, until NUL: '+' -> READ|WRITE; 't' text; 'b' BINARY; 'c' commit on; 'n' commit off;
//   other characters are skipped; a repeated '+', a second 't'/'b', or a second 'c'/'n' ends parsing
//   (the flags collected so far are kept). Commit starts as ([0x312cc] == 1).
//   If neither 't' nor 'b' was given and _fmode [0x314d9] == 0x200 (O_BINARY) -> BINARY
//   (_fmode is 0x100 = O_TEXT in the data image, so the default is text).
function parseMode(mode) {
  let commit = R32(COMMODE) === 1 ? 1 : 0;
  let fl = 0;
  let p = mode;
  const c0 = R8(p);
  if (c0 === 0x72) fl |= _READ;
  else if (c0 === 0x77) fl |= _WRITE;
  else if (c0 === 0x61) fl |= _WRITE | _APPEND;
  else { setErrno(9); return { fl: 0, commit }; }
  let plus = false, tb = false, cn = false;
  for (;;) {
    p++;
    const c = R8(p);
    if (c === 0) break;
    if (c === 0x2b) { if (plus) break; fl |= _READ | _WRITE; plus = true; }
    else if (c === 0x74) { if (tb) break; tb = true; }
    else if (c === 0x62) { if (tb) break; fl |= _BINARY; tb = true; }
    else if (c === 0x63) { if (cn) break; commit |= 1; cn = true; }
    else if (c === 0x6e) { if (cn) break; commit &= ~1; cn = true; }
  }
  if (!tb && R32(FMODE) === 0x200) fl |= _BINARY;
  return { fl, commit };
}

// 0x243d2 _sopen(name, oflag, shflag, pmode). Leading spaces of the name are skipped.
// O_RDONLY 0, O_WRONLY 1, O_RDWR 2, O_APPEND 0x10, O_CREAT 0x20, O_TRUNC 0x40, O_NOINHERIT 0x80,
// O_TEXT 0x100, O_BINARY 0x200, O_EXCL 0x400 (bit values as tested by the code).
function sopen(name, oflag, shflag, pmode) {
  while (R8(name) === 0x20) name++;
  const nm = readCString(name);
  const acc = oflag & 0x83;
  let h = -1;
  let r = dos.open(nm, (acc | shflag) & 0xff);
  let err = r.ax;
  if (!r.cf) {
    h = r.ax & 0xffff;
    if (h >= R32u(MAX_HANDLES)) { dos.close(h); setErrno(0xb); return -1; }
  }
  if ((oflag & 3) && h !== -1 && !isatty(h)) {
    if ((oflag & 0x400) && (oflag & 0x20)) { dos.close(h); setErrno(7); return -1; }
    if (oflag & 0x40) {
      const t = dos.write(h, new Uint8Array(0)); // AH=40h CX=0: truncate
      if (t.cf) { dos.close(h); return dosError(t.ax); }
    }
  }
  if (h === -1) {
    if (!(oflag & 0x20) || err !== 2) return dosError(err);
    let pm = pmode === 0 ? 0x180 : pmode;
    pm &= ~R32(UMASK);
    const c = dos.create(nm, (pm & 0x80) ? 0 : 1);
    if (c.cf) return dosError(c.ax);
    h = c.ax & 0xffff;
    if (h >= R32u(MAX_HANDLES)) { dos.close(h); setErrno(0xb); return -1; }
    if (shflag !== 0) {
      const cl = dos.close(h);
      if (cl.cf) return dosError(cl.ax);
      const o = dos.open(nm, (acc | shflag) & 0xff);
      if (o.cf) return dosError(o.ax);
      h = o.ax & 0xffff;
    }
  }
  // 0x24572..0x245db: handle mode bits
  let m = 0;
  if (isatty(h)) m |= 0x2000;
  const a = acc & 0x7f;
  if (a === 2) m |= 3;
  if (a === 0) m |= 1;
  if (a === 1) m |= 2;
  if (oflag & 0x10) m |= 0x80;
  if (oflag & 0x300) { if (oflag & 0x200) m |= 0x40; }
  else if (R32(FMODE) === 0x200) m |= 0x40;
  ioMode[h] = m;
  return h;
}

// 0x2252a: open the file for a fresh FILE (fp) with the parsed flags.
function openStream(name, modeChar, fl, commit, shflag, fp) {
  setFlag(fp, (flag(fp) & ~3) | fl); // and byte [fp+0xc],0xfc; or [fp+0xc],ebx
  let oflag, pmode;
  const mc = (modeChar >= 0x41 && modeChar <= 0x5a) ? modeChar + 0x20 : modeChar; // tolower 0x24379
  if (mc === 0x72) {
    oflag = (fl & _WRITE) ? 2 : 0;
    oflag |= (fl & _BINARY) ? 0x200 : 0x100;
    pmode = 0;
  } else {
    oflag = ((fl & _READ) ? 1 : 0) + 0x21; // O_CREAT | (O_RDWR or O_WRONLY)
    oflag |= (fl & _APPEND) ? 0x10 : 0x40; // O_APPEND or O_TRUNC
    oflag |= (fl & _BINARY) ? 0x200 : 0x100;
    pmode = 0x180;
  }
  const h = sopen(name, oflag, shflag, pmode);
  W32(fp + 0x10, h);
  if (h === -1) {
    freeStream(fp);
    return 0;
  }
  setCnt(fp, 0);
  W32(fp + 0x14, 0);
  W32(link(fp) + 0xc, 0);
  W32(link(fp) + 0x10, commit);
  W32(link(fp) + 8, 0);
  if (fl & _APPEND) fseek(fp, 0, 2);
  chktty(fp);
  return fp;
}

// 0x22606 _fsopen(name, mode, shflag)
function fsopen(name, mode, shflag) {
  const { fl, commit } = parseMode(mode);
  if (fl === 0) return 0;
  const fp = allocStream();
  if (fp === 0) return 0;
  return openStream(name, R8(mode), fl, commit, shflag, fp);
}

// 0x229e5 __doclose(fp, closeHandle)
function doclose(fp, closeHandle) {
  if (flag(fp) === 0) return -1;
  let ret = 0;
  if (flag(fp) & _DIRTY) ret = flush(fp);
  const pos = ftell(fp);
  if (pos !== -1) lseek(handle(fp), pos, 0);
  if (closeHandle) ret |= dosClose(handle(fp));
  if (flag(fp) & _BIGBUF) {
    free(base(fp));
    W32(link(fp) + 8, 0);
  }
  if (flag(fp) & _TMPFIL) throw new Error('crt: tmpfile removal (0x22a5a) not implemented — not used by the game');
  return ret;
}

// 0x2291a
function closeStream(fp, closeHandle) {
  const r = doclose(fp, closeHandle);
  freeStream(fp);
  return r;
}

// ---------------------------------------------------------------- public functions

// 0x2264a fopen(name, mode) = _fsopen(name, mode, 0)
export function fopen(name, mode) { return fsopen(name, mode, 0); }

// 0x1e110 fread(buf, size, n, fp)
export function fread(buf, size, n, fp) {
  if (!(flag(fp) & _READ)) {
    setErrno(4);
    orFlag(fp, _SFERR);
    return 0;
  }
  let bytes = Math.imul(n, size) >>> 0;
  if (bytes === 0) return 0;
  if (base(fp) === 0) ioalloc(fp);
  let got = 0;
  let dst = buf >>> 0;
  if (flag(fp) & _BINARY) {
    let left = bytes;
    for (;;) {
      if (cnt(fp) !== 0) {
        const k = Math.min(cnt(fp) >>> 0, left);
        u8.copyWithin(dst, ptr(fp), ptr(fp) + k);
        dst += k;
        got += k;
        setPtr(fp, ptr(fp) + k);
        left -= k;
        setCnt(fp, cnt(fp) - k);
      }
      if (left === 0) break;
      if (left >= bufsize(fp) || (flag(fp) & _IONBF)) {
        // read directly into the caller's buffer, in whole 512-byte units unless unbuffered
        setCnt(fp, 0);
        setPtr(fp, base(fp));
        let want = left;
        if (!(flag(fp) & _IONBF) && want > 0x200) want &= ~0x1ff;
        const r = qread(handle(fp), dst, want);
        if (r === -1) { orFlag(fp, _SFERR); break; }
        if (r === 0) { orFlag(fp, _EOF); break; }
        dst += r;
        left -= r;
        got += r;
      } else if (fillBuffer(fp) === 0) {
        break;
      }
    }
  } else {
    // Text mode (0x1e26b..0x1e2dd): every '\r' is dropped and the byte after it is taken as is
    // (so "\r\n" -> '\n', "\rX" -> 'X', "\r\r\n" -> "\r\n"; a '\r' at end of file is dropped);
    // 0x1A (after this) sets EOF and ends the read; the 0x1A itself is consumed.
    const end = dst + bytes;
    for (;;) {
      if (cnt(fp) === 0 && fillBuffer(fp) === 0) break;
      setCnt(fp, cnt(fp) - 1);
      let p = ptr(fp);
      setPtr(fp, p + 1);
      let c = R8(p);
      if (c === 0x0d) {
        if (cnt(fp) === 0 && fillBuffer(fp) === 0) break;
        setCnt(fp, cnt(fp) - 1);
        p = ptr(fp);
        setPtr(fp, p + 1);
        c = R8(p);
      }
      if (c === 0x1a) { orFlag(fp, _EOF); break; }
      W8(dst, c);
      got++;
      dst++;
      if (dst === end) break;
    }
  }
  return Math.floor(got / (size >>> 0)); // unsigned div (0x1e2e8)
}

// 0x2270d fwrite(buf, size, n, fp)
export function fwrite(buf, size, n, fp) {
  if (!(flag(fp) & _WRITE)) {
    setErrno(4);
    orFlag(fp, _SFERR);
    return 0;
  }
  const bytes = Math.imul(n, size) >>> 0;
  if (bytes === 0) return 0;
  if (base(fp) === 0) ioalloc(fp);
  const saved = flag(fp) & (_EOF | _SFERR);
  andFlag(fp, ~(_EOF | _SFERR));
  let done = 0;
  let src = buf >>> 0;
  if (flag(fp) & _BINARY) {
    let left = bytes;
    for (;;) {
      let k;
      if (cnt(fp) === 0 && left >= bufsize(fp)) {
        let w = left & ~0x1ff;
        if (w === 0) w = left;
        k = qwrite(handle(fp), src, w);
        if (k === -1) orFlag(fp, _SFERR);
        else if (k === 0) { setErrno(0xc); orFlag(fp, _SFERR); }
      } else {
        k = Math.min(bufsize(fp) - cnt(fp), left);
        u8.copyWithin(ptr(fp), src, src + k);
        setCnt(fp, cnt(fp) + k);
        setPtr(fp, ptr(fp) + k);
        orFlag(fp, _DIRTY);
        if (cnt(fp) === bufsize(fp) || (flag(fp) & _IONBF)) flush(fp);
      }
      src += k;
      done += k;
      left -= k;
      if (left === 0) break;
      if (flag(fp) & _SFERR) break;
    }
  } else {
    // Text mode: byte by byte through fputc (0x248fd), which turns '\n' into "\r\n".
    // An unbuffered stream is switched to full buffering for the duration, then flushed (0x22853, 0x228a7).
    let wasNbf = false;
    if (flag(fp) & _IONBF) {
      setFlag(fp, (flag(fp) & ~(_IONBF | _IOFBF)) | _IOFBF);
      wasNbf = true;
    }
    const l = link(fp);
    const o = R32(l + 0xc);
    W32(l + 0xc, 1);
    for (;;) {
      putc(R8(src), fp);
      src++;
      if (flag(fp) & (_EOF | _SFERR)) break;
      done++;
      if (done === bytes) break;
    }
    W32(l + 0xc, o);
    if (wasNbf) {
      setFlag(fp, (flag(fp) & ~(_IONBF | _IOFBF)) | _IONBF);
      flush(fp);
    }
  }
  if (flag(fp) & _SFERR) done = 0;
  orFlag(fp, saved);
  return Math.floor(done / (size >>> 0));
}

// 0x228ed fclose(fp): fp must be on the open list, else -1.
export function fclose(fp) {
  for (let l = R32u(OPEN_LIST); l !== 0; l = R32u(l)) {
    if (R32u(l + 4) === (fp >>> 0)) return closeStream(fp, 1);
  }
  return -1;
}

// 0x23bb9 fgetc(fp). Text mode: '\r' is dropped and the next byte returned; 0x1A sets EOF, returns -1.
export function fgetc(fp) {
  const l = link(fp);
  const o = R32(l + 0xc);
  if (o !== 1) {
    if (o !== 0) return -1;
    W32(l + 0xc, 1);
  }
  let c;
  if (!(flag(fp) & _READ)) {
    setErrno(4);
    orFlag(fp, _SFERR);
    c = -1;
  } else {
    setCnt(fp, cnt(fp) - 1);
    if (cnt(fp) < 0) c = filbuf(fp);
    else { const p = ptr(fp); c = R8(p); setPtr(fp, p + 1); }
  }
  if (flag(fp) & _BINARY) return c;
  if (c === 0x0d) {
    setCnt(fp, cnt(fp) - 1);
    if (cnt(fp) < 0) c = filbuf(fp);
    else { const p = ptr(fp); c = R8(p); setPtr(fp, p + 1); }
  }
  if (c === 0x1a) {
    orFlag(fp, _EOF);
    c = -1;
  }
  return c;
}
// NOTE (0x23c00): fgetc decrements _cnt before testing it, so after the buffer is exhausted _cnt is -1
// until __filbuf refills it (the refill overwrites it). This matters for code reading _cnt directly
// (PCX_Load's inline getc tests `_cnt > 0`, so -1 and 0 behave the same there).

// 0x23e8c: try to move inside the buffer by `off`; 0 on success.
function seekInBuffer(off, fp) {
  if (off > cnt(fp)) return 1;
  if (off < ((base(fp) - ptr(fp)) | 0)) return 1;
  andFlag(fp, ~_EOF);
  setPtr(fp, ptr(fp) + off);
  setCnt(fp, cnt(fp) - off);
  return 0;
}
// 0x23ecb
function resetBuffer(fp) {
  andFlag(fp, ~_EOF);
  setCnt(fp, 0);
  setPtr(fp, base(fp));
}

// 0x23ee1 fseek(fp, offset, whence). Returns 0 or -1.
export function fseek(fp, offset, whence) {
  offset |= 0;
  if (flag(fp) & (_WRITE | _UNGET)) {
    if (flag(fp) & _DIRTY) {
      if (flush(fp) !== 0) {
        if (whence === 0 && offset < 0) setErrno(9);
        return -1;
      }
    } else {
      if (whence === 1) offset = (offset - cnt(fp)) | 0;
      setCnt(fp, 0);
      setPtr(fp, base(fp));
    }
    andFlag(fp, ~(_EOF | _UNGET));
    if (lseek(handle(fp), offset, whence) === -1) return -1;
    return 0;
  }
  if (whence === 1) {
    const c = cnt(fp);
    if (seekInBuffer(offset, fp) === 0) return 0;
    if (lseek(handle(fp), (offset - c) | 0, 1) === -1) return -1;
    resetBuffer(fp);
    return 0;
  }
  if (whence === 0) {
    const cur = (tell(handle(fp)) - cnt(fp)) | 0;
    if (seekInBuffer((offset - cur) | 0, fp) === 0) return 0;
    if (lseek(handle(fp), offset, 0) === -1) return -1;
    resetBuffer(fp);
    return 0;
  }
  if (whence === 2) {
    andFlag(fp, ~_EOF);
    setPtr(fp, base(fp));
    setCnt(fp, 0);
    if (lseek(handle(fp), offset, 2) === -1) return -1;
    return 0;
  }
  setErrno(9);
  return -1;
}

// 0x24b81 ftell(fp): raw file position (no text-mode adjustment): handle position minus unread
// buffered bytes, or plus pending written bytes when DIRTY.
export function ftell(fp) {
  if ((flag(fp) & _APPEND) && (flag(fp) & _DIRTY)) flush(fp); // 0x27770
  const pos = tell(handle(fp));
  if (pos === -1) return -1;
  const c = cnt(fp);
  if (c === 0) return pos;
  return (flag(fp) & _DIRTY) ? (c + pos) | 0 : (pos - c) | 0;
}

// 0x23783 printf(fmt, ...) -> vfprintf(stdout) 0x24e96 -> formatter 0x27ef0 with callback 0x24e85
// (each character goes through fputc 0x248fd; the count is incremented even if fputc fails).
// Format support: literal characters, "%s" and "%%" only — the game's format strings are the texts at
// 0x30493..0x305d1 (no conversions), "\nPCX SYSTEM - Couldn't find file: %s" (0x30610) and two without
// conversions (0x305dc, 0x30635). UNCERTAIN: the formatter's handling of flags/width/other conversions was
// not traced; any other conversion throws.
export function vfprintf(fp, fmt, args) {
  const l = link(fp);
  const o = R32(l + 0xc);
  if (o !== 1) {
    if (o !== 0) return 0;
    W32(l + 0xc, 1);
  }
  const saved = flag(fp) & (_EOF | _SFERR);
  andFlag(fp, ~(_EOF | _SFERR));
  if (base(fp) === 0) ioalloc(fp);
  let wasNbf = false;
  if (flag(fp) & _IONBF) {
    setFlag(fp, (flag(fp) & ~(_IONBF | _IOFBF)) | _IOFBF);
    wasNbf = true;
  }
  let count = 0;
  const out = (c) => { putc(c, fp); count++; };
  let ai = 0;
  for (let p = fmt; ; p++) {
    const c = R8(p);
    if (c === 0) break;
    if (c !== 0x25) { out(c); continue; }
    p++;
    const s = R8(p);
    if (s === 0x73) {
      const a = args[ai++] >>> 0;
      if (a === 0) throw new Error('printf: %s with NULL (not used by the game; formatter behaviour not traced)');
      for (let q = a; R8(q) !== 0; q++) out(R8(q));
    } else if (s === 0x25) {
      out(0x25);
    } else {
      throw new Error('printf: unsupported conversion %' + String.fromCharCode(s) + ' (not used by the game)');
    }
  }
  if (wasNbf) {
    setFlag(fp, (flag(fp) & ~(_IONBF | _IOFBF)) | _IONBF);
    flush(fp);
  }
  if (flag(fp) & _SFERR) count = -1;
  orFlag(fp, saved);
  return count;
}
export function printf(fmt, ...args) { return vfprintf(STDOUT, fmt, args); }

// ---------------------------------------------------------------- C++ cin >> char*

// 0x64eb8 is `cin`: the static initializer 0x222c1 builds a stdiobuf at 0x64e80 on __iob[0] (stdin,
// 0x241f2(0) = 0x312d0; FILE* at stdiobuf+0x2c, 0x24211) and the istream at 0x64eb8 on it
// (0x24226; vbtable 0x30a84 -> virtual base ios at +0x10 = 0x64ec8), tied to cout 0x65198 and with skipws
// set (0x22308). The stdiobuf underflow (vtable 0x309f4 slot +0x10 = 0x26cde) reads ONE character with
// fgetc(stdin) (0x26d8f / 0x26dc7) and keeps it in its get area until consumed.
// So the input source is stdin -> DOS handle 0 -> the console (cooked line input).
// ios fields used (addresses for cin): state +0x10 = 0x64ed8 (bits: 1 bad, 2 fail, 4 eof),
// exceptions +0x14 = 0x64edc, width +0x1c = 0x64ee4; istream gcount +4 = 0x64ebc.
// Not modelled in memory: the stdiobuf get area (a peeked character is kept in `cinPeek` here), the tie
// flush (ostream::flush of cout, 0x270f6 -> stdiobuf::sync 0x26e4d; cout's put area is never used by the
// game, so it does nothing), and throwing on `state & exceptions` (0x24351; exceptions are 0).
// This whole path is dead in this binary: istream_extract_cstr is only called from 0x10676 when [0x31ee0]
// != 0, and 0x31ee0 is only ever written by cstart's BSS clear (0x239dc).
const CIN = 0x64eb8, CIN_IOS = 0x64ec8;
const cinState = () => R32(CIN_IOS + 0x10);
function cinSetstate(b) { W32(CIN_IOS + 0x10, cinState() | b); } // 0x24351
let cinPeek = null; // character in the stdiobuf get area (null = empty)

async function stdinGet() {
  // fgetc(stdin) may need a console line: DOS would block inside AH=3Fh; wait for the line first.
  if (cnt(STDIN) <= 0 && dos.readWouldBlock(handle(STDIN))) {
    await con.waitLine(yieldCpu);
  }
  return fgetc(STDIN);
}
async function cinSgetc() { // peek (underflow when the get area is empty)
  if (cinPeek === null) {
    const c = await stdinGet();
    if (c === -1) return -1;
    cinPeek = c & 0xff;
  }
  return cinPeek;
}
function cinBump() { cinPeek = null; }
const isSpace = (c) => (R8(0x311c8 + ((c + 1) & 0xff)) & 2) !== 0; // ctype table, bit 2: 09..0D, 20

// 0x2231a istream &operator>>(istream &is, char *buf)
export async function istreamExtractCstr(is, buf) {
  if ((is >>> 0) !== CIN) throw new Error('istream_extract_cstr: only cin (0x64eb8) is modelled');
  let n = 0;
  // ipfx(0) (0x24317 -> 0x27136)
  let ok;
  if (cinState() !== 0) { cinSetstate(2); ok = 0; }
  else {
    W32(CIN + 4, 0); // gcount = 0
    // tie flush: no effect (see above). skipws is set -> eatwhite (0x2cd26)
    for (;;) {
      const c = await cinSgetc();
      if (c === -1) { cinSetstate(4); break; }
      if (cinState() & 3) break;
      if (!isSpace(c)) break;
      cinBump();
    }
    if (cinState() & 4) cinSetstate(2);
    ok = cinState() === 0 ? 1 : 0;
  }
  if (ok) {
    const lim = (R32(CIN_IOS + 0x1c) - 2) | 0;
    for (;;) {
      if (R32(CIN_IOS + 0x1c) !== 0 && n > lim) break;
      const c = await cinSgetc();
      if (c === -1) { if (n === 0) cinSetstate(4); break; }
      if (isSpace(c) || c === 0) break;
      W8(buf + n, c);
      n++;
      cinBump();
    }
  }
  if (n === 0) cinSetstate(2);
  W32(CIN_IOS + 0x1c, 0); // width = 0
  W8(buf + n, 0);
  return is;
}

// ---------------------------------------------------------------- startup / exit

// 0x271ba __InitFiles: stderr unbuffered; a link record (malloc 0x15) for every __iob entry with a
// non-zero flag (stdin..stdprn), pushed on the open list in table order; free list empty.
export function initFiles() {
  W8(STDERR + 0xd, (R8(STDERR + 0xd) & 0xf8) | 4);
  for (let fp = IOB; R32(fp + 0xc) !== 0; fp += FILE_SIZE) {
    const rec = malloc(0x15);
    if (rec === 0) throw new Error('crt: out of memory in __InitFiles');
    W32(rec + 4, fp);
    W32(rec, R32u(OPEN_LIST));
    W32(fp + 8, rec);
    W32(rec + 8, 0);
    W8(rec + 0x14, 0);
    W32(OPEN_LIST, rec);
    W32(rec + 0xc, 0);
  }
  W32(FREE_LIST, 0);
  ioMode.fill(0);
  cinPeek = null;
  W32(CIN, 0x30a84); // cin's vbtable pointer (0x24274); the other constructor effects are not modelled
  W32(CIN_IOS + 0x08, 0x65198); // tie = cout (0x22308)
  W32(CIN_IOS + 0x0c, R32(CIN_IOS + 0x0c) | 1); // skipws (0x22312)
}

// Exit (fini entry 0x2724c): 0x2725d(0) closes every open stream — std streams (__iob[0..4]) are flushed
// but their handles stay open — then 0x24730 frees the records on the free list.
export function closeAllAtExit() {
  let n = 0;
  for (let l = R32u(OPEN_LIST); l !== 0;) {
    const next = R32u(l);
    const fp = R32u(l + 4);
    let closeHandle = 1;
    if (!(flag(fp) & (_DYNAMIC | _TMPFIL))) {
      if (fp < IOB) { l = next; continue; } // 0x27297: jb -> not closed, not counted
      if (fp < IOB5) closeHandle = 0; // std streams: flushed, handle left open
    }
    closeStream(fp, closeHandle);
    n++;
    l = next;
  }
  for (let l = R32u(FREE_LIST); l !== 0;) {
    const next = R32u(l);
    free(l);
    W32(FREE_LIST, next);
    l = next;
  }
  return n;
}

register(0x2264a, 'fopen_2264a', function fopen_2264a(name, mode) { return fopen(name, mode); });
register(0x1e110, 'fread_1e110', function fread_1e110(buf, size, n, fp) { return fread(buf, size, n, fp); });
register(0x2270d, 'fwrite_2270d', function fwrite_2270d(buf, size, n, fp) { return fwrite(buf, size, n, fp); });
register(0x228ed, 'fclose_228ed', function fclose_228ed(fp) { return fclose(fp); });
register(0x23bb9, 'fgetc_23bb9', function fgetc_23bb9(fp) { return fgetc(fp); });
register(0x23ee1, 'fseek_23ee1', function fseek_23ee1(fp, offset, whence) { return fseek(fp, offset, whence); });
register(0x24b81, 'ftell_24b81', function ftell_24b81(fp) { return ftell(fp); });
register(0x23783, 'printf_23783', function printf_23783(fmt, ...args) { return printf(fmt, ...args); });
register(0x2231a, 'istream_extract_cstr_2231a', async function istream_extract_cstr_2231a(is, buf) {
  return istreamExtractCstr(is, buf);
});
