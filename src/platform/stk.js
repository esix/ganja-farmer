// DiamondWare STK 2.22 TSR (STKRUN.EXE): the software-interrupt entry and its calling convention.
// The functions themselves (mixer, DWM player, ...) are reimplemented by the sound layer, which
// registers them with registerStkFunction(); until then stk.call throws "not implemented".
// See re/HARDWARE.md §5.
//
// Installation (STKRUN, real mode):
//   02da:0045 picks the vector: the first of INT 60h..66h whose real-mode vector is 0000:0000 or points
//   at an IRET (CFh) byte; 02da:001c hooks it with 07f0:0000. On a machine where nothing else uses
//   60h..66h this is INT 60h. The handler starts `EB 03 'S' 'T' 'K'` (07f0:0000: jmp +3, then the
//   signature bytes at +2..+4).
// Discovery by the game's client (0x1e859, called from the stub prologue 0x1e8d1 on first use):
//   for v = 60h..66h: DPMI 0200h (0x1e87a) -> CX:DX; skip if CX*16+DX == 0; DPMI 0002h BX=CX (0x1e893)
//   -> selector; if bytes [DX+2..DX+4] == 'S','T','K' (0x1e8a5..0x1e8b5) the vector is v. It is stored at
//   0x31087; the stubs call it through the table 0x30c63[v-0x60] -> `int 60h..66h; ret` (0x1e2f4..).
// Calling convention (client stubs 0x1e309 / 0x1e342 / 0x1e37f; TSR handler 07f0:0000..00d5):
//   EBX = fn<<16 | 6969h   (handler ignores the call unless BX == 6969h and fn <= 1Bh)
//   ECX = byte count of the argument block: 0 (0x1e309), 2 (0x1e342: the single WORD argument is in AX),
//         or n (0x1e37f: EAX = real-mode far pointer seg:off to n bytes of WORD arguments)
//   The handler pushes the argument words in memory order and far-calls the function (Pascal order:
//   word 0 = first parameter; a far pointer parameter is stored as seg at +0, off at +2 so that the pushes
//   leave it as off:seg on the stack).
//   Result: ECX = DX:AX of the function (CX = AX, the WORD result 1/0; high word = DX). All other
//   registers are returned unchanged (handler pops them). The stubs return EAX = ECX and the callers
//   mask with 0FFFFh.
// Initial handshake (0x1e941..0x1e956): fn 5 (XMaster) with AX = 6969h must return CX = 0Bh (STKRUN
// 0380:0b56 returns 0x0B for this magic value), otherwise the client reports error 0x64.
import { u8 } from '../runtime/mem.js';
import { loadRegs, outRegs } from './regs.js';
import { setRmVectorWord, rmLinear } from './dpmi.js';

export const STK_SEG = 0x0700; // UNCERTAIN: load address of the resident STKRUN is setup-dependent
let vector = 0; // installed vector (0 = not installed)

// Place the resident signature and hook the first free vector 60h..66h (all are free here: the
// emulated IVT holds no other handlers in that range).
export function installResident() {
  const a = rmLinear(STK_SEG, 0);
  u8.set([0xeb, 0x03, 0x53, 0x54, 0x4b], a); // jmp short +3; 'S' 'T' 'K'
  vector = 0x60;
  setRmVectorWord(vector, STK_SEG, 0);
  return vector;
}
export const stkVector = () => vector;

const functions = []; // fn -> (words: number[]) => number (32-bit DX:AX)
export function registerStkFunction(fn, impl) { functions[fn] = impl; }

export const stk = {
  // fn: STK function number; words: argument words in block order (see above). Returns DX:AX.
  call(fn, words) {
    const f = functions[fn];
    if (!f) throw new Error('stk: function 0x' + fn.toString(16) + ' not implemented');
    return f(words) >>> 0;
  },
};

// Helpers for function implementations: decode a far pointer argument (seg at words[i], off at words[i+1])
// to a flat address.
export const farArg = (words, i) => rmLinear(words[i], words[i + 1]);

// INT <vector> from the client stubs.
export function stkInterrupt(regs) {
  const s = loadRegs(regs);
  if ((s.ebx & 0xffff) !== 0x6969 || (s.ebx >>> 16) > 0x1b) return outRegs(s); // 07f0:005a..0067
  const fn = s.ebx >>> 16;
  const cx = s.ecx & 0xffff;
  let words;
  if (cx === 0) words = [];
  else if (cx === 2) words = [s.eax & 0xffff];
  else {
    // 07f0:0075..0085: DS:SI = EAX (seg:off), CX/2 words
    // (CX = 1 would make `loop` run 65536 times; no client call passes an odd count.)
    words = [];
    for (let i = 0; i < cx >> 1; i++) {
      const off = (s.eax + i * 2) & 0xffff; // SI wraps within the segment
      const p = rmLinear(s.eax >>> 16, off);
      words.push(u8[p] | (u8[p + 1] << 8));
    }
  }
  s.ecx = stk.call(fn, words);
  return outRegs(s);
}
