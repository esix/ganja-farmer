// 0x20c12  void PCX_Get_Sprite(pcx_picture *img, sprite *spr, int frame, int cell_x, int cell_y)
//          [Watcom: EAX=img, EDX=spr, EBX=frame, ECX=cell_x, cell_y on the stack (ret 4); no return value]
// spr->frames[frame] (spr+0x28+frame*4) = malloc(w*h+1) with w = spr+8, h = spr+0xc; then copies h rows of
// w bytes from img->buffer (img+0x394) + ((h+1)*cell_y+1)*320 + (w+1)*cell_x+1 (source stride 320, dest
// stride w) via memcpy; finally increments spr->num_frames (spr+0x16c).
// Stage 2: the rows come from the bound picture (images.pictureOf) instead of img->buffer. A cell reaching
// outside the 64001 bytes would have read other heap memory in the original; it throws here (the game's
// sprite sheets never do).
import { F, register } from '../runtime/registry.js';
import { u8, R32, W32 } from '../runtime/mem.js';
import { pictureOf } from '../platform/images.js';

register(0x20c12, 'PCX_Get_Sprite_20c12', function PCX_Get_Sprite_20c12(img, spr, frame, cell_x, cell_y) {
  const px = pictureOf(img);
  const w = R32(spr + 8), h = R32(spr + 0xc);
  const dst = F.malloc_23dab((Math.imul(w, h) + 1) | 0);
  W32(spr + 0x28 + frame * 4, dst);                              // frames[frame]
  const x0 = (Math.imul((w + 1) | 0, cell_x) + 1) | 0;
  let src = Math.imul((Math.imul((h + 1) | 0, cell_y) + 1) | 0, 0x140) + x0;
  for (let i = 0; i < h; i++, src += 0x140) {
    if (src < 0 || src + w > px.length) throw new Error(`PCX_Get_Sprite: cell (${cell_x}, ${cell_y}) of ${w}x${h} lies outside the picture`);
    u8.set(px.subarray(src, src + w), dst + i * w);
  }
  W32(spr + 0x16c, R32(spr + 0x16c) + 1);                        // num_frames++
});
