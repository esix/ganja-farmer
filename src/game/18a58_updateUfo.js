// 0x18a58  void updateUfo(void)   [Watcom, no args, no return value]
// Args: none — the prologue pushes EBX/ECX/EDX/ESI/EDI (all saved, none read before being written);
// signatures.json regs 0 / stack 0. Only caller: 0x1d680 (`call 0x18a58`, followed by `call 0x14fba`, EAX not
// read). Return: none — EAX at the RET (0x18f26) is a leftover (last callee result / arithmetic).
// Per-call update of the sprite at 0x4c38c (0x4c38c is a sprite: decompiled.c line 2841
// `Erase_Sprite_Clip(&DAT_0004c38c, ...)`; field names from the sprite struct in LIBRARY.md):
//   0x4c38c x, 0x4c390 y, 0x4c394 width, 0x4c398 height, 0x4c39c counter_1, 0x4c3a0 counter_2,
//   0x4c3a4 counter_3, 0x4c3ac threshold_2, 0x4c4f4 curr_frame, 0x4c4fc state.
// and of the 26-entry sprite array at 0x3a878 (stride 0x18c; see 14425_sub_14425.js header):
//   0x3a878 x, 0x3a880 width, 0x3a9e0 curr_frame, 0x3a9e8 state.
// Steps: DAC entry 0xa5 := 3 bytes rand()%63 (Write_Color_Reg); height = 0x22; curr_frame toggles 0/1;
// then a state machine on [0x4c4fc] (values 0, 0x3d, 0x3e, 0x3f, 0x1b, 0x1c, 0x40) moving x/y, selecting an
// index into the 0x3a878 array ([0x60bd0]), and calling dws_DPlay / dws_DDiscard / dws_DSoundStatus on the
// dws_DPLAY structs at 0x61620 and 0x61640 (+0xA soundnum, LIBRARY.md).
// Local [ebp-4..ebp-2] (3 bytes, address passed to Write_Color_Reg as RGB_color* (LIBRARY.md)) is
// address-taken -> emulated stack. [ebp-8] (running minimum) and [ebp-0xc] (loop counter) are plain locals.
import { F, register } from '../runtime/registry.js';
import { R16, R32, W8, W32, R8 } from '../runtime/mem.js';
import { imod } from '../runtime/cpu.js';
import { stackAlloc, stackFree } from '../runtime/stack.js';
import { plants, sndUfo, sndUfo2, ufo, ufoSoundStatus } from './data.js';
import { G, dplay, sprite } from './access.js';

