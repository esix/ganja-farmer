// main (0x1aa02) chunk I3: range [0x1b4b9, 0x1b9a9)
// Entry 0x1b4b9, single exit 0x1b9a9 (falls through to chunk I4, loadCharacterSprites).
// No live registers/locals at either end (MAIN_PLAN.md §2). Locals: [ebp-4], [ebp-8] (chunk-local).
// Five groups on the pcx_picture struct at 0x31ee4 (LIBRARY.md): PCX_Init, PCX_Load(<file>, 0x31ee4, 1),
// Sprite_Init on 0x18c-byte sprite structs, PCX_Get_Sprite loops, PCX_Delete (the "nums.pcx" group
// initialises three sprite arrays 0x44010, 0x44ae4, 0x452a0 and has one PCX_Delete for all three).
// Callees: PCX_Init x5, PCX_Load x5, Sprite_Init x7 sites, PCX_Get_Sprite x8 sites, PCX_Delete x5.
// Not an async-wait loop anywhere: all loops are counted loops on [ebp-4]/[ebp-8] (signed jge).
import { F } from '../../runtime/registry.js';
import { W32 } from '../../runtime/mem.js';
import { a10Jets, bombs, bongSmoke, explosions, killsDigits, levelDigits, pcxScratch, scoreDigits } from '../data.js';
import { sprite } from '../access.js';

