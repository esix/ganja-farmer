// 0x203c6  void Set_Video_Mode(int mode)
//          [Watcom: EAX=mode; no return value]
// Builds a union REGS in a stack local with AH=0 (byte [ebp-0x1f]) and AL=(byte)mode (byte [ebp-0x20]),
// then calls int386(0x10, &inregs, &outregs) (0x23d5d, re/names.tsv). All other REGS bytes are left
// uninitialized, as in the original. The int386 result (EAX) is discarded.
// Frame: [ebp-0x3c..ebp-0x20) outregs (0x1c bytes), [ebp-0x20..ebp-4) inregs (0x1c bytes), [ebp-4] mode.
// Stage 2: sets the mode on the VGA directly (was INT 10h AH=00h, AL=mode through int386 with REGS on the stack).
import { register } from '../runtime/registry.js';
import { setMode } from '../platform/vga.js';

register(0x203c6, 'Set_Video_Mode_203c6', function Set_Video_Mode(mode) {
  setMode(mode & 0xff);
});
