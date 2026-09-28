// Emulated stack for locals whose address is taken (passed to callees etc.).
// Grows downward from STACK_TOP, like the original ESP-relative frames.
// The original stack lived in object 2 at 0x667D0 (PMW1 header: stack object 2, offset 0x367D0).
import { u8 } from './mem.js';

export const STACK_TOP = 0x667d0;
// Bottom = end of BSS 0x657d0; the original stack is the 4 KB 0x657d0..0x667d0 (strictly, cstart copies the
// command line and program path upward from 0x657d0, and the lowest address the stack may reach is the end
// of that copy, [0x3111c], 0x28b77).
// (Was 0x667d0 - 0x8000, which overlapped BSS globals such as 0x60a70.)
// BSS contents: under PMODE/W ([0x3113a] == 1) Watcom cstart zeroes only the first 0x1000 bytes of BSS,
// 0x31ee0..0x32ee0 (0x239dc..0x23a0e; the clamp is 0x239ea..0x239fb); the rest is whatever the loader left.
// The loader has already zeroed it: the port's loader (mem.js loadInitialData) zeroes the whole data object
// beyond the initialized image, as the PMODE/W v1.31 PMW1 loader in GANJAFRM.EXE's stub does — traced at
// extender 0x28fc..0x2917: ECX = object virtual size (gs:[0x100]), EDX = initialized size (gs:[0x114]);
// if ECX > EDX: `rep stosb` of 0 over [base + EDX, base + ECX) (re/audit/round1/D-data/loader_disasm.txt;
// same logic as pmodewe.asm _loadPMW1 in the v1.33 source).
export const STACK_LIMIT = 0x657d0;
let sp = STACK_TOP;

export function stackAlloc(size) {
  size = (size + 3) & ~3;
  sp -= size;
  if (sp < STACK_LIMIT) throw new Error('emulated stack overflow');
  u8.fill(0xcc, sp, sp + size); // uninitialized in the original; make accidental reads visible
  return sp;
}

export function stackFree(size) {
  sp += (size + 3) & ~3;
  if (sp > STACK_TOP) throw new Error('emulated stack underflow');
}

export const stackPointer = () => sp;

// Test support (re/difftest): reset to an empty stack between independent runs.
export function stackReset() { sp = STACK_TOP; }
