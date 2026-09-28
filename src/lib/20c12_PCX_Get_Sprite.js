// 0x20c12  void PCX_Get_Sprite(pcx_picture *img, sprite *spr, int frame, int cell_x, int cell_y)
//          [Watcom: EAX=img, EDX=spr, EBX=frame, ECX=cell_x, cell_y on the stack (ret 4); no return value]
// spr->frames[frame] (spr+0x28+frame*4) = malloc(w*h+1) with w = spr+8, h = spr+0xc; then copies h rows of
// w bytes from img->buffer (img+0x394) + ((h+1)*cell_y+1)*320 + (w+1)*cell_x+1 (source stride 320, dest
// stride w) via memcpy; finally increments spr->num_frames (spr+0x16c).
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';

register(0x20c12, 'PCX_Get_Sprite_20c12', function PCX_Get_Sprite_20c12(img, spr, frame, cell_x, cell_y) {
  let w; // [ebp-0xc]
  let h; // [ebp-8]
  let dst; // [ebp-4]
  let x_off; // [ebp-0x18]
  let y_off; // [ebp-0x14]
  let i; // [ebp-0x10]

  w = R32(spr + 8);
  h = R32(spr + 0xc);
  W32((((frame << 2) + spr) | 0) + 0x28, F.malloc_23dab((Math.imul(w, h) + 1) | 0));
  dst = R32((((frame << 2) + spr) | 0) + 0x28);
  x_off = (Math.imul((w + 1) | 0, cell_x) + 1) | 0;
  y_off = (Math.imul((h + 1) | 0, cell_y) + 1) | 0;
  y_off = Math.imul(y_off, 0x140);
  for (i = 0; i < h; i++, y_off = (y_off + 0x140) | 0) {
    F.memcpy_240eb((Math.imul(i, w) + dst) | 0, (((y_off + x_off) | 0) + R32(img + 0x394)) | 0, w);
  }
  W32(spr + 0x16c, R32(spr + 0x16c) + 1);
});
