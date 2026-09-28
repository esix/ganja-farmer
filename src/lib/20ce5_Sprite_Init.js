// 0x20ce5  void Sprite_Init(s, x, y, w, h, c1, c2, c3, t1, t2, t3)
//   [Watcom: s=EAX, x=EDX, y=EBX, w=ECX; h, c1, c2, c3, t1, t2, t3 on the stack (7 dwords, ret 0x1c); no return value]
// Fills the 0x18c-byte sprite struct at s: +0 x, +4 y, +8 w, +0xc h, +0x188 = 1, +0x10..+0x18 = c1..c3,
// +0x1c..+0x24 = t1..t3, +0x168 = 0, +0x170 = 0, +0x16c = 0, +0x174 = malloc(w*h+1), then +0x28 + i*4 = 0 for i=0..79.
import { F, register } from '../runtime/registry.js';
import { W32 } from '../runtime/mem.js';

register(0x20ce5, 'Sprite_Init_20ce5', function Sprite_Init_20ce5(s, x, y, w, h, c1, c2, c3, t1, t2, t3) {
  let i; // [ebp-4]

  W32(s, x);
  W32(s + 4, y);
  W32(s + 8, w);
  W32(s + 0xc, h);
  W32(s + 0x188, 1); // visible
  W32(s + 0x10, c1);
  W32(s + 0x14, c2);
  W32(s + 0x18, c3);
  W32(s + 0x1c, t1);
  W32(s + 0x20, t2);
  W32(s + 0x24, t3);
  W32(s + 0x168, 0); // curr_frame
  W32(s + 0x170, 0); // state
  W32(s + 0x16c, 0); // num_frames
  W32(s + 0x174, F.malloc_23dab((Math.imul(w, h) + 1) | 0)); // background
  for (i = 0; i < 0x50; i++) {
    W32(s + 0x28 + i * 4, 0); // frames[i]
  }
});
