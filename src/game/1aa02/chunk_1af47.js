// main (0x1aa02) chunk I2: range [0x1af47, 0x1b4b9)
// Entry 0x1af47, single exit 0x1b4b9 (falls through to the next chunk, chunk_1b4b9).
// No live registers/locals at either end (MAIN_PLAN.md §2). Locals: [ebp-4], [ebp-8] (chunk-local).
// Straight line + local counted loops (all signed jge). Six groups of
//   PCX_Init(0x31ee4) / PCX_Load(<file>, 0x31ee4, 1) / Sprite_Init... / PCX_Get_Sprite... / PCX_Delete(0x31ee4)
// with 0x31ee4 = pcx_picture instance (LIBRARY.md). Sprite struct offsets (stride 0x18c) from LIBRARY.md.
// Callees: PCX_Init 6, PCX_Load 6, Sprite_Init 9, PCX_Get_Sprite 11, PCX_Delete 6.
// Call conventions: Sprite_Init(EAX, EDX, EBX, ECX, then 7 pushed args; the last push is the 1st stack arg),
// PCX_Get_Sprite(EAX, EDX, EBX, ECX, 1 pushed arg). Constant registers 0xffffffce/0xffffff38 = -50/-200.
import { F } from '../../runtime/registry.js';
import { R32, W32 } from '../../runtime/mem.js';

