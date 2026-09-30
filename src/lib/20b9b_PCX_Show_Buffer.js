// 0x20b9b  void PCX_Show_Buffer(pcx_picture *img)
//          [Watcom: EAX=img; no return value]
// Copies 64000 (0xFA00) bytes from img->buffer (img+0x394) to video_buffer ([0x31090], LIBRARY.md) via memcpy (0x240eb).
// Stage 2: copies the bound picture (images.pictureOf) instead of img->buffer.
import { register } from '../runtime/registry.js';
import { u8, R32 } from '../runtime/mem.js';
import { pictureOf } from '../platform/images.js';

register(0x20b9b, 'PCX_Show_Buffer_20b9b', function PCX_Show_Buffer_20b9b(img) {
  u8.set(pictureOf(img).subarray(0, 0xfa00), R32(0x31090) /* video_buffer */);
});
