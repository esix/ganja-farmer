// Watcom C runtime subset used by GANJAFRM.EXE (game code and LaMothe library), implemented once to the
// behaviour of THIS binary's CRT (addresses cited). Importing this module registers every CRT entry point
// with the registry (keys `<name>_<addr>`, names from re/names.tsv).
//   crt_heap.js  : malloc_23dab, free_23ff0
//   crt_stdio.js : fopen_2264a, fread_1e110, fwrite_2270d, fclose_228ed, fgetc_23bb9, fseek_23ee1,
//                  ftell_24b81, printf_23783, istream_extract_cstr_2231a
//   this file    : rand/srand, abs/labs, div, __CHP, atan/cos/sin, strlen/memset/memcpy, outp/inp, int386,
//                  kbhit/getch, _dos_getvect/_dos_setvect
// Call crtInit() once after the data image is loaded and before main (it performs what cstart's
// __InitFiles 0x271ba and the cin initializer do); crtExit() when main returns (fini entry 0x2724c).
import { F, register } from '../runtime/registry.js';
import { u8, R32, R32u, W32 } from '../runtime/mem.js';
import { yieldCpu } from '../runtime/cpu.js';
import { outb, inb, int86 } from '../runtime/io.js';
import * as x87 from '../runtime/x87.js';
import * as con from '../platform/console.js';
import './crt_heap.js';
import { initFiles, closeAllAtExit } from './crt_stdio.js';

export { heapReset } from './crt_heap.js';

export function crtInit() { initFiles(); }
export function crtExit() { closeAllAtExit(); }

// ---------------------------------------------------------------- rand / srand
// 0x232c1 __get_rand_state: returns 0x310e8 (the per-thread seed; single-threaded build -> constant).
register(0x232c1, '__get_rand_state_232c1', function __get_rand_state_232c1() { return 0x310e8; });

// 0x232c7 rand: p = __get_rand_state(); if p != 0: *p = *p * 0x41C64E6D + 0x3039 (mod 2^32);
// return (*p >> 16) & 0x7FFF (shr: unsigned). If p == 0 it returns 0 (EAX = p) — cannot happen here.
// The seed dword at 0x310e8 is 1 in the data image.
register(0x232c7, 'rand_232c7', function rand_232c7() {
  const p = __get_rand_state();
  if (p === 0) return p;
  const s = (Math.imul(R32(p), 0x41c64e6d) + 0x3039) | 0;
  W32(p, s);
  return (s >>> 16) & 0x7fff;
});

// 0x232eb srand(seed): *__get_rand_state() = seed (all 32 bits). Returns nothing: the original leaves
// EAX = 0x310e8 (the state pointer from 0x232c1) as a leftover, and its only call site 0x1aa44 does not read
// EAX (next instruction `mov word [0x60ff0], 0xffff`), so per the return-value rule (PORTING.md "Functions")
// no value is returned (audit round1 F-risky F8).
register(0x232eb, 'srand_232eb', function srand_232eb(seed) {
  const p = __get_rand_state();
  if (p !== 0) W32(p, seed);
});
// rand/srand reach 0x232c1 through a CALL; it is called through F so the difftest sees the same call.
function __get_rand_state() { return F.__get_rand_state_232c1(); }

// ---------------------------------------------------------------- abs / labs / div
// 0x2377c abs: test eax,eax; jge; neg eax. abs(INT_MIN) = INT_MIN (neg overflows).
register(0x2377c, 'abs_2377c', function abs_2377c(x) { x |= 0; return x < 0 ? (-x | 0) : x; });
// 0x23d7a: byte-identical to abs (85 c0 7d 02 f7 d8 c3). Not in re/names.tsv; LIBRARY.md: "labs (?)".
// Called by Time_Delay 0x20436 as sub_23d7a (key kept as in names.tsv convention).
register(0x23d7a, 'sub_23d7a', function sub_23d7a(x) { x |= 0; return x < 0 ? (-x | 0) : x; });

// 0x23744 div(num, den) — Watcom returns the div_t struct through a hidden pointer in ESI
// (caller: `lea esi,[ebp-0x18]; call 0x23744`, 0x157b8). The port passes it as a third argument:
//   div_23744(num, den, resultPtr) -> resultPtr ; [resultPtr] = quot, [resultPtr+4] = rem.
// Both come from `cdq; idiv` (truncation toward 0, rem has the sign of num). As on the CPU, den == 0 or
// INT_MIN / -1 raise #DE (thrown here).
register(0x23744, 'div_23744', function div_23744(num, den, resultPtr) {
  num |= 0; den |= 0;
  if (den === 0 || (num === -0x80000000 && den === -1)) throw new Error('divide error (#DE) in div 0x23744');
  W32(resultPtr, (num / den) | 0);
  W32(resultPtr + 4, (num % den) | 0);
  return resultPtr;
});

