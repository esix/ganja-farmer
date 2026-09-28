// 0x20618  void Read_Palette(int start, int end, RGB_palette *p)
//          [Watcom: EAX=start, EDX=end, EBX=p; no return value]
// For i = start..end (signed compare): Read_Color_Reg(i, &color) into a stack local, then copies its 3 bytes
// to p+8+i*3 (+0,+1,+2). Afterwards stores p->start_reg = start (p+0), p->end_reg = end (p+4) (LIBRARY.md).
import { F, register } from '../runtime/registry.js';
import { R8, W8, W32 } from '../runtime/mem.js';
import { stackAlloc, stackFree } from '../runtime/stack.js';

register(0x20618, 'Read_Palette_20618', function Read_Palette(start, end, p) {
  const color = stackAlloc(4);  // [ebp-4]: RGB_color, address passed to Read_Color_Reg (uninitialized)
  let i;                        // [ebp-8]
  // 2063a..2064b: for (i = start; i <= end; i++)  -- jg: signed
  for (i = start; i <= end; i = (i + 1) | 0) {
    F.Read_Color_Reg_205a8(i, color);                           // 2064d..20653: EAX=i, EDX=&color
    W8(((Math.imul(i, 3) + p | 0) + 8) >>> 0, R8(color));       // 20658..20664
    W8(((Math.imul(i, 3) + p | 0) + 9) >>> 0, R8(color + 1));   // 20667..20673
    W8(((Math.imul(i, 3) + p | 0) + 10) >>> 0, R8(color + 2));  // 20676..20682
  }
  W32(p >>> 0, start);          // 20687..2068d: [p] = start
  W32((p + 4) >>> 0, end);      // 2068f..20695: [p+4] = end
  stackFree(4);
});
