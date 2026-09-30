// 0x135bb  void updateExplosions(void)   [Watcom, no args, no return value]
// For each i in 0..12: increments the int counter [0x60b58 + 4*i]; if it is > 0x32 (signed), sets
// sprite[i].state = 1 in the 13-entry sprite array at 0x34704 (stride 0x18c; built at 0x1b90b/0x1b94c from
// the picture loaded from "exp2.pcx" at 0x1b8c5; 0x1352c also writes these sprites' state = 0x26).
// For every sprite with state == 1, increments curr_frame; when curr_frame > 0xb
// (signed) it resets curr_frame = 1, y = -50, x = -50, state = 0 (field names: sprite struct, LIBRARY.md).
// Return value: none. EAX at RET is the leftover 12 from `mov eax,[ebp-4]` at 0x135dc (the only loop exit);
// the only caller 0x1d64e is followed by `call 0x14690` (no register args, signatures.json regs=0), so EAX
// is never read.
import { register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';
import { EXPLOSION } from './states.js';
import { explosionDelays, explosions } from './data.js';
import { sprite } from './access.js';

register(0x135bb, 'updateExplosions_135bb', function updateExplosions() {
  let i; // [ebp-4]

  // 0x135d3 .. 0x135e6: for (i = 0; i < 13; i++)   (jge: signed)
  for (i = 0; i < 0xd; i++) {
    // 0x135f2: inc dword [0x60b58 + 4*i]   (0x60b58: 13-entry int array, meaning unknown)
    W32(explosionDelays + i * 4, (R32(explosionDelays + i * 4) + 1) | 0);
    // 0x135fe: cmp ..., 0x32; jle (signed)
    if (R32(explosionDelays + i * 4) > 0x32) {
      // 0x1360e: sprite[i].state (+0x170, LIBRARY.md) = 1
      sprite(explosions, i).state = EXPLOSION.ANIMATING;
    }
    // 0x1361f: cmp sprite[i].state, 1; jne
    if (sprite(explosions, i).state === EXPLOSION.ANIMATING) {
      // 0x1362f: inc sprite[i].curr_frame (+0x168, LIBRARY.md)
      sprite(explosions, i).currFrame = (sprite(explosions, i).currFrame + 1) | 0;
      // 0x1363c: `cmp curr_frame, 3` — its flags are overwritten by the next cmp without being read
      // (no conditional jump in between); it has no effect on state, so nothing is emitted for it.
      // 0x1364a: cmp curr_frame, 0xb; jle (signed)
      if (sprite(explosions, i).currFrame > 0xb) {
        // 0x1365a: curr_frame = 1
        sprite(explosions, i).currFrame = 1;
        // 0x1366b: sprite[i].y (+0x004, LIBRARY.md) = -50
        sprite(explosions, i).y = -50;
        // 0x1367c: sprite[i].x (+0x000, LIBRARY.md) = -50
        sprite(explosions, i).x = -50;
        // 0x1368d: sprite[i].state = 0
        sprite(explosions, i).state = EXPLOSION.IDLE;
      }
    }
  }
});
