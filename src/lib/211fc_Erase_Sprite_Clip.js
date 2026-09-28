// 0x211fc  void Erase_Sprite_Clip(sprite *s /*EAX*/, uchar *buf /*EDX*/)   [Watcom, 2 register args, no return value]
// If s->[0x188] (visible) != 0: for row = 0 .. s->[0x184]-1 (signed compare), calls
// memcpy(buf + (s->[0x17c]<<8) + (s->[0x17c]<<6) + s->[0x178] + row*320, s->[0x174] + row*s->[8], s->[0x180]).
// Sprite fields used (offsets per re/LIBRARY.md sprite notes): 0x008 width (source stride),
// 0x174 background, 0x178 x_clip, 0x17c y_clip, 0x180 width_clip, 0x184 height_clip, 0x188 visible.
// No clipping checks are done here; it uses the clip fields already stored in the struct.
// The copy is a real CALL to memcpy (0x240eb), not an inlined rep movs.
import { F, register } from '../runtime/registry.js';
import { R32 } from '../runtime/mem.js';

register(0x211fc, 'Erase_Sprite_Clip_211fc', function Erase_Sprite_Clip_211fc(s, buf) {
  let src;    // [ebp-0x14]
  let cw;     // [ebp-4]
  let ch;     // [ebp-8]
  let stride; // [ebp-0xc]
  let row;    // [ebp-0x10]
  let dst;    // [ebp-0x18] (reuses the buf argument slot)

  dst = buf;
  if (R32(s + 0x188) === 0) return;          // cmp [eax+0x188],0 / jne / jmp exit
  src = R32(s + 0x174);
  cw = R32(s + 0x180);
  ch = R32(s + 0x184);
  stride = R32(s + 8);
  // edx = buf + (y_clip << 8); edx += y_clip << 6; eax = x_clip + edx   (all 32-bit wrapping)
  dst = (R32(s + 0x178) + (((dst + (R32(s + 0x17c) << 8)) | 0) + (R32(s + 0x17c) << 6) | 0)) | 0;
  for (row = 0; row < ch; row++) {           // cmp eax,[ebp-8] / jge: signed
    F.memcpy_240eb(dst, src, cw);            // EAX=dst, EDX=src, EBX=cw
    dst = (dst + 0x140) | 0;
    src = (src + stride) | 0;
  }
});
