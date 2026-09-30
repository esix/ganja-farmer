// 0x1352c  void spawnExplosion(void)   [Watcom, no args, no return value]
// Advances the ring index at 0x60b8c (inc; wraps to 0 when it becomes > 12, i.e. cycles 0..12) and
// writes these fields of sprite slot [0x60b8c] of the 13-entry sprite array at 0x34704 (stride 0x18c; main 0x1aa02 Sprite_Inits
// all 13 with frames from "exp2.pcx" (0x30237)): x = [0x60b90], y = [0x60b94] + 6, state = 0x26,
// curr_frame = 0 (field names: sprite struct, LIBRARY.md).
// Return value: none. EAX at RET is only the leftover of the last `imul eax,[0x60b8c],0x18c`; all 25 call
// sites were checked (0x1262c .. 0x1a7de): each one overwrites EAX (xor/mov/imul, or a cdecl call) before
// any read, and signatures.json has returns=false.
import { register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';
import { EXPLOSION } from './states.js';
import { explosions } from './data.js';
import { G, sprite } from './access.js';

register(0x1352c, 'spawnExplosion_1352c', function spawnExplosion() {
  // 0x13544 inc dword [0x60b8c]; cmp ...,0xc; jle (signed)
  G.explosionNext = (G.explosionNext + 1) | 0;
  if (G.explosionNext > 0xc) {
    G.explosionNext = 0;
  }
  // 0x1355d: sprite[i].x (+0x000, LIBRARY.md) = [0x60b90]
  sprite(explosions, G.explosionNext).x = G.explosionX;
  // 0x13573: sprite[i].y (+0x004, LIBRARY.md) = [0x60b94] + 6
  sprite(explosions, G.explosionNext).y = (G.explosionY + 6) | 0;
  // 0x1358c: sprite[i].state (+0x170, LIBRARY.md) = 0x26
  sprite(explosions, G.explosionNext).state = EXPLOSION.PENDING;
  // 0x135a0: sprite[i].curr_frame (+0x168, LIBRARY.md) = 0
  sprite(explosions, G.explosionNext).currFrame = 0;
});
