// 0x14c6a  void updateBombs(void)   [Watcom, no args, no return value]
// Per-frame update of the 4-entry sprite array at 0x3d23c (stride 0x18c; main Sprite_Inits it in a 4-iteration
// loop with x = -100 and frames from "bomb.pcx" 0x30225, decompiled.c "Sprite_Init(&DAT_0003d23c + iStack_18 * 0x18c,
// 0xffffff9c,0,0x10,9,...)"), tested against the 26-entry sprite array at 0x3a878 (stride 0x18c; see
// 14425_sub_14425.js header for evidence). Field names from the sprite struct (LIBRARY.md):
// +0x000 x, +0x004 y, +0x008 width, +0x010 counter_1, +0x014 counter_2, +0x168 curr_frame, +0x170 state.
// For each i in 0..3:
//   state == 0: y = -100.
//   state == 1: curr_frame cycles 0..2 while counter_1 < 0, 3..5 while counter_1 > 0; counter_2 += 1 (max 8);
//     counter_1 < -1: x += counter_1, counter_1++; counter_1 > 1: x += counter_1, counter_1--; y += counter_2;
//     if y >= 0xa0: state = 0, [0x60b90] = x - 0xc, [0x60b94] = y - 0x16, dword [0x60b58 + 4*[0x60b8c]] = 0x33,
//       spawnExplosion(), dws_DDiscard(word [0x6128a]), dws_DPlay(0x61280) (dws_DPLAY at 0x61280, +0xA soundnum,
//       LIBRARY.md "STK structures");
//     then for j in 0..25: if this sprite's state is (now) 0, its x-range [x-2, x+width+2] (strict compares)
//       contains sprite j's x or x+width, sprite j's state == 1 and this y > 0: sprite j state = 0x29,
//       counter_1 = 0xb4, curr_frame = 2.
// Return value: none. EAX at RET (0x14fb9) is the leftover of `mov eax,[ebp-8]` (0x14c8b) or of the last imul;
// the only call site (0x1d658) is followed by `call 0x14425` (no register args, signatures.json regs 0).
// No address-taken locals, no x87 instructions.
import { F, register } from '../runtime/registry.js';
import { R16, R32, W32 } from '../runtime/mem.js';
import { SPRITE, bombs, explosionDelays, plants, sndExplosion } from './data.js';
import { G, dplay, sprite } from './access.js';

const S = (k) => Math.imul(k, SPRITE.SIZE);

