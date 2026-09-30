// 0x16837  void updateJahReplant(void)   [Watcom, no args, no return value]
// Size 863 bytes (0x16837..0x16b95). Updates the sprite at 0x45d74 and marks sprites of the 26-entry array at
// 0x3a878 (stride 0x18c) that it overlaps.
// Evidence for the structs: 0x45d74 is passed to Sprite_Init (decompiled.c line 4518:
// Sprite_Init(&0x45d74,100,0x50,0x41,0x4b,...)) and to Behind_Sprite_Clip; 0x3a878 + i*0x18c is passed to
// Sprite_Init / PCX_Get_Sprite / Draw_Sprite_Clip (decompiled.c lines 4398, 4400, 2534). Field names from
// the sprite struct (LIBRARY.md):
//   0x45d74 x, 0x45d78 y, 0x45d7c width, 0x45d80 height, 0x45d88 counter_2 (+0x14), 0x45edc curr_frame (+0x168),
//   0x45ee4 state (+0x170);
//   0x3a878+i*0x18c x, 0x3a87c+.. y, 0x3a880+.. width, 0x3a890+.. counter_3 (+0x18), 0x3a9e0+.. curr_frame,
//   0x3a9e8+.. state.
// 0x64f94/0x65024/0x65044/0x65038/0x65030: keyboard_state[0x24/0x48/0x50/0x4d/0x4b] (0x64f04 + 4*scan, LIBRARY.md).
// 0x61380 / 0x61200: dws_DPLAY structs (stride 0x20 array, LIBRARY.md).
// Other globals (0x3dd14, 0x3de78, 0x60bcc, 0x60a68, 0x30bf4) are referred to by address only.
// Return: EAX at RET is a leftover (last `mov eax,[ebp-4]` / imul / add); nothing sets it deliberately and
// signatures.json `returns` = false (1 caller) -> no return value (PORTING.md).
// No loop here waits on interrupt-written memory or the clock: both loops run a fixed 0x1a iterations.
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';
import { JAH, LEVEL_END_LOOP, PLANT } from './states.js';
import { KEY, jah, messageBox, plants, sndGetSome, sndProtect } from './data.js';
import { G, keyDown, sprite } from './access.js';

