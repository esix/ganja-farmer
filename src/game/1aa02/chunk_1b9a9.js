// Chunk I4 of main (0x1aa02): range [0x1b9a9, 0x1bed0).
// Entry 0x1b9a9, single exit 0x1bed0 (falls through to chunk_1bed0, I5).
// No live registers/locals at either end (MAIN_PLAN.md §2). Straight line + 13 single-level counted loops.
// Nine groups, each: PCX_Init(0x31ee4); PCX_Load(<file>, 0x31ee4, 1); Sprite_Init(<sprite>, ...);
// PCX_Get_Sprite loop(s); PCX_Delete(0x31ee4).
// Callees: PCX_Init_207a0 x9, PCX_Load_20806 x9, Sprite_Init_20ce5 x9, PCX_Get_Sprite_20c12 x13 call sites,
// PCX_Delete_20b69 x9.
// Argument conventions (see src/lib): Sprite_Init(EAX, EDX, EBX, ECX, then 7 pushed dwords; the last
// push is the first stack arg); PCX_Get_Sprite(EAX, EDX, EBX, ECX, 1 pushed dword).
// The `mov eax,[ebp-8]` before every `inc [ebp-8]` is a dead read and produces nothing.
import { F } from '../../runtime/registry.js';
import { cruiseMissile, jah, messageBox, missile, missileTarget, nukeCloud, pcxScratch, powerupDrop, rasta, ufo } from '../data.js';

