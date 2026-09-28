// 0x20768  int Fill_Screen(int color)
//          [Watcom: color=EAX; no stack args]
// Calls memset(video_buffer [0x31090], color & 0xff, 0xfa00) — one byte-fill call of 64000 bytes, no inline
// rep stos, no port I/O.
// Return: EAX is not reloaded after the memset call, so the function returns memset's result. The two callers
// that could propagate it (0x114e3, 0x1164b: call is the last instruction before the epilogue) are in void
// functions per decompiled.c; the other 10 callers ignore EAX. The port returns it anyway (faithful EAX).
import { F, register } from '../runtime/registry.js';
import { R32 } from '../runtime/mem.js';

register(0x20768, 'Fill_Screen_20768', function Fill_Screen(color) {
  // 20780: [ebp-4] = color
  // 20783: ebx = 0xfa00
  // 20788/2078a: edx = 0; dl = byte [ebp-4]  -> edx = color & 0xff
  // 2078d: eax = [0x31090]; 20792: call memset
  return F.memset_23d81(R32(0x31090) /* video_buffer */, color & 0xff, 0xfa00);
});
