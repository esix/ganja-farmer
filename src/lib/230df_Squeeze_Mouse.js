// 0x230df  int Squeeze_Mouse(int cmd, int *x, int *y, int *buttons)
//          [Watcom: EAX=cmd, EDX=x, EBX=y, ECX=buttons; returns EAX = [ebp-0x10]]
// Mouse interface: switch on cmd (unsigned compares), each case fills inregs and calls
// int386(0x33, &inregs, &outregs) (0x23d5d, re/names.tsv); int386's own result is discarded.
//   0    : AX=0 (reset);  *buttons = (dword) outregs.w.bx;  returns (dword) outregs.w.ax
//   1    : AX=1 (show);   returns 1
//   2    : AX=2 (hide);   returns 1
//   3    : AX=3;          *x = outregs.w.cx, *y = outregs.w.dx, *buttons = outregs.w.bx (dword, zero-extended); returns 1
//   0x0B : AX=0x0B;       *x = outregs.w.cx, *y = outregs.w.dx (dword, zero-extended); returns 1
//   0x1A : AX=0x1A, BX=(word)*x, CX=(word)*y, DX=(word)*buttons; returns 1
//   other: no INT; returns 1
// REGS layout (Watcom union REGS, word view): ax +0, bx +4, cx +8, dx +0xc. Unwritten inregs bytes are left
// uninitialized, as in the original.
// Frame: [ebp-0x50..ebp-0x34) inregs (0x1c bytes), [ebp-0x34..ebp-0x18) outregs (0x1c bytes),
//        [ebp-0x18] cmd, [ebp-0x14] buttons, [ebp-0x10] result, [ebp-0xc] x, [ebp-8] y, [ebp-4] switch value.
// Stage 2: calls the mouse driver directly (was INT 33h through int386 with REGS on the stack). Only the
// commands the game uses exist: 0 reset, 2 hide, 3 position/buttons; 1, 0Bh and 1Ah throw.
import { register } from '../runtime/registry.js';
import { W32 } from '../runtime/mem.js';
import { driverReset, hideCursor, getState } from '../platform/mouse.js';

register(0x230df, 'Squeeze_Mouse_230df', function Squeeze_Mouse(cmd, x, y, buttons) {
  switch (cmd >>> 0) {
    case 0: W32(buttons, driverReset()); return 0xffff;   // *buttons = BX; result = AX (FFFFh: installed)
    case 2: hideCursor(); return 1;
    case 3: {
      const s = getState();
      W32(x, s.x); W32(y, s.y); W32(buttons, s.buttons);
      return 1;
    }
    case 1: case 0xb: case 0x1a:
      throw new Error('Squeeze_Mouse: command 0x' + cmd.toString(16) + ' is not used by the game');
    default: return 1;
  }
});
