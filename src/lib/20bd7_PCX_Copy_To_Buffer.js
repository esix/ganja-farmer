// 0x20bd7  void PCX_Copy_To_Buffer(pcx_picture *img, uchar *dest)
//          [Watcom: EAX=img, EDX=dest; no return value]
// Copies 64000 (0xFA00) bytes from img->buffer (img+0x394) to dest via memcpy (0x240eb).
import { F, register } from '../runtime/registry.js';
import { R32 } from '../runtime/mem.js';

register(0x20bd7, 'PCX_Copy_To_Buffer_20bd7', function PCX_Copy_To_Buffer_20bd7(img, dest) {
  F.memcpy_240eb(dest, R32(img + 0x394), 0xfa00); // EAX=dest, EDX=[img+0x394], EBX=0xfa00
});
