// 0x2044b  void H_Line(int x1, int x2, int y, int color)
//          [Watcom: x1=EAX, x2=EDX, y=EBX, color=ECX (low byte used); no stack args; plain ret]
// Draws a horizontal line into video_buffer [0x31090] (= 0xA0000, LIBRARY.md): swaps x1/x2 if x1 > x2 (signed),
// then calls memset([0x31090] + y*320 + x1, color & 0xff, x2 - x1 + 1). No clipping, no inline rep stos.
// signatures.json returns=false; EAX at the RET is memset's leftover result (not reloaded), not returned
// deliberately (decompiled.c: void).
import { F, register } from '../runtime/registry.js';
import { R32 } from '../runtime/mem.js';

register(0x2044b, 'H_Line_2044b', function H_Line(x1, x2, y, color) {
  // 20460..20469: [ebp-0x14]=x1, [ebp-0x10]=x2, [ebp-0xc]=y, [ebp-8]=color
  // 2046c..20472: if (x1 > x2) swap (jle skips when x1 <= x2, signed)
  if (x1 > x2) {
    const t = x1;   // 20474/20477: [ebp-4] = x1
    x1 = x2;        // 2047a/2047d
    x2 = t;         // 20480/20483
  }
  // 20486..2048c: ebx = x2 - x1 + 1
  // 2048f/20491: edx = 0; dl = byte [ebp-8]  -> color & 0xff
  // 20494..204a9: eax = [0x31090] + ((y << 8) + (y << 6)) + x1
  // 204ac: call memset
  F.memset_23d81((R32(0x31090) + (((y << 8) + (y << 6)) | 0) + x1) | 0, color & 0xff, (((x2 - x1) | 0) + 1) | 0);
});