// ---------------------------------------------------------------- x87 helpers (argument and result in ST0)
// FPU control word: [0x31784] = 0x127F loaded by 0x25e4a -> 0x2c640 (fldcw at 0x2c65d): precision 53 bits,
// round to nearest. FPATAN/FSIN/FCOS ignore precision control, so their results keep a 64-bit mantissa in
// ST0; they are returned as runtime/x87.js Ext values (correctly rounded to 64 bits). Game code must keep
// them as Ext until the original rounds them (fstp -> x87.toDouble/toFloat, arithmetic -> x87.fmul etc.,
// __CHP) — see PORTING.md "Floating point".
// 0x222a4 __CHP: FRNDINT with the rounding control forced to chop (CW high byte 0x1F) -> truncation toward 0.
// The result stays a floating value in ST0 (the caller then FISTPs it). Accepts a double or an Ext.
register(0x222a4, '__CHP_222a4', function __CHP_222a4(x) { return x87.chp(x); });

// 0x23686 atan: FLD1; FPATAN (-> atan2(x, 1) = atan(x)); the emulation call 0x24da0 is used only if bit 0
// of [0x31584] (no FPU) is set. Returns an Ext (64-bit mantissa).
// Precision: real FPUs guarantee an error < 1 ulp of the 64-bit result (Intel SDM Vol. 1 §8.3.10), not
// correct rounding; the port uses the correctly rounded 64-bit value (x87.js, note above GUARD). Not
// game-observable: over all ~238000 reachable atan inputs (audit re/audit/round1/F-risky/x87/sens.mjs,
// logs/sens_340.log) either faithful neighbour gives the same integer game state in 0x1977e/0x11c2a/0x12130;
// only the last bit of the stored doubles 0x61660/0x5ff40/0x5ff48 could differ from a given CPU.
register(0x23686, 'atan_st0_23686', function atan_st0_23686(x) { return x87.atan64(x); });
// 0x236cc cos / 0x236d6 sin: FCOS / FSIN; if C2 is set (|x| >= 2^63) the argument is reduced with FPREM
// by the 80-bit 2*pi constant at 0x310ec and the instruction retried (0x236e0) — reproduced exactly in
// x87.js. Return Ext values.
// Precision: as for atan, real FSIN/FCOS are faithful (< 1 ulp), not correctly rounded, and for
// pi/4 < |x| < 2^63 the FPU reduces internally with a 66-bit pi (error bound relative to that pi); the port
// uses the correctly rounded 64-bit value of the true function. Not game-observable: the game's arguments are
// atan results (|x| <= pi/2); re/audit/round1/F-risky/x87/sens.mjs and sens_wide.mjs (+-32 ulp in cos for
// x > pi/4, logs/sens_wide_340.log) find 0 integer changes over all ~238000 reachable inputs; only the last
// bit of 0x61660/0x5ff40/0x5ff48 could differ.
register(0x236cc, 'cos_st0_236cc', function cos_st0_236cc(x) { return x87.cos64(x); });
register(0x236d6, 'sin_st0_236d6', function sin_st0_236d6(x) { return x87.sin64(x); });

// ---------------------------------------------------------------- strings / memory
// 0x23d44 strlen: repne scasb for NUL.
register(0x23d44, 'strlen_23d44', function strlen_23d44(s) {
  let n = 0;
  while (u8[(s + n) >>> 0] !== 0) n++;
  return n;
});
// 0x23d81 memset(dst, c, n): the byte (DL) is replicated into a dword and stored (0x261d0); returns dst.
register(0x23d81, 'memset_23d81', function memset_23d81(dst, c, n) {
  dst >>>= 0; n >>>= 0;
  u8.fill(c & 0xff, dst, dst + n);
  return dst;
});
// 0x240eb memcpy(dst, src, n): `rep movsd` (n>>2 dwords) then `rep movsb` (n&3 bytes), forward; returns dst.
// Overlapping regions behave like that forward dword/byte copy (reproduced by copying in the same order).
register(0x240eb, 'memcpy_240eb', function memcpy_240eb(dst, src, n) {
  dst >>>= 0; src >>>= 0; n >>>= 0;
  if (src + n <= dst || dst + n <= src || dst <= src) {
    // no overlap, or dst below src: a forward copy gives the same result as the element-wise one
    u8.copyWithin(dst, src, src + n);
  } else {
    let d = dst, s = src;
    for (let i = n >>> 2; i > 0; i--, d += 4, s += 4) W32(d, R32(s));
    for (let i = n & 3; i > 0; i--, d++, s++) u8[d] = u8[s];
  }
  return dst;
});

