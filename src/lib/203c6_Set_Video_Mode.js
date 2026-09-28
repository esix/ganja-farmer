// 0x203c6  void Set_Video_Mode(int mode)
//          [Watcom: EAX=mode; no return value]
// Builds a union REGS in a stack local with AH=0 (byte [ebp-0x1f]) and AL=(byte)mode (byte [ebp-0x20]),
// then calls int386(0x10, &inregs, &outregs) (0x23d5d, re/names.tsv). All other REGS bytes are left
// uninitialized, as in the original. The int386 result (EAX) is discarded.
// Frame: [ebp-0x3c..ebp-0x20) outregs (0x1c bytes), [ebp-0x20..ebp-4) inregs (0x1c bytes), [ebp-4] mode.
import { F, register } from '../runtime/registry.js';
import { W8 } from '../runtime/mem.js';
import { stackAlloc, stackFree } from '../runtime/stack.js';

register(0x203c6, 'Set_Video_Mode_203c6', function Set_Video_Mode(mode) {
  const frame = stackAlloc(0x38);   // address-taken locals: outregs at [ebp-0x3c], inregs at [ebp-0x20]
  const outregs = frame;            // [ebp-0x3c]
  const inregs = frame + 0x1c;      // [ebp-0x20]
  // 203de: [ebp-4] = mode (not address-taken; plain parameter)
  W8(inregs + 1, 0);                // 203e1: mov byte [ebp-0x1f], 0     (inregs.h.ah = 0)
  W8(inregs, mode & 0xff);          // 203e5..203e8: mov al,[ebp-4]; mov [ebp-0x20], al  (inregs.h.al = mode)
  F.int386_23d5d(0x10, inregs, outregs); // 203eb..203f6: EBX=&outregs, EDX=&inregs, EAX=0x10; call 0x23d5d
  stackFree(0x38);                  // 203fb..20403: epilogue, ret
});