register(0x16837, 'updateJahReplant_16837', function updateJahReplant() {
  let i; // [ebp-4]

  if (sprite(jah).state === JAH.IDLE) {                                                         // 1684f
    sprite(jah).y = (sprite(jah).y - 2) | 0;                                              // 16858
    if (((sprite(jah).y + sprite(jah).height) | 0) > sprite(messageBox).y && sprite(messageBox).currFrame !== 3) {    // 1685f..16879 (jle / jne)
      F.dws_DPlay_1eff8(sndProtect);                                                // 1687d..16888 (cdecl, 1 stack arg)
      sprite(messageBox).currFrame = 3;                                                                 // 1688b
    }
    if (((sprite(jah).y + sprite(jah).height) | 0) < 0) {                                     // 16895..168a2 (test; jge)
      G.levelEndLoopState = LEVEL_END_LOOP.DONE;                                                              // 168a4
    }
  } else {                                                                             // 168b3
    if (((sprite(plants).y - 0x37) | 0) > sprite(jah).y) {                                  // 168b3..168c1 (jle)
      sprite(jah).y = (sprite(jah).y + 2) | 0;                                            // 168c3
    }
    if (sprite(jah).y > sprite(messageBox).y && G.jahReplantX === -1) {                          // 168ca..168de (jle / je)
      sprite(jah).state = JAH.IDLE;                                                              // 168e2
      G.score = (G.score + 0x1f40) | 0;                                       // 168ec
      return;                                                                          // 168f6 -> 16b8d
    }
    if (sprite(jah).y > sprite(messageBox).y && sprite(messageBox).currFrame !== 1) {                           // 168fb..1690f (jle / jne)
      sprite(messageBox).currFrame = 1;                                                                 // 16913
      F.dws_DPlay_1eff8(sndGetSome);                                                // 1691d..16928 (cdecl, 1 stack arg)
    }
    if (sprite(jah).x < G.jahReplantX) {                                                 // 1692b..16936 (jge)
      sprite(jah).x = (sprite(jah).x + 2) | 0;                                            // 16938
    }
    if (sprite(jah).x >= G.jahReplantX && ((sprite(plants).y - 0x37) | 0) <= sprite(jah).y) { // 1693f..1695a (jl / jle)
      sprite(jah).counter2 = (sprite(jah).counter2 - 1) | 0;                                            // 1695e
      if (sprite(jah).counter2 < 0 || ((sprite(jah).x + sprite(jah).width) | 0) > 0x140) {           // 16964..1697d (jl / jle)
        sprite(jah).state = JAH.IDLE;                                                            // 1697f
      } else {
        sprite(jah).x = (sprite(jah).x + 2) | 0;                                          // 1698b
      }
    }
  }
  if (keyDown(KEY.j) !== 0) {                                                            // 16992
    if (keyDown(KEY.up) !== 0) {                                                          // 1699f
      sprite(jah).y = (sprite(jah).y - 1) | 0;                                            // 169a8
    }
    if (keyDown(KEY.down) !== 0) {                                                          // 169ae
      sprite(jah).y = (sprite(jah).y + 2) | 0;                                            // 169b7
    }
    if (keyDown(KEY.right) !== 0) {                                                          // 169be
      sprite(jah).x = (sprite(jah).x + 1) | 0;                                            // 169c7
    }
    if (keyDown(KEY.left) !== 0) {                                                          // 169cd
      sprite(jah).x = (sprite(jah).x - 1) | 0;                                            // 169d6
    }
    sprite(jah).currFrame = (sprite(jah).currFrame + 1) | 0;                                              // 169dc
    if (sprite(jah).currFrame > 2) {                                                            // 169e2 (jle)
      sprite(jah).currFrame = 0;                                                                 // 169eb
    }
    for (i = 0; i < 0x1a; i++) {                                                       // 169f5..16a08, 169fe..16a01
      if (((sprite(jah).y + sprite(jah).height) | 0) > sprite(plants, i).y &&            // 16a0e..16a28 (jle)
          sprite(jah).x < sprite(plants, i).x &&                                   // 16a2a..16a3d (jl)
          ((sprite(jah).x + sprite(jah).width) | 0) >
            ((sprite(plants, i).x + sprite(plants, i).width) | 0) &&             // 16a41..16a6a (jg)
          sprite(plants, i).state === PLANT.DEAD) {                                            // 16a6e..16a7c (je)
        sprite(plants, i).state = PLANT.REGROWING;                                                // 16a80
        sprite(plants, i).currFrame = 6;                                                   // 16a91
        sprite(plants, i).counter3 = 0x3c;                                                // 16aa2
      }
    }
  }
  for (i = 0; i < 0x1a; i++) {                                                         // 16ab8..16acb, 16ac1..16ac4
    if (((sprite(jah).y + sprite(jah).height) | 0) > sprite(plants, i).y &&              // 16ad1..16aeb (jle)
        sprite(jah).x < sprite(plants, i).x &&                                     // 16aed..16b00 (jl)
        ((sprite(jah).x + sprite(jah).width) | 0) >
          ((sprite(plants, i).x + sprite(plants, i).width) | 0) &&               // 16b04..16b2d (jg)
        sprite(plants, i).state === PLANT.DEAD &&                                              // 16b31..16b3f (je)
        sprite(plants, i).currFrame !== 7) {                                              // 16b43..16b51 (jne)
      sprite(plants, i).state = PLANT.REGROWING;                                                  // 16b55
      sprite(plants, i).currFrame = 6;                                                     // 16b66
      sprite(plants, i).counter3 = 0x3c;                                                  // 16b77
    }
  }
});
