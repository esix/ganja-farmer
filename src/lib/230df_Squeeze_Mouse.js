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
import { F, register } from '../runtime/registry.js';
import { R16, W16, W32 } from '../runtime/mem.js';
import { stackAlloc, stackFree } from '../runtime/stack.js';

register(0x230df, 'Squeeze_Mouse_230df', function Squeeze_Mouse(cmd, x, y, buttons) {
  const frame = stackAlloc(0x38);   // address-taken locals: inregs at [ebp-0x50], outregs at [ebp-0x34]
  const inregs = frame;             // [ebp-0x50]
  const outregs = frame + 0x1c;     // [ebp-0x34]
  let result;                       // [ebp-0x10]
  // 23238..2327b: switch on [ebp-4] = cmd, unsigned compares (jb/jbe)
  switch (cmd >>> 0) {
    case 0:                                   // 2326c: cmp 0; jbe 0x2310b
      W16(inregs, 0);                         // 2310b: mov word [ebp-0x50], 0
      F.int386_23d5d(0x33, inregs, outregs);  // 23111..2311c
      W32(buttons, R16(outregs + 4));         // 23121..2312a: *buttons = outregs.w.bx (zero-extended)
      result = R16(outregs);                  // 2312c..23132: result = outregs.w.ax (zero-extended)
      break;                                  // 23135
    case 1:                                   // 23276: cmd < 2 and not 0
      W16(inregs, 1);                         // 2313a
      F.int386_23d5d(0x33, inregs, outregs);  // 23140..2314b
      result = 1;                             // 23150
      break;                                  // 23157
    case 2:                                   // 2323e: jbe 0x2315c
      W16(inregs, 2);                         // 2315c
      F.int386_23d5d(0x33, inregs, outregs);  // 23162..2316d
      result = 1;                             // 23172
      break;                                  // 23179
    case 3:                                   // 23260: cmp 3; je 0x2317e
      W16(inregs, 3);                         // 2317e
      F.int386_23d5d(0x33, inregs, outregs);  // 23184..2318f
      W32(x, R16(outregs + 8));               // 23194..2319d: *x = outregs.w.cx
      W32(y, R16(outregs + 0xc));             // 2319f..231a8: *y = outregs.w.dx
      W32(buttons, R16(outregs + 4));         // 231aa..231b3: *buttons = outregs.w.bx
      result = 1;                             // 231b5
      break;                                  // 231bc
    case 0xb:                                 // 2324e: jbe 0x231c1
      W16(inregs, 0xb);                       // 231c1
      F.int386_23d5d(0x33, inregs, outregs);  // 231c7..231d2
      W32(x, R16(outregs + 8));               // 231d7..231e0: *x = outregs.w.cx
      W32(y, R16(outregs + 0xc));             // 231e2..231eb: *y = outregs.w.dx
      result = 1;                             // 231ed
      break;                                  // 231f4
    case 0x1a:                                // 23258: cmp 0x1a; je 0x231f9
      W16(inregs, 0x1a);                      // 231f9
      W16(inregs + 4, R16(x));                // 231ff..23205: inregs.w.bx = (word)*x
      W16(inregs + 8, R16(y));                // 23209..2320f: inregs.w.cx = (word)*y
      W16(inregs + 0xc, R16(buttons));        // 23213..23219: inregs.w.dx = (word)*buttons
      F.int386_23d5d(0x33, inregs, outregs);  // 2321d..23228
      result = 1;                             // 2322d
      break;                                  // 23234
    default:                                  // 23236 -> 2327d
      result = 1;                             // 2327d
      break;
  }
  stackFree(0x38);                  // 23284..2328c: eax = [ebp-0x10]; epilogue, ret
  return result;
});
