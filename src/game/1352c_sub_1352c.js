// 0x1352c  void sub_1352c(void)   [Watcom, no args, no return value]
// Advances the ring index at 0x60b8c (inc; wraps to 0 when it becomes > 12, i.e. cycles 0..12) and
// writes these fields of sprite slot [0x60b8c] of the 13-entry sprite array at 0x34704 (stride 0x18c; main 0x1aa02 Sprite_Inits
// all 13 with frames from "exp2.pcx" (0x30237)): x = [0x60b90], y = [0x60b94] + 6, state = 0x26,
// curr_frame = 0 (field names: sprite struct, LIBRARY.md).
// Return value: none. EAX at RET is only the leftover of the last `imul eax,[0x60b8c],0x18c`; all 25 call
// sites were checked (0x1262c .. 0x1a7de): each one overwrites EAX (xor/mov/imul, or a cdecl call) before
// any read, and signatures.json has returns=false.
import { register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';
import { SPRITE, explosionNext, explosionX, explosionY, explosions } from './data.js';

register(0x1352c, 'sub_1352c', function sub_1352c() {
  // 0x13544 inc dword [0x60b8c]; cmp ...,0xc; jle (signed)
  W32(explosionNext, (R32(explosionNext) + 1) | 0);
  if (R32(explosionNext) > 0xc) {
    W32(explosionNext, 0);
  }
  // 0x1355d: sprite[i].x (+0x000, LIBRARY.md) = [0x60b90]
  W32(explosions + Math.imul(R32(explosionNext), SPRITE.SIZE), R32(explosionX));
  // 0x13573: sprite[i].y (+0x004, LIBRARY.md) = [0x60b94] + 6
  W32((explosions + SPRITE.y) + Math.imul(R32(explosionNext), SPRITE.SIZE), (R32(explosionY) + 6) | 0);
  // 0x1358c: sprite[i].state (+0x170, LIBRARY.md) = 0x26
  W32((explosions + SPRITE.state) + Math.imul(R32(explosionNext), SPRITE.SIZE), 0x26);
  // 0x135a0: sprite[i].curr_frame (+0x168, LIBRARY.md) = 0
  W32((explosions + SPRITE.currFrame) + Math.imul(R32(explosionNext), SPRITE.SIZE), 0);
});