export function chunk_1b9a9() {
  let i; // [ebp-8]

  // --- group 1: "rasta.pcx" (0x30240: 72 61 73 74 61 2e 70 63 78 00) -> sprite struct 0x33dbc
  F.PCX_Init_207a0(pcxScratch);                                            // 0x1b9a9..0x1b9ae
  F.PCX_Load_20806(0x30240 /* "rasta.pcx" */, pcxScratch, 1);              // 0x1b9b3..0x1b9c2
  F.Sprite_Init_20ce5(rasta, 0x91, 0x8d, 0x1c, 0x1f, 0, 0, 0, 0, 0, 0); // 0x1b9c7..0x1b9e9
  for (i = 0; i < 0xa; i++) {                                                 // 0x1b9ee..0x1ba01, 0x1ba1a
    F.PCX_Get_Sprite_20c12(pcxScratch, rasta, i, i, 0);                  // 0x1ba03..0x1ba15
  }
  for (i = 0xa; i < 0x14; i++) {                                              // 0x1ba1c..0x1ba2f, 0x1ba4b
    F.PCX_Get_Sprite_20c12(pcxScratch, rasta, i, (i - 0xa) | 0, 1);      // 0x1ba31..0x1ba46
  }
  for (i = 0x14; i < 0x1e; i++) {                                             // 0x1ba4d..0x1ba60, 0x1ba7c
    F.PCX_Get_Sprite_20c12(pcxScratch, rasta, i, (i - 0x14) | 0, 2);     // 0x1ba62..0x1ba77
  }
  for (i = 0x1e; i < 0x28; i++) {                                             // 0x1ba7e..0x1ba91, 0x1baad
    F.PCX_Get_Sprite_20c12(pcxScratch, rasta, i, (i - 0x1e) | 0, 3);     // 0x1ba93..0x1baa8
  }
  F.PCX_Delete_20b69(pcxScratch);                                          // 0x1baaf..0x1bab4

  // --- group 2: "rgdiabox.pcx" (0x3024a: 72 67 64 69 61 62 6f 78 2e 70 63 78 00) -> sprite struct 0x3dd10
  F.PCX_Init_207a0(pcxScratch);                                            // 0x1bab9..0x1babe
  F.PCX_Load_20806(0x3024a /* "rgdiabox.pcx" */, pcxScratch, 1);           // 0x1bac3..0x1bad2
  F.Sprite_Init_20ce5(messageBox, 0x64, 0x50, 0x7b, 0x18, 0, 0, 0, 0, 0, 0); // 0x1bad7..0x1baf9
  for (i = 0; i < 4; i++) {                                                   // 0x1bafe..0x1bb11, 0x1bb2b
    F.PCX_Get_Sprite_20c12(pcxScratch, messageBox, i, 0, i);                  // 0x1bb13..0x1bb26 (push [ebp-8]; xor ecx,ecx)
  }
  F.PCX_Delete_20b69(pcxScratch);                                          // 0x1bb2d..0x1bb32

  // --- group 3: "nuke.pcx" (0x30257: 6e 75 6b 65 2e 70 63 78 00) -> sprite struct 0x5fd90
  F.PCX_Init_207a0(pcxScratch);                                            // 0x1bb37..0x1bb3c
  F.PCX_Load_20806(0x30257 /* "nuke.pcx" */, pcxScratch, 1);               // 0x1bb41..0x1bb50
  F.Sprite_Init_20ce5(nukeCloud, 0x64, 0x50, 0x68, 0x62, 0, 0, 0, 0, 0, 0); // 0x1bb55..0x1bb77
  for (i = 0; i < 3; i++) {                                                   // 0x1bb7c..0x1bb8f, 0x1bba8
    F.PCX_Get_Sprite_20c12(pcxScratch, nukeCloud, i, i, 0);                  // 0x1bb91..0x1bba3
  }
  for (i = 3; i < 6; i++) {                                                   // 0x1bbaa..0x1bbbd, 0x1bbd9
    F.PCX_Get_Sprite_20c12(pcxScratch, nukeCloud, i, (i - 3) | 0, 1);        // 0x1bbbf..0x1bbd4
  }
  F.PCX_Delete_20b69(pcxScratch);                                          // 0x1bbdb..0x1bbe0

  // --- group 4: "jah.pcx" (0x30260: 6a 61 68 2e 70 63 78 00) -> sprite struct 0x45d74
  F.PCX_Init_207a0(pcxScratch);                                            // 0x1bbe5..0x1bbea
  F.PCX_Load_20806(0x30260 /* "jah.pcx" */, pcxScratch, 1);                // 0x1bbef..0x1bbfe
  F.Sprite_Init_20ce5(jah, 0x64, 0x50, 0x41, 0x4b, 0, 0, 0, 0, 0, 0); // 0x1bc03..0x1bc25
  for (i = 0; i < 3; i++) {                                                   // 0x1bc2a..0x1bc3d, 0x1bc56
    F.PCX_Get_Sprite_20c12(pcxScratch, jah, i, i, 0);                  // 0x1bc3f..0x1bc51
  }
  F.PCX_Delete_20b69(pcxScratch);                                          // 0x1bc58..0x1bc5d

  // --- group 5: "ufo.pcx" (0x30268: 75 66 6f 2e 70 63 78 00) -> sprite struct 0x4c38c
  F.PCX_Init_207a0(pcxScratch);                                            // 0x1bc62..0x1bc67
  F.PCX_Load_20806(0x30268 /* "ufo.pcx" */, pcxScratch, 1);                // 0x1bc6c..0x1bc7b
  F.Sprite_Init_20ce5(ufo, 0x64, 0x50, 0x4c, 0x43, 0, 0, 0, 0, 0, 0); // 0x1bc80..0x1bca2
  for (i = 0; i < 2; i++) {                                                   // 0x1bca7..0x1bcba, 0x1bcd3
    F.PCX_Get_Sprite_20c12(pcxScratch, ufo, i, i, 0);                  // 0x1bcbc..0x1bcce
  }
  F.PCX_Delete_20b69(pcxScratch);                                          // 0x1bcd5..0x1bcda

  // --- group 6: "crusmis.pcx" (0x30270: 63 72 75 73 6d 69 73 2e 70 63 78 00) -> sprite struct 0x5fc04
  F.PCX_Init_207a0(pcxScratch);                                            // 0x1bcdf..0x1bce4
  F.PCX_Load_20806(0x30270 /* "crusmis.pcx" */, pcxScratch, 1);            // 0x1bce9..0x1bcf8
  F.Sprite_Init_20ce5(cruiseMissile, 0x64, 0x50, 0x21, 0xe, 0, 0, 0, 0, 0, 0); // 0x1bcfd..0x1bd1f
  for (i = 0; i < 4; i++) {                                                   // 0x1bd24..0x1bd37, 0x1bd50
    F.PCX_Get_Sprite_20c12(pcxScratch, cruiseMissile, i, i, 0);                  // 0x1bd39..0x1bd4b
  }
  F.PCX_Delete_20b69(pcxScratch);                                          // 0x1bd52..0x1bd57

  // --- group 7: "drpshoot.pcx" (0x3027c: 64 72 70 73 68 6f 6f 74 2e 70 63 78 00) -> sprite struct 0x5fa78
  F.PCX_Init_207a0(pcxScratch);                                            // 0x1bd5c..0x1bd61
  F.PCX_Load_20806(0x3027c /* "drpshoot.pcx" */, pcxScratch, 1);           // 0x1bd66..0x1bd75
  // 0x1bd8d mov ebx,0xffffffb0 (-0x50); 0x1bd92 xor edx,edx
  F.Sprite_Init_20ce5(powerupDrop, 0, -0x50, 0x2c, 0x26, 0, 0, 0, 0, 0, 0); // 0x1bd7a..0x1bd99
  for (i = 0; i < 6; i++) {                                                   // 0x1bd9e..0x1bdb1, 0x1bdca
    F.PCX_Get_Sprite_20c12(pcxScratch, powerupDrop, i, i, 0);                  // 0x1bdb3..0x1bdc5
  }
  F.PCX_Delete_20b69(pcxScratch);                                          // 0x1bdcc..0x1bdd1

  // --- group 8: "missle.pcx" (0x30289: 6d 69 73 73 6c 65 2e 70 63 78 00) -> sprite struct 0x45f00
  F.PCX_Init_207a0(pcxScratch);                                            // 0x1bdd6..0x1bddb
  F.PCX_Load_20806(0x30289 /* "missle.pcx" */, pcxScratch, 1);             // 0x1bde0..0x1bdef
  // 0x1be07 mov ebx,0xffffffb0 (-0x50); 0x1be0c mov edx,0xfffffed4 (-0x12c)
  F.Sprite_Init_20ce5(missile, -0x12c, -0x50, 0x13, 0xe, 0, 0, 0, 0, 0, 0); // 0x1bdf4..0x1be16
  for (i = 0; i < 5; i++) {                                                   // 0x1be1b..0x1be2e, 0x1be47
    F.PCX_Get_Sprite_20c12(pcxScratch, missile, i, i, 0);                  // 0x1be30..0x1be42
  }
  F.PCX_Delete_20b69(pcxScratch);                                          // 0x1be49..0x1be4e

  // --- group 9: "diemon.pcx" (0x30294: 64 69 65 6d 6f 6e 2e 70 63 78 00) -> sprite struct 0x4608c
  F.PCX_Init_207a0(pcxScratch);                                            // 0x1be53..0x1be58
  F.PCX_Load_20806(0x30294 /* "diemon.pcx" */, pcxScratch, 1);             // 0x1be5d..0x1be6c
  // 0x1be84 mov ebx,0xffffffb0 (-0x50); 0x1be89 mov edx,0xfffffed4 (-0x12c)
  F.Sprite_Init_20ce5(missileTarget, -0x12c, -0x50, 0x1e, 0xb, 0, 0, 0, 0, 0, 0); // 0x1be71..0x1be93
  for (i = 0; i < 2; i++) {                                                   // 0x1be98..0x1beab, 0x1bec4
    F.PCX_Get_Sprite_20c12(pcxScratch, missileTarget, i, i, 0);                  // 0x1bead..0x1bebf
  }
  F.PCX_Delete_20b69(pcxScratch);                                          // 0x1bec6..0x1becb
}
