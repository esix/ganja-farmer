// 0x14690  void updateA10Jet(void)   [Watcom, no args, no return value]
// Per-frame update of the 1-entry sprite array at 0x3d0b0 (stride 0x18c) that can set up entries of the
// 4-entry sprite array at 0x3d23c (stride 0x18c) indexed by [0x60b9c].
// Evidence that 0x3d0b0 and 0x3d23c are sprites: 16c37_sub_16c37.js passes each base (+ i*0x18c) to
// Erase_Sprite_Clip (see 12130_sub_12130.js header). Field names from the sprite struct (LIBRARY.md):
// +0x000 x, +0x004 y, +0x010 counter_1, +0x014 counter_2, +0x018 counter_3, +0x01c threshold_1,
// +0x168 curr_frame, +0x170 state.
//   0x3d0b0 sprite i: x 0x3d0b0, y 0x3d0b4, counter_1 0x3d0c0, counter_2 0x3d0c4, counter_3 0x3d0c8,
//     threshold_1 0x3d0cc, curr_frame 0x3d218, state 0x3d220.
//   0x3d23c sprite k: x 0x3d23c, y 0x3d240, counter_1 0x3d24c, counter_2 0x3d250, curr_frame 0x3d3a4,
//     state 0x3d3ac.
//   0x3d850 = 0x3d23c + 3*0x18c + 0x170: state of 0x3d23c sprite 3.
// For i in 0..0 (loop bound 1, 0x146b7):
//   y outside [8, 0x3c] -> y = 0x1e; counter_1 clamped to [-13, 13];
//   state != 0: x += counter_1;
//   state == 1: rand(); if rand%18 == 15 && [0x3d850] == 0 && -50 < x < 0x14a: state = 0x2a;
//   state == 0x2a: counter_3++; if counter_3 > 4: counter_3 = 0, [0x60b9c]++;
//     [0x60b9c] >= 4: state = 1, [0x60b9c] = 0;
//     else 0x3d23c sprite [0x60b9c]: x = x+0x23, y = y+0x14, counter_1 = counter_1, counter_2 = 0, state = 1,
//       and curr_frame = 0 if counter_1 < 0;
//   0 < x < 0x140 && counter_2 == 0: counter_2 = 1;
//   (x < -0x82 && counter_1 < 0 && counter_2 == 1) || state == 0: y clamp again, counter_2 = 0, state = 1,
//     threshold_1 = 4, rand()%3 == 1 picks x/counter_1/curr_frame from [0x30bec] (see code), [0x60bbc] != 0:
//     state = 0, x = -200;
//   x > 0x168 && counter_1 > 0 && counter_2 == 1: similar (see code).
// Other globals by address only: 0x60b9c, 0x60bbc, 0x30bec.
// Return value: none. EAX at RET (0x14c69) is a leftover (last imul, or `mov eax,[ebp-4]` at 0x146b1); the
// only call site (0x1d653) is followed by `call 0x14c6a` (no register args, signatures.json regs 0).
// No address-taken locals ([ebp-4] is only a loop counter), no x87 instructions.
// The `mov eax,[ebp-4]` at 0x146b1 (loop increment) only loads a register that is overwritten before use.
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';
import { imod } from '../runtime/cpu.js';
import { SPRITE, a10Jets, bombs } from './data.js';
import { G, sprite } from './access.js';

const S = (k) => Math.imul(k, SPRITE.SIZE);