// ---------------------------------------------------------------- port I/O, interrupts
// 0x23d99 outp(port, value): `mov al,dl; out dx,al` — a BYTE write. Returns EAX = port with its low byte
// replaced by the value (what is left in EAX; callers ignore it).
register(0x23d99, 'outp_23d99', function outp_23d99(port, value) {
  outb(port & 0xffff, value & 0xff);
  return ((port & ~0xff) | (value & 0xff)) | 0;
});
// 0x23da3 inp(port): `sub eax,eax; in al,dx` — a BYTE read, zero-extended.
register(0x23da3, 'inp_23da3', function inp_23da3(port) { return inb(port & 0xffff) & 0xff; });

// 0x23d5d int386(intno, inregs, outregs): union REGS = {eax, ebx, ecx, edx, esi, edi, cflag} (dwords,
// 0x2c6b1..0x2c6bf / 0x2c67c..0x2c68f). All six registers are loaded from inregs, INT intno executed, all
// six stored to outregs and cflag = CF ? 0xFFFFFFFF : 0 (`sbb eax,eax`, 0x2c68d). Returns outregs->eax.
// Segment registers are the program's own (segread 0x2618e), not modelled.
register(0x23d5d, 'int386_23d5d', function int386_23d5d(intno, inregs, outregs) {
  const r = {
    eax: R32u(inregs), ebx: R32u(inregs + 4), ecx: R32u(inregs + 8),
    edx: R32u(inregs + 0xc), esi: R32u(inregs + 0x10), edi: R32u(inregs + 0x14),
  };
  const o = int86(intno, r); // every io.js backend returns a register object or throws
  const get = (k) => (o[k] !== undefined ? o[k] : r[k]) >>> 0;
  W32(outregs, get('eax'));
  W32(outregs + 4, get('ebx'));
  W32(outregs + 8, get('ecx'));
  W32(outregs + 0xc, get('edx'));
  W32(outregs + 0x10, get('esi'));
  W32(outregs + 0x14, get('edi'));
  W32(outregs + 0x18, (o.cflag ?? o.cf) ? -1 : 0); // platform regs.js reports CF as cflag 0/1
  return R32(outregs);
});

// 0x24ccb _dos_getvect(intno): INT 21h AH=35h AL=intno (the Phar Lap AX=2502h path is taken only when the
// extender type [0x3113a] is 2..8; cstart sets it to 0, 1 or 9 at 0x23935, so never). Returns the far
// pointer ES:EBX in EDX:EAX (`mov edx,es; mov eax,ebx`, 0x24cf3/0x24cf6); here as {eax: offset, edx: selector}.
register(0x24ccb, '_dos_getvect_24ccb', function _dos_getvect_24ccb(intno) {
  const o = int86(0x21, { ah: 0x35, al: intno & 0xff }); // every io.js backend returns a register object or throws
  return { eax: o.ebx >>> 0, edx: o.es & 0xffff };
});
// 0x24cfb _dos_setvect(intno /*EAX*/, offset /*EBX*/, selector /*ECX, low word*/): INT 21h AH=25h AL=intno,
// DS:EDX = selector:offset (0x24d0e..0x24d21; EDX is saved/restored scratch, not an argument, so the JS
// parameters are (intno, offset, selector)). No return value.
register(0x24cfb, '_dos_setvect_24cfb', function _dos_setvect_24cfb(intno, offset, selector) {
  int86(0x21, { ah: 0x25, al: intno & 0xff, ds: selector & 0xffff, edx: offset >>> 0 });
});

// ---------------------------------------------------------------- keyboard (DOS console)
// kbhit/getch execute INT 21h AH=0Bh/08h in the original (0x2329e, 0x232b8). These CRT-internal DOS calls
// are served by platform/console.js directly, not through runtime/io.js int86 (re/HARDWARE.md §7).
// Not modelled: DOS checks for Ctrl-C/Ctrl-Break in AH=08h/0Bh and would then issue INT 23h.
// 0x2328d kbhit: if the ungetch buffer [0x3112c] != 0 -> 1; else INT 21h AH=0Bh and return (int)(signed
// char)AL, i.e. -1 (0xFF sign-extended) when a key is waiting, 0 otherwise.
register(0x2328d, 'kbhit_2328d', function kbhit_2328d() {
  if (R32(0x3112c) !== 0) return 1;
  const al = con.dosCheckInput();
  return (al << 24) >> 24;
});
// 0x232a4 getch: take and clear the ungetch buffer [0x3112c] (returned as the full dword if non-zero);
// else INT 21h AH=08h (no echo, waits for a key) and return AL & 0xFF. Extended keys give 0, then the
// scan code (DOS behaviour). Async: it waits for input.
register(0x232a4, 'getch_232a4', async function getch_232a4() {
  const u = R32(0x3112c);
  W32(0x3112c, 0);
  if (u !== 0) return u;
  let c;
  while ((c = con.dosReadCharNoEcho()) === null) await yieldCpu();
  return c & 0xff;
});
