// 0x20bd7  void PCX_Copy_To_Buffer(pcx_picture *img, uchar *dest)
//          [Watcom: EAX=img, EDX=dest; no return value]
// Copies 64000 (0xFA00) bytes from img->buffer (img+0x394) to dest via memcpy (0x240eb).
// Stage 2: copies the bound picture (images.pictureOf) instead of img->buffer.
import { register } from '../runtime/registry.js';
import { u8 } from '../runtime/mem.js';
import { pictureOf } from '../platform/images.js';

register(0x20bd7, 'PCX_Copy_To_Buffer_20bd7', function PCX_Copy_To_Buffer_20bd7(img, dest) {
  u8.set(pictureOf(img).subarray(0, 0xfa00), dest);
});