register(0x14690, 'updateA10Jet_14690', function updateA10Jet() {
  let i; // [ebp-4]
  let r; // EDX after `idiv ecx` (remainder of rand())

  for (i = 0; i < 1; i++) {                                              // 0x146a8..0x146bb (jge, signed)
    if (sprite(a10Jets, i).y < 8 || sprite(a10Jets, i).y > 0x3c) {        // 0x146c8 jl / 0x146d8 jle
      sprite(a10Jets, i).y = 0x1e;                                         // 0x146e8
    }
    if (sprite(a10Jets, i).counter1 > 0xd) {                                     // 0x146f9 jle
      sprite(a10Jets, i).counter1 = 0xd;                                          // 0x14709
    }
    if (sprite(a10Jets, i).counter1 < -0xd) {                                    // 0x1471a jge
      sprite(a10Jets, i).counter1 = -0xd;                                         // 0x1472a 0xfffffff3
    }
    if (sprite(a10Jets, i).state !== 0) {                                     // 0x1473b je
      sprite(a10Jets, i).x = (sprite(a10Jets, i).x + sprite(a10Jets, i).counter1) | 0; // 0x14744..0x14758
    }
    if (sprite(a10Jets, i).state === 1) {                                     // 0x14765 jne 0x14786 -> 0x147a3
      r = imod(F.rand_232c7(), 0x12);                              // 0x1476e..0x1477f
      if (r === 0xf &&                                                   // 0x14781 je
          sprite(bombs, 3).state === 0 &&                                          // 0x14788 je
          sprite(a10Jets, i).x > -0x32 &&                                 // 0x1479a jg
          sprite(a10Jets, i).x < 0x14a) {                                 // 0x147ac jl
        sprite(a10Jets, i).state = 0x2a;                                       // 0x147c1
      }
    }
    if (sprite(a10Jets, i).state === 0x2a) {                                  // 0x147d2 jne 0x148df
      sprite(a10Jets, i).counter3 = (sprite(a10Jets, i).counter3 + 1) | 0;                // 0x147e2 inc counter_3
      if (sprite(a10Jets, i).counter3 > 4) {                                     // 0x147e8 jg
        sprite(a10Jets, i).counter3 = 0;                                          // 0x147fd
        G.bombNext = (G.bombNext + 1) | 0;                            // 0x14807 inc
        if (G.bombNext >= 4) {                                         // 0x1480d jl 0x14836
          sprite(a10Jets, i).state = 1;                                        // 0x1481d
          G.bombNext = 0;                                               // 0x14827
        } else {
          sprite(bombs, G.bombNext).x = (sprite(a10Jets, i).x + 0x23) | 0; // 0x14836..0x14850
          sprite(bombs, G.bombNext).y = (sprite(a10Jets, i).y + 0x14) | 0; // 0x14856..0x14870
          sprite(bombs, G.bombNext).counter1 = sprite(a10Jets, i).counter1;           // 0x14876..0x1488d
          sprite(bombs, G.bombNext).counter2 = 0;                             // 0x14893..0x1489d
          sprite(bombs, G.bombNext).state = 1;                             // 0x148a7..0x148b1
          if (sprite(a10Jets, i).counter1 < 0) {                                 // 0x148c2 jge
            sprite(bombs, G.bombNext).currFrame = 0;                           // 0x148cb..0x148d5
          }
        }
      }
    }
    if (sprite(a10Jets, i).x < 0x140 &&                                   // 0x148e6 jge
        sprite(a10Jets, i).x > 0 &&                                       // 0x148f9 jg
        sprite(a10Jets, i).counter2 === 0) {                                     // 0x1490b je
      sprite(a10Jets, i).counter2 = 1;                                            // 0x1491d
    }
    if ((sprite(a10Jets, i).x < -0x82 &&                                  // 0x1492e jge 0xffffff7e
         sprite(a10Jets, i).counter1 < 0 &&                                      // 0x14941 jl
         sprite(a10Jets, i).counter2 === 1) ||                                   // 0x14953 je 0x14970
        sprite(a10Jets, i).state === 0) {                                     // 0x14963 jne 0x14add
      if (sprite(a10Jets, i).y < 8 || sprite(a10Jets, i).y > 0x3c) {      // 0x14977 jl / 0x14987 jle
        sprite(a10Jets, i).y = 0x1e;                                       // 0x14997
      }
      sprite(a10Jets, i).counter2 = 0;                                            // 0x149a8
      sprite(a10Jets, i).state = 1;                                            // 0x149b9
      sprite(a10Jets, i).threshold1 = 4;                                            // 0x149ca threshold_1
      r = imod(F.rand_232c7(), 3);                                 // 0x149d4..0x149e5
      if (r === 1) {                                                     // 0x149e7 jne 0x14a53
        sprite(a10Jets, i).x = (0x528 - Math.imul(G.level, 0x32)) | 0; // 0x149ec..0x14a01
        if (sprite(a10Jets, i).x < 0x140) {                               // 0x14a0e jge
          sprite(a10Jets, i).x = 0x168;                                    // 0x14a21
        }
        sprite(a10Jets, i).counter1 = (-G.level) | 0;                        // 0x14a2b..0x14a3a neg
        sprite(a10Jets, i).currFrame = 0;                                          // 0x14a47 curr_frame
      } else {
        sprite(a10Jets, i).counter1 = G.level;                               // 0x14a53..0x14a60
        sprite(a10Jets, i).currFrame = 1;                                          // 0x14a6d curr_frame
        sprite(a10Jets, i).x = (Math.imul(G.level, 0x32) - 0x3e8) | 0; // 0x14a77..0x14a8b
        if (sprite(a10Jets, i).x > 0) {                                   // 0x14a98 jle
          sprite(a10Jets, i).x = -100;                                     // 0x14aa8 0xffffff9c
        }
      }
      if (G.levelEnding !== 0) {                                          // 0x14ab2 je
        sprite(a10Jets, i).state = 0;                                          // 0x14ac2
        sprite(a10Jets, i).x = -200;                                       // 0x14ad3 0xffffff38
      }
    }
    if (sprite(a10Jets, i).x > 0x168 &&                                   // 0x14ae4 jle
        sprite(a10Jets, i).counter1 > 0 &&                                       // 0x14af7 jg
        sprite(a10Jets, i).counter2 === 1) {                                     // 0x14b09 je
      sprite(a10Jets, i).counter2 = 0;                                            // 0x14b1e
      sprite(a10Jets, i).state = 1;                                            // 0x14b2f
      sprite(a10Jets, i).threshold1 = 4;                                            // 0x14b40 threshold_1
      if (G.levelEnding !== 0) {                                          // 0x14b4a je
        sprite(a10Jets, i).state = 0;                                          // 0x14b5a
      }
      r = imod(F.rand_232c7(), 3);                                 // 0x14b64..0x14b75
      if (r === 1) {                                                     // 0x14b77 jne 0x14bca
        sprite(a10Jets, i).x = (Math.imul(G.level, 0x32) - 0x3e8) | 0; // 0x14b7c..0x14b90
        if (sprite(a10Jets, i).x > 0) {                                   // 0x14b9d jle
          sprite(a10Jets, i).x = -100;                                     // 0x14bad 0xffffff9c
        }
        sprite(a10Jets, i).currFrame = 1;                                          // 0x14bbe curr_frame
      } else {
        sprite(a10Jets, i).counter1 = (-G.level) | 0;                        // 0x14bca..0x14bd9 neg
        sprite(a10Jets, i).currFrame = 0;                                          // 0x14be6 curr_frame
        sprite(a10Jets, i).x = (0x528 - Math.imul(G.level, 0x32)) | 0; // 0x14bf0..0x14c07
        if (sprite(a10Jets, i).x < 0x140) {                               // 0x14c14 jge
          sprite(a10Jets, i).x = 0x1a4;                                    // 0x14c27
        }
      }
      if (G.levelEnding !== 0) {                                          // 0x14c31 je
        sprite(a10Jets, i).state = 0;                                          // 0x14c41
        sprite(a10Jets, i).x = -200;                                       // 0x14c52 0xffffff38
      }
    }
  }                                                                      // 0x14c5c jmp 0x146b1
});