register(0x14c6a, 'updateBombs_14c6a', function updateBombs() {
  let i; // [ebp-8]
  let j; // [ebp-4]
  let t; // ECX at 0x14d83 / 0x14db3

  for (i = 0; i < 4; i++) {                                              // 0x14c82..0x14c95 (jge, signed)
    if (sprite(bombs, i).state === 0) {                                     // 0x14ca2: state
      sprite(bombs, i).y = -100;                                         // 0x14cb2: y = 0xffffff9c
    }
    if (sprite(bombs, i).state !== 1) continue;                             // 0x14cc3 jne 0x14fac
    if (sprite(bombs, i).counter1 < 0) {                                       // 0x14cd7 jge
      sprite(bombs, i).currFrame = (sprite(bombs, i).currFrame + 1) | 0;                // 0x14ce7 inc curr_frame
      if (sprite(bombs, i).currFrame > 2) {                                     // 0x14ced jle
        sprite(bombs, i).currFrame = 0;                                          // 0x14cfd
      }
    }
    if (sprite(bombs, i).counter1 > 0) {                                       // 0x14d0e jle
      sprite(bombs, i).currFrame = (sprite(bombs, i).currFrame + 1) | 0;                // 0x14d1e
      if (sprite(bombs, i).currFrame > 5) {                                     // 0x14d24 jle
        sprite(bombs, i).currFrame = 3;                                          // 0x14d34
      }
    }
    sprite(bombs, i).counter2 = (sprite(bombs, i).counter2 + 1) | 0;                  // 0x14d45 inc counter_2
    if (sprite(bombs, i).counter2 > 8) {                                       // 0x14d4b jle
      sprite(bombs, i).counter2 = 8;                                            // 0x14d5b
    }
    if (sprite(bombs, i).counter1 < -1) {                                      // 0x14d6c jge
      t = sprite(bombs, i).counter1;                                           // 0x14d83 (value before inc)
      sprite(bombs, i).counter1 = (sprite(bombs, i).counter1 + 1) | 0;                // 0x14d89
      sprite(bombs, i).x = (sprite(bombs, i).x + t) | 0;                // 0x14d8f add x
    }
    if (sprite(bombs, i).counter1 > 1) {                                       // 0x14d9c jle
      t = sprite(bombs, i).counter1;                                           // 0x14db3
      sprite(bombs, i).counter1 = (sprite(bombs, i).counter1 - 1) | 0;                // 0x14db9
      sprite(bombs, i).x = (sprite(bombs, i).x + t) | 0;                // 0x14dbf
    }
    sprite(bombs, i).y = (sprite(bombs, i).y + sprite(bombs, i).counter2) | 0; // 0x14dd3..0x14dd9 y += counter_2
    if (sprite(bombs, i).y >= 0xa0) {                                   // 0x14de6 jl
      sprite(bombs, i).state = 0;                                            // 0x14df9 state = 0
      G.explosionX = (sprite(bombs, i).x - 0xc) | 0;                     // 0x14e0a..0x14e13
      G.explosionY = (sprite(bombs, i).y - 0x16) | 0;                    // 0x14e1f..0x14e28
      W32((G.explosionNext << 2) + explosionDelays, 0x33);                          // 0x14e2d..0x14e35
      F.spawnExplosion_1352c();                                               // 0x14e3f
      F.dws_DDiscard_1f770(dplay(sndExplosion).soundnum);                          // 0x14e44..0x14e52 cdecl, zero-extended word
      F.dws_DPlay_1eff8(sndExplosion);                                  // 0x14e55..0x14e60 cdecl
    }
    for (j = 0; j < 0x1a; j++) {                                         // 0x14e63..0x14e76 (jge, signed)
      if (sprite(bombs, i).state !== 0) continue;                           // 0x14e83 jne 0x14f4e -> next j
      // 0x14e90..0x14f48: hit if (x_i-2 < x_j && x_i+w_i+2 > x_j) || (x_i-2 < x_j+w_j && x_i+w_i+2 > x_j+w_j)
      let hit = false;
      if (((sprite(bombs, i).x - 2) | 0) < sprite(plants, j).x &&                        // 0x14ea7 jge 0x14edd
          ((((sprite(bombs, i).x + sprite(bombs, i).width) | 0) + 2) | 0) > sprite(plants, j).x) { // 0x14ed5 jg 0x14f4c
        hit = true;
      } else if (((sprite(bombs, i).x - 2) | 0) <                                        // 0x14f09 jge 0x14f4a
                 ((sprite(plants, j).x + sprite(plants, j).width) | 0) &&
                 ((((sprite(bombs, i).x + sprite(bombs, i).width) | 0) + 2) | 0) >           // 0x14f46 jg 0x14f4c
                 ((sprite(plants, j).x + sprite(plants, j).width) | 0)) {
        hit = true;
      }
      if (!hit) continue;                                                // 0x14f4a -> 0x14f4e -> 0x14f60 -> 0x14f72
      if (sprite(plants, j).state !== 1) continue;                           // 0x14f57 je 0x14f62
      if (!(sprite(bombs, i).y > 0)) continue;                          // 0x14f69 jg 0x14f74
      sprite(plants, j).state = 0x29;                                         // 0x14f7b state
      sprite(plants, j).counter1 = 0xb4;                                         // 0x14f8c counter_1
      sprite(plants, j).currFrame = 2;                                            // 0x14f9d curr_frame
    }
  }
});