export async function chunk_1af47() {
  let i; // [ebp-4]
  let j; // [ebp-8]

  // ---- group 1: "pt2.pcx" (0x301d3: 70 74 32 2e 70 63 78 00) -> sprites 0x381cc + i*0x18c
  await F.PCX_Init_207a0(0x31ee4);                                   // 1af47..1af4c
  await F.PCX_Load_20806(0x301d3 /* "pt2.pcx" */, 0x31ee4, 1);       // 1af51..1af60
  for (i = 0; i < 0x19; i++) {                                       // 1af65..1af78, 1af6e inc
    await F.Sprite_Init_20ce5((0x381cc + i * 0x18c) | 0, 0xa0, -50, 0x26, 0x2d, 0, 0, 0, 0, 0, 0); // 1af7a..1afa5
  }                                                                  // 1afaa jmp
  for (j = 0; j < 4; j++) {                                          // 1afac..1afbf
    await F.PCX_Get_Sprite_20c12(0x31ee4, 0x381cc, j, j, 0);         // 1afc1..1afd3
  }
  for (j = 4; j < 0xc; j++) {                                        // 1afda..1afed
    await F.PCX_Get_Sprite_20c12(0x31ee4, 0x381cc, j, (j - 4) | 0, 1); // 1afef..1b004
  }
  for (j = 0xc; j < 0x11; j++) {                                     // 1b00b..1b01e
    await F.PCX_Get_Sprite_20c12(0x31ee4, 0x381cc, j, (j - 0xc) | 0, 2); // 1b020..1b035
  }
  // Copy frames[0..0x10] (+0x28) and num_frames (+0x16c) of sprite 0x381cc into sprites 1..0x18 (LIBRARY.md)
  for (j = 1; j < 0x19; j++) {                                       // 1b03c..1b04f ([ebp-8] outer)
    for (i = 0; i < 0x11; i++) {                                     // 1b051..1b064 ([ebp-4] inner)
      // 1b066..1b081: edx = [ (i<<2) + 0x381f4 ]; [ ((i<<2) + j*0x18c) + 0x381f4 ] = edx
      W32(((i << 2) + j * 0x18c + 0x381f4) | 0, R32(((i << 2) + 0x381f4) | 0));
    }                                                                // 1b087 jmp
    W32((j * 0x18c + 0x38338) | 0, R32(0x38338));                    // 1b089..1b096
  }                                                                  // 1b09c jmp
  await F.PCX_Delete_20b69(0x31ee4);                                 // 1b09e..1b0a3

  // ---- group 2: "sndmenu.pcx" (0x301db: 73 6e 64 6d 65 6e 75 2e 70 63 78 00) -> sprite 0x45be8
  await F.PCX_Init_207a0(0x31ee4);                                   // 1b0a8..1b0ad
  await F.PCX_Load_20806(0x301db /* "sndmenu.pcx" */, 0x31ee4, 1);   // 1b0b2..1b0c1
  await F.Sprite_Init_20ce5(0x45be8, 0x32, 0x46, 0x83, 0x3f, 0, 0, 0, 0, 0, 0); // 1b0c6..1b0e8
  for (j = 0; j < 2; j++) {                                          // 1b0ed..1b100
    await F.PCX_Get_Sprite_20c12(0x31ee4, 0x45be8, j, j, 0);         // 1b102..1b114
  }
  await F.PCX_Delete_20b69(0x31ee4);                                 // 1b11b..1b120

  // ---- group 3: "sndbuts.pcx" (0x301e7: 73 6e 64 62 75 74 73 2e 70 63 78 00) -> sprites 0x45744, 0x458d0, 0x45a5c
  await F.PCX_Init_207a0(0x31ee4);                                   // 1b125..1b12a
  await F.PCX_Load_20806(0x301e7 /* "sndbuts.pcx" */, 0x31ee4, 1);   // 1b12f..1b13e
  await F.Sprite_Init_20ce5(0x45744, 0xaa, 0x46, 0xe, 0xe, 0, 0, 0, 0, 0, 0); // 1b143..1b165
  await F.Sprite_Init_20ce5(0x458d0, 0xaa, 0x5a, 0xe, 0xe, 0, 0, 0, 0, 0, 0); // 1b16a..1b18c
  await F.Sprite_Init_20ce5(0x45a5c, 0xaa, 0x6e, 0xe, 0xe, 0, 0, 0, 0, 0, 0); // 1b191..1b1b3
  await F.PCX_Get_Sprite_20c12(0x31ee4, 0x45744, 0, 0, 0);           // 1b1b8..1b1c8
  await F.PCX_Get_Sprite_20c12(0x31ee4, 0x458d0, 0, 1, 0);           // 1b1cd..1b1e0
  await F.PCX_Get_Sprite_20c12(0x31ee4, 0x45a5c, 0, 2, 0);           // 1b1e5..1b1f8
  await F.PCX_Delete_20b69(0x31ee4);                                 // 1b1fd..1b202

  // ---- group 4: "duster.pcx" (0x301f3: 64 75 73 74 65 72 2e 70 63 78 00) -> sprites 0x3d86c + i*0x18c, i<3
  await F.PCX_Init_207a0(0x31ee4);                                   // 1b207..1b20c
  await F.PCX_Load_20806(0x301f3 /* "duster.pcx" */, 0x31ee4, 1);    // 1b211..1b220
  for (i = 0; i < 3; i++) {                                          // 1b225..1b238
    await F.Sprite_Init_20ce5((0x3d86c + i * 0x18c) | 0, 0x190, 0x6b, 0x48, 0x1c, 0, 0, 0, 0, 0, 0); // 1b23e..1b269
    for (j = 0; j < 4; j++) {                                        // 1b26e..1b281
      await F.PCX_Get_Sprite_20c12(0x31ee4, (0x3d86c + i * 0x18c) | 0, j, j, 0); // 1b283..1b29e
    }                                                                // 1b2a3 jmp
    W32((i * 0x18c + 0x3d87c) | 0, -3);                              // 1b2a5..1b2ac  +0x10 counter_1 (LIBRARY.md)
    W32((i * 0x18c + 0x3d9dc) | 0, 1);                               // 1b2b6..1b2bd  +0x170 state (LIBRARY.md)
    W32((i * 0x18c + 0x3d880) | 0, 4);                               // 1b2c7..1b2ce  +0x14 counter_2 (LIBRARY.md)
  }                                                                  // 1b2d8 jmp
  await F.PCX_Delete_20b69(0x31ee4);                                 // 1b2dd..1b2e2

  // ---- group 5: "plant.pcx" (0x301fe: 70 6c 61 6e 74 2e 70 63 78 00) -> sprites 0x3a878 + i*0x18c, i<0x1a
  await F.PCX_Init_207a0(0x31ee4);                                   // 1b2e7..1b2ec
  await F.PCX_Load_20806(0x301fe /* "plant.pcx" */, 0x31ee4, 1);     // 1b2f1..1b300
  for (i = 0; i < 0x1a; i++) {                                       // 1b305..1b318
    // 1b31e..1b348: EDX = i*0xc (x), EBX = 0x96, ECX = 0x13, pushed h = 0x1a
    await F.Sprite_Init_20ce5((0x3a878 + i * 0x18c) | 0, (i * 0xc) | 0, 0x96, 0x13, 0x1a, 0, 0, 0, 0, 0, 0);
    for (j = 0; j < 8; j++) {                                        // 1b34d..1b360
      await F.PCX_Get_Sprite_20c12(0x31ee4, (0x3a878 + i * 0x18c) | 0, j, j, 0); // 1b362..1b37d
    }                                                                // 1b382 jmp
    W32((i * 0x18c + 0x3a9e8) | 0, 1);                               // 1b384..1b38b  +0x170 state (LIBRARY.md)
  }                                                                  // 1b395 jmp
  await F.PCX_Delete_20b69(0x31ee4);                                 // 1b39a..1b39f

  // ---- group 6: "cloud.pcx" (0x30208: 63 6c 6f 75 64 2e 70 63 78 00) -> sprites 0x3de9c + i*0x18c and
  //      0x46218 + i*0x18c, i<0x3f
  await F.PCX_Init_207a0(0x31ee4);                                   // 1b3a4..1b3a9
  await F.PCX_Load_20806(0x30208 /* "cloud.pcx" */, 0x31ee4, 1);     // 1b3ae..1b3bd
  for (i = 0; i < 0x3f; i++) {                                       // 1b3c2..1b3d5
    await F.Sprite_Init_20ce5((0x3de9c + i * 0x18c) | 0, -200, -200, 0xd, 9, 0, 0, 0, 0, 0, 0); // 1b3db..1b406
    for (j = 0; j < 1; j++) {                                        // 1b40b..1b41e
      await F.PCX_Get_Sprite_20c12(0x31ee4, (0x3de9c + i * 0x18c) | 0, j, j, 0); // 1b420..1b43b
    }                                                                // 1b440 jmp
    await F.Sprite_Init_20ce5((0x46218 + i * 0x18c) | 0, -200, -200, 0xd, 9, 0, 0, 0, 0, 0, 0); // 1b442..1b46d
    for (j = 0; j < 1; j++) {                                        // 1b472..1b485
      await F.PCX_Get_Sprite_20c12(0x31ee4, (0x46218 + i * 0x18c) | 0, j, (j + 1) | 0, 0); // 1b487..1b4a3 (inc ecx)
    }                                                                // 1b4a8 jmp
  }                                                                  // 1b4aa jmp
  await F.PCX_Delete_20b69(0x31ee4);                                 // 1b4af..1b4b4
}
