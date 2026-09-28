// 0x20b9b  void PCX_Show_Buffer(pcx_picture *img)
//          [Watcom: EAX=img; no return value]
// Copies 64000 (0xFA00) bytes from img->buffer (img+0x394) to video_buffer ([0x31090], LIBRARY.md) via memcpy (0x240eb).
import { F, register } from '../runtime/registry.js';
import { R32 } from '../runtime/mem.js';

register(0x20b9b, 'PCX_Show_Buffer_20b9b', function PCX_Show_Buffer_20b9b(img) {
  // 20bb6..20bc9: ebx = 0xfa00; edx = [img+0x394]; eax = [0x31090]; call memcpy
  F.memcpy_240eb(R32(0x31090) /* video_buffer */, R32(img + 0x394), 0xfa00);
});
