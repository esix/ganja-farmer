// 0x212c0  void Draw_Sprite_Clip(sprite *s /*EAX*/, uchar *buf /*EDX*/, int transparent /*EBX*/)   [Watcom, no return value]
// Draws s->frames[s->curr_frame] into buf (row stride 320), clipping left OR right edge and top OR bottom edge.
// ORIGINAL BUG: the left/right clips are exclusive (x<0 skips the right-edge test) and so are top/bottom, so a
// sprite overhanging both the left and right edge (or top and bottom) writes past column 319 into the next row /
// below the bottom clip (audit of 0x21370..0x213e8; difftest case "x<0 and x+w>320 t=1" shows the overrun on both sides).
// If the sprite is off-screen or s->visible == 0: sets visible = 0 and draws nothing.
// transparent != 0: copies only non-zero source bytes; transparent == 0: memcpy per row.
// Then stores the clipped x, y, width, height into s+0x178..0x184 and sets visible (s+0x188) = 1.
// 0x310a0: double_buffer_height (see re/LIBRARY.md), used as the bottom clip.
import { F, register } from '../runtime/registry.js';
import { R8, R32, W8, W32 } from '../runtime/mem.js';

register(0x212c0, 'Draw_Sprite_Clip_212c0', function Draw_Sprite_Clip_212c0(s, buf, transparent) {
  let sx;     // [ebp-0x14]: source x offset
  let sy;     // [ebp-0x10]: source y offset
  let cw;     // [ebp-0xc]: clipped width
  let ch;     // [ebp-8]: clipped height
  let w;      // [ebp-0x18]
  let x;      // [ebp-0x20]
  let y;      // [ebp-0x1c]
  let dst;    // [ebp-0x2c]
  let src;    // [ebp-0x30]
  let row;    // [ebp-0x24]
  let col;    // [ebp-0x28]
  let pixel;  // [ebp-4] (byte)

  sx = 0;
  sy = 0;
  cw = 0;
  ch = 0;
  w = R32(s + 8);
  cw = w;
  ch = R32(s + 0xc);
  x = R32(s);
  y = R32(s + 4);
  // all comparisons signed (jge / jl / jg)
  if (!(x < 0x140 && y < R32(0x310a0) && ((x + w) | 0) > 0 && ((y + ch) | 0) > 0 && R32(s + 0x188) !== 0)) {
    W32(s + 0x188, 0);
    return;
  }
  if (x < 0) {
    sx = x;
    sx = (-sx) | 0;
    x = 0;
    cw = (cw - sx) | 0;
  } else if (((x + w) | 0) >= 0x140) {
    sx = 0;
    cw = (0x140 - x) | 0;
  }
  if (y < 0) {
    sy = y;
    sy = (-sy) | 0;
    y = 0;
    ch = (ch - sy) | 0;
  } else if (((y + ch) | 0) >= R32(0x310a0)) {
    sy = 0;
    ch = (R32(0x310a0) - y) | 0;
  }
  // LATENT (audit round1 F-risky F10): `| 0` address arithmetic breaks only for addresses >= 2^31 (R8/W8 of
  // a negative number), which x86 would fault on too; not reachable with the game's buffers.
  dst = ((((y << 8) + buf) | 0) + (y << 6) + x) | 0;
  src = (R32(((R32(s + 0x168) << 2) + s + 0x28) | 0) + Math.imul(sy, w) + sx) | 0;
  if (transparent !== 0) {
    for (row = 0; row < ch; row++) {
      for (col = 0; col < cw; col++) {
        pixel = R8((src + col) | 0);
        if (pixel !== 0) { // byte compare with 0: colour index 0 is transparent
          W8((dst + col) | 0, pixel);
        }
      }
      dst = (dst + 0x140) | 0;
      src = (src + w) | 0;
    }
  } else {
    for (row = 0; row < ch; row++) {
      F.memcpy_240eb(dst, src, cw);
      dst = (dst + 0x140) | 0;
      src = (src + w) | 0;
    }
  }
  W32(s + 0x178, x);
  W32(s + 0x17c, y);
  W32(s + 0x180, cw);
  W32(s + 0x184, ch);
  W32(s + 0x188, 1);
});