export function loadAircraftAndHudSprites() {
  let i; // [ebp-4]
  let j; // [ebp-8]

  // ---- group "cloud.pcx" ----
  F.PCX_Init_207a0(pcxScratch);                                          // 0x1b4b9..0x1b4be
  F.PCX_Load_20806(0x30212 /* "cloud.pcx" = 63 6c 6f 75 64 2e 70 63 78 00 */, pcxScratch, 1); // 0x1b4c3..0x1b4d2
  for (i = 0; i < 0xc8; i++) {                                              // 0x1b4d7..0x1b4ed, 0x1b4e0 inc, 0x1b559 jmp
    F.Sprite_Init_20ce5(sprite(bongSmoke, i).addr, -200, -200, 0xd,
      9, 0, 0, 0, 0, 0, 0);                                                 // 0x1b4ef..0x1b51a (0xffffff38 = -200)
    for (j = 0; j < 1; j++) {                                               // 0x1b51f..0x1b532, 0x1b528 inc, 0x1b557 jmp
      F.PCX_Get_Sprite_20c12(pcxScratch, sprite(bongSmoke, i).addr, j, (j + 2) | 0, 0); // 0x1b534..0x1b552
    }
  }
  F.PCX_Delete_20b69(pcxScratch);                                        // 0x1b55b..0x1b560

  // ---- group "a-10.pcx" ----
  F.PCX_Init_207a0(pcxScratch);                                          // 0x1b565..0x1b56a
  F.PCX_Load_20806(0x3021c /* "a-10.pcx" = 61 2d 31 30 2e 70 63 78 00 */, pcxScratch, 1); // 0x1b56f..0x1b57e
  for (i = 0; i < 1; i++) {                                                 // 0x1b583..0x1b596, 0x1b58c inc, 0x1b636 jmp
    F.Sprite_Init_20ce5(sprite(a10Jets, i).addr, -500, 0xa, 0x78,
      0x1f, 0, 0, 0, 0, 0, 0);                                              // 0x1b59c..0x1b5c7 (0xfffffe0c = -500)
    for (j = 0; j < 2; j++) {                                               // 0x1b5cc..0x1b5df, 0x1b5d5 inc, 0x1b601 jmp
      F.PCX_Get_Sprite_20c12(pcxScratch, sprite(a10Jets, i).addr, j, j, 0); // 0x1b5e1..0x1b5fc
    }
    sprite(a10Jets, i).state = 1;                            // 0x1b603..0x1b60a
    sprite(a10Jets, i).counter1 = -9;                           // 0x1b614..0x1b61b (0xfffffff7)
    sprite(a10Jets, i).counter2 = 1;                            // 0x1b625..0x1b62c
  }
  F.PCX_Delete_20b69(pcxScratch);                                        // 0x1b63b..0x1b640

  // ---- group "bomb.pcx" ----
  F.PCX_Init_207a0(pcxScratch);                                          // 0x1b645..0x1b64a
  F.PCX_Load_20806(0x30225 /* "bomb.pcx" = 62 6f 6d 62 2e 70 63 78 00 */, pcxScratch, 1); // 0x1b64f..0x1b65e
  for (i = 0; i < 4; i++) {                                                 // 0x1b663..0x1b676, 0x1b66c inc, 0x1b6f1 jmp
    F.Sprite_Init_20ce5(sprite(bombs, i).addr, -100, 0, 0x10,
      9, 0, 0, 0, 0, 0, 0);                                                 // 0x1b67c..0x1b6a4 (0xffffff9c = -100; xor ebx,ebx)
    for (j = 0; j < 6; j++) {                                               // 0x1b6a9..0x1b6bc, 0x1b6b2 inc, 0x1b6de jmp
      F.PCX_Get_Sprite_20c12(pcxScratch, sprite(bombs, i).addr, j, j, 0); // 0x1b6be..0x1b6d9
    }
    sprite(bombs, i).state = 0;                            // 0x1b6e0..0x1b6e7
  }
  F.PCX_Delete_20b69(pcxScratch);                                        // 0x1b6f6..0x1b6fb

  // ---- group "nums.pcx" (three sprite arrays, one PCX_Delete) ----
  F.PCX_Init_207a0(pcxScratch);                                          // 0x1b700..0x1b705
  F.PCX_Load_20806(0x3022e /* "nums.pcx" = 6e 75 6d 73 2e 70 63 78 00 */, pcxScratch, 1); // 0x1b70a..0x1b719
  for (i = 0; i < 7; i++) {                                                 // 0x1b71e..0x1b731, 0x1b727 inc, 0x1b79e jmp
    // EDX = (i << 2) + 0x30 (0x1b74b..0x1b751); EAX = i*0x18c + ESI(0x44010) (0x1b754..0x1b760)
    F.Sprite_Init_20ce5(sprite(scoreDigits, i).addr, ((i << 2) + 0x30) | 0, 3, 3,
      5, 0, 0, 0, 0, 0, 0);                                                 // 0x1b733..0x1b762
    for (j = 0; j < 0xa; j++) {                                             // 0x1b767..0x1b77a, 0x1b770 inc, 0x1b79c jmp
      F.PCX_Get_Sprite_20c12(pcxScratch, sprite(scoreDigits, i).addr, j, j, 0); // 0x1b77c..0x1b797
    }
  }
  for (i = 0; i < 5; i++) {                                                 // 0x1b7a0..0x1b7b3, 0x1b7a9 inc, 0x1b820 jmp
    // EDX = (i << 2) + 0x65 (0x1b7cd..0x1b7d3); EAX = i*0x18c + ESI(0x44ae4) (0x1b7d6..0x1b7e2)
    F.Sprite_Init_20ce5(sprite(killsDigits, i).addr, ((i << 2) + 0x65) | 0, 3, 3,
      5, 0, 0, 0, 0, 0, 0);                                                 // 0x1b7b5..0x1b7e4
    for (j = 0; j < 0xa; j++) {                                             // 0x1b7e9..0x1b7fc, 0x1b7f2 inc, 0x1b81e jmp
      F.PCX_Get_Sprite_20c12(pcxScratch, sprite(killsDigits, i).addr, j, j, 0); // 0x1b7fe..0x1b819
    }
  }
  for (i = 0; i < 3; i++) {                                                 // 0x1b822..0x1b835, 0x1b82b inc, 0x1b8a5 jmp
    // EDX = (i << 2) + 0xa7 (0x1b84f..0x1b855); EAX = i*0x18c + ESI(0x452a0) (0x1b85b..0x1b867)
    F.Sprite_Init_20ce5(sprite(levelDigits, i).addr, ((i << 2) + 0xa7) | 0, 3, 3,
      5, 0, 0, 0, 0, 0, 0);                                                 // 0x1b837..0x1b869
    for (j = 0; j < 0xa; j++) {                                             // 0x1b86e..0x1b881, 0x1b877 inc, 0x1b8a3 jmp
      F.PCX_Get_Sprite_20c12(pcxScratch, sprite(levelDigits, i).addr, j, j, 0); // 0x1b883..0x1b89e
    }
  }
  F.PCX_Delete_20b69(pcxScratch);                                        // 0x1b8a7..0x1b8ac

  // ---- group "exp2.pcx" ----
  F.PCX_Init_207a0(pcxScratch);                                          // 0x1b8b1..0x1b8b6
  F.PCX_Load_20806(0x30237 /* "exp2.pcx" = 65 78 70 32 2e 70 63 78 00 */, pcxScratch, 1); // 0x1b8bb..0x1b8ca
  for (i = 0; i < 0xd; i++) {                                               // 0x1b8cf..0x1b8e2, 0x1b8d8 inc, 0x1b99a jmp
    F.Sprite_Init_20ce5(sprite(explosions, i).addr, -50, -50, 0x2c,
      0x22, 0, 0, 0, 0, 0, 0);                                              // 0x1b8e8..0x1b913 (0xffffffce = -50)
    sprite(explosions, i).state = 0;                            // 0x1b918..0x1b91f
    for (j = 0; j < 6; j++) {                                               // 0x1b929..0x1b93c, 0x1b932 inc, 0x1b95e jmp
      F.PCX_Get_Sprite_20c12(pcxScratch, sprite(explosions, i).addr, j, j, 0); // 0x1b93e..0x1b959
    }
    for (j = 6; j < 0xc; j++) {                                             // 0x1b960..0x1b973, 0x1b969 inc, 0x1b998 jmp
      F.PCX_Get_Sprite_20c12(pcxScratch, sprite(explosions, i).addr, j, (j - 6) | 0, 1); // 0x1b975..0x1b993
    }
  }
  F.PCX_Delete_20b69(pcxScratch);                                        // 0x1b99f..0x1b9a4
}