register(0x18a58, 'updateUfo_18a58', function updateUfo() {
  let best; // [ebp-8]
  let i;    // [ebp-0xc]
  let a, c;
  const col = stackAlloc(4); // [ebp-4] (dword slot; bytes +0..+2 used)

  best = 0x17c;                                                        // 18a70
  // 18a77..18a81: movsw; movsb — copy 3 bytes from 0x64e78 into [ebp-4]
  W8(col, R8(0x64e78)); W8(col + 1, R8(0x64e79)); W8(col + 2, R8(0x64e7a));
  W8(col, imod(F.rand_232c7(), 0x3f) & 0xff);                    // 18a82..18a95: mov [ebp-4], dl
  W8(col + 1, imod(F.rand_232c7(), 0x3f) & 0xff);                // 18a98..18aab: mov [ebp-3], dl
  W8(col + 2, imod(F.rand_232c7(), 0x3f) & 0xff);                // 18aae..18ac1: mov [ebp-2], dl
  F.Write_Color_Reg_20541(0xa5, col);                            // 18ac4..18acc
  sprite(ufo).height = 0x22;                                                  // 18ad1: height = 0x22
  sprite(ufo).currFrame = (sprite(ufo).currFrame + 1) | 0;                                // 18adb: inc curr_frame
  if (sprite(ufo).currFrame > 1) sprite(ufo).currFrame = 0;                               // 18ae1: jle (signed)

  if (sprite(ufo).state === 0x3d) sprite(ufo).y = (sprite(ufo).y - 3) | 0;    // 18af4..18afd

  if (sprite(ufo).state === 0) {                                            // 18b04
    sprite(ufo).y = (-0x50 - imod(F.rand_232c7(), 0xc8)) | 0;      // 18b0d..18b27: ecx=0xffffffb0; sub ecx,edx
    if (G.levelEnding === 0) {                                          // 18b2d
      sprite(ufo).state = 0x3e;                                              // 18b36
      sprite(ufo).x = imod(F.rand_232c7(), 0x10e);                 // 18b40..18b53
      sprite(ufo).counter1 = imod(F.rand_232c7(), 0x24);                  // 18b59..18b6c
      sprite(ufo).counter2 = 2;                                                 // 18b72
      sprite(ufo).threshold2 = 0x1e;                                              // 18b7c
    }
  }

  if (sprite(ufo).state === 0x3f) {                                         // 18b86
    sprite(ufo).y = (sprite(ufo).y - 5) | 0;                              // 18b8f
    if (sprite(ufo).y < -0x50) {                                        // 18b96: jge (signed)
      sprite(ufo).state = 0x3e;                                              // 18b9f
      sprite(ufo).x = imod(F.rand_232c7(), 0x10e);                 // 18ba9..18bbc
      sprite(ufo).counter1 = imod(F.rand_232c7(), 0x24);                  // 18bc2..18bd5
      sprite(ufo).counter2 = 2;                                                 // 18bdb
    }
  }

  if (sprite(ufo).state === 0x3e) {                                         // 18be5
    sprite(ufo).y = (sprite(ufo).y + 3) | 0;                              // 18bf2
    sprite(ufo).counter1 = (sprite(ufo).counter1 - 1) | 0;                              // 18bf9
    if (sprite(ufo).counter1 < 0) {                                            // 18bff: jge (signed)
      if (sprite(ufo).counter2 >= 0) {                                         // 18c08: jl (signed)
        sprite(ufo).counter2 = imod((-(F.rand_232c7())) | 0, 5);          // 18c11..18c26: neg edx; idiv 5
      } else {
        sprite(ufo).counter2 = imod(F.rand_232c7(), 5);                   // 18c2e..18c41
      }
      sprite(ufo).counter1 = imod(F.rand_232c7(), 0x24);                  // 18c47..18c5a
    }
    if (sprite(ufo).y > 0x6c) {                                         // 18c60: jle (signed)
      for (i = 0; i < 0x1a; i++) {                                     // 18c6d..18c80, 18c76 (mov eax,[ebp-0xc] dead)
        if (sprite(plants, i).state === 1) {                // 18c82..18c90
          a = sprite(ufo).width;                                            // 18c92..18ca2: (w - (w >> 31)) >> 1
          a = ((a - (a >> 31)) | 0) >> 1;
          // 18ca4..18cbb: abs(x + width/2 - X[i])
          if ((F.abs_2377c((((sprite(ufo).x + a) | 0) - sprite(plants, i).x) | 0)) < best) { // 18cc0: jge (signed)
            // 18cc5..18cdc: best = abs(x - X[i]) — note: without the width/2 term used in the comparison above
            best = F.abs_2377c((sprite(ufo).x - sprite(plants, i).x) | 0);
            G.ufoTargetPlant = i;                                           // 18cdf..18ce2
          }
        }
      }
      a = sprite(ufo).width;                                                // 18ce9..18cf9
      a = ((a - (a >> 31)) | 0) >> 1;
      // 18cfb..18d13: x + width/2 > X[[0x60bd0]] (signed)
      if (((sprite(ufo).x + a) | 0) > sprite(plants, G.ufoTargetPlant).x) {
        sprite(ufo).state = 0x1b;                                            // 18d15
      } else {
        sprite(ufo).state = 0x1c;                                            // 18d21
      }
    }
    sprite(ufo).x = (sprite(ufo).x + sprite(ufo).counter2) | 0;                   // 18d2b..18d30
    // 18d36..18d63: negate counter_2 if (x < 0 && counter_2 < 0) || (x + width > 0x140 && counter_2 > 0)
    if ((sprite(ufo).x < 0 && sprite(ufo).counter2 < 0) ||
        (((sprite(ufo).x + sprite(ufo).width) | 0) > 0x140 && sprite(ufo).counter2 > 0)) {
      sprite(ufo).counter2 = Math.imul(sprite(ufo).counter2, -1);                       // 18d65: imul eax,[0x4c3a0],-1
    }
  }

  if (sprite(ufo).state === 0x1c) {                                         // 18d71
    sprite(ufo).x = (sprite(ufo).x + 3) | 0;                              // 18d7a
    a = sprite(plants, G.ufoTargetPlant).width;           // 18d81..18d9c: W[j]/2
    a = ((a - (a >> 31)) | 0) >> 1;
    c = (sprite(plants, G.ufoTargetPlant).x + a) | 0; // 18d9e..18dae: ecx = X[j] + W[j]/2
    a = sprite(ufo).width;                                                  // 18db0..18dc2: width/2 + x
    a = ((((a - (a >> 31)) | 0) >> 1) + sprite(ufo).x) | 0;
    if (a >= c) {                                                      // 18dc8: jl (signed)
      sprite(ufo).state = 0x40;                                              // 18dcc
      sprite(ufo).counter3 = 0x28;                                              // 18dd6
    }
  }

  if (sprite(ufo).state === 0x1b) {                                         // 18de0
    sprite(ufo).x = (sprite(ufo).x - 3) | 0;                              // 18ded
    a = sprite(plants, G.ufoTargetPlant).width;           // 18df4..18e0f
    a = ((a - (a >> 31)) | 0) >> 1;
    c = (sprite(plants, G.ufoTargetPlant).x + a) | 0; // 18e11..18e21
    a = sprite(ufo).width;                                                  // 18e23..18e35
    a = ((((a - (a >> 31)) | 0) >> 1) + sprite(ufo).x) | 0;
    if (a <= c) {                                                      // 18e3b: jg (signed)
      sprite(ufo).state = 0x40;                                              // 18e3f
      sprite(ufo).counter3 = (0x37 - G.level) | 0;                         // 18e49..18e55
      F.dws_DPlay_1eff8(sndUfo);                                // 18e5b..18e66 (cdecl)
    }
  }

  if (sprite(ufo).state === 0x40) {                                         // 18e69
    sprite(ufo).height = 0x43;                                                // 18e72: height = 0x43
    sprite(ufo).counter3 = (sprite(ufo).counter3 - 1) | 0;                              // 18e7c: dec counter_3
    if (sprite(ufo).counter3 < 0) {                                            // 18e82: jge (signed)
      sprite(ufo).state = 0x3f;                                              // 18e8b
      F.dws_DDiscard_1f770(dplay(sndUfo).soundnum);                        // 18e95..18ea3: zero-extended word soundnum of 0x61620
      sprite(plants, G.ufoTargetPlant).state = 0;          // 18ea6..18eb0: state[j] = 0
      sprite(plants, G.ufoTargetPlant).currFrame = 7;          // 18eba..18ec4: curr_frame[j] = 7
    }
  }

  // 18ece..18ee2: dws_DSoundStatus(zero-extended word [0x6164a] (soundnum of 0x61640), 0x60f18) (cdecl)
  F.dws_DSoundStatus_1f348(dplay(sndUfo2).soundnum, ufoSoundStatus);

  // 18ee5..18f16: skip if y <= -0x3c, state == 0, state == 0x40 or word [0x60f18] != 0
  if (!(sprite(ufo).y <= -0x3c || sprite(ufo).state === 0 || sprite(ufo).state === 0x40 || G.ufoSoundStatus !== 0)) {
    F.dws_DPlay_1eff8(sndUfo2);                                  // 18f10..18f1b (cdecl)
  }

  stackFree(4);
});
