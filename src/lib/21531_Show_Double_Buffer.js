// 0x21531  void Show_Double_Buffer(uchar *buf, int unused)
//          [Watcom: buf=EAX, unused=EDX; no stack args; no return value]
// Calls memcpy(video_buffer [0x31090], buf, double_buffer_size [0x310a4] * 2). No vsync wait, no port I/O.
// Return: EAX after the memcpy call is left unchanged, but none of the 8 callers (0x10a49, 0x10b12, 0x11202,
// 0x1149c, 0x11b19, 0x16408, 0x16be2, 0x1dfb8) reads it, so the port returns nothing.
import { F, register } from '../runtime/registry.js';
import { R32 } from '../runtime/mem.js';

register(0x21531, 'Show_Double_Buffer_21531', function Show_Double_Buffer(buf, unused) {
  // 21548/2154b: both args are stored to [ebp-8]/[ebp-4]; [ebp-4] (unused) is never read again.
  // 2154e..2155e: ebx = [0x310a4] + [0x310a4]; edx = buf; eax = [0x31090]; call memcpy
  F.memcpy_240eb(R32(0x31090) /* video_buffer */, buf, (R32(0x310a4) + R32(0x310a4)) | 0);
});
