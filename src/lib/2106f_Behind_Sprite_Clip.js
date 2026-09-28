// 0x2106f  void Behind_Sprite_Clip(sprite *s /*EAX*/, uchar *buf /*EDX*/)   [Watcom, 2 register args, no return value]
// If the sprite rectangle (s+0 x, s+4 y, s+8 w, s+0xc h) intersects 320 x [0x310a0] (double_buffer_height),
// copies the clipped area of buf (stride 320) row by row into s->background (+0x174, stride w) via memcpy,
// stores the clip rectangle into +0x178/+0x17c/+0x180/+0x184 and sets visible (+0x188) = 1;
// otherwise sets visible = 0.
// Return value: none. EAX at RET is s only as a leftover: `mov eax,[ebp-0x30]` at 0x210ef / 0x211e7 loads the
// base register for the visible store; no caller reads EAX (signatures.json returns=false over 55 binary call
// sites; no JS caller uses it), so per the PORTING.md return-value rule nothing is returned.
// ORIGINAL BUG: the left/right clips are exclusive (0x21101 `jge 0x21116`: x<0 skips the right-edge test at
// 0x21116..0x2112b) and so are top/bottom (0x2112e `jge 0x21143`: y<0 skips the bottom test at 0x21143..0x21159),
// the same as Draw_Sprite_Clip (212c0). For x<0 and x+w>320 the width cw = w+x exceeds 320-0, so each memcpy
// reads past column 319 into the next row of buf; for y<0 and y+h>[0x310a0] it reads rows below the bottom
// clip. The writes into s->background stay inside w*h (cw <= w, ch <= h), but the oversized clip rectangle
// is stored into +0x180/+0x184.
// All comparisons are signed (jge/jl/jg). No inlined rep movs: each row is a call to memcpy (0x240eb).
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';

register(0x2106f, 'Behind_Sprite_Clip_2106f', function Behind_Sprite_Clip_2106f(s, buf) {
  let w; // [ebp-0x10]
  let cw; // [ebp-0xc]
  let ch; // [ebp-8]
  let x; // [ebp-0x18]
  let y; // [ebp-0x14]
  let src; // [ebp-0x24]
  let dst; // [ebp-0x28]
  let i; // [ebp-0x1c]

  cw = 0;
  ch = 0;
  w = R32(s + 8);
  cw = w;
  ch = R32(s + 0xc);
  x = R32(s);
  y = R32(s + 4);
  if (!(x < 0x140 && y < R32(0x310a0) && ((x + w) | 0) > 0 && ((y + ch) | 0) > 0)) {
    W32(s + 0x188, 0);
    return; // 0x210fc jmp 0x211f4 (epilogue)
  }
  if (x < 0) {
    cw = (cw + x) | 0;
    x = 0;
  } else if (((x + w) | 0) >= 0x140) {
    cw = (0x140 - x) | 0;
  }
  if (y < 0) {
    ch = (ch + y) | 0;
    y = 0;
  } else if (((y + ch) | 0) >= R32(0x310a0)) {
    ch = (R32(0x310a0) - y) | 0;
  }
  src = ((((buf + (y << 8)) | 0) + (y << 6) | 0) + x) | 0;
  dst = R32(s + 0x174);
  for (i = 0; i < ch; i++) {
    F.memcpy_240eb(dst, src, cw);
    src = (src + 0x140) | 0;
    dst = (dst + w) | 0;
  }
  W32(s + 0x178, x);
  W32(s + 0x17c, y);
  W32(s + 0x180, cw);
  W32(s + 0x184, ch);
  W32(s + 0x188, 1);
});
