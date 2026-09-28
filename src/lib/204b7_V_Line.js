// 0x204b7  void V_Line(int y1, int y2, int x, int color)
//          [Watcom: y1=EAX, y2=EDX, x=EBX, color=ECX (low byte stored); no stack args; plain ret; no return value]
// Draws a vertical line into video_buffer [0x31090] (= 0xA0000, LIBRARY.md): swaps y1/y2 if y1 > y2 (signed),
// then stores the low byte of color at [0x31090] + y1*320 + x and every 320 bytes below it, y2-y1+1 times
// (signed loop compare). No clipping.
// signatures.json returns=false; EAX at the RET is a loop leftover (y2-y1 from the final compare), not returned.
import { register } from '../runtime/registry.js';
import { R32, W8 } from '../runtime/mem.js';

register(0x204b7, 'V_Line_204b7', function V_Line(y1, y2, x, color) {
  // 204cc..204d5: [ebp-0x1c]=y1, [ebp-0x18]=y2, [ebp-0x14]=x, [ebp-0x10]=color
  // 204d8..204de: if (y1 > y2) swap (jle skips when y1 <= y2, signed)
  if (y1 > y2) {
    const t = y1;   // 204e0/204e3: [ebp-4] = y1
    y1 = y2;        // 204e6/204e9
    y2 = t;         // 204ec/204ef
  }
  // 204f2..2050d: p = x + ((y1 << 8) + (y1 << 6) + [0x31090])
  let p = (x + ((((y1 << 8) + (y1 << 6)) | 0) + R32(0x31090) | 0)) | 0;
  // 20510..20528: for (i = 0; !((y2 - y1) < i); i++)  (jl: signed)
  for (let i = 0; !(((y2 - y1) | 0) < i); i = (i + 1) | 0) {
    W8(p >>> 0, color & 0xff);   // 2052a..20530: mov al, [ebp-0x10]; mov [edx], al
    p = (p + 0x140) | 0;         // 20532: add [ebp-0xc], 0x140
  }
});
