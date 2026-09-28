// Chunk L1 of main (0x1aa02): range [0x1cc3c, 0x1d0b4).
// Entry 0x1cc3c (loop B body start, after the 0x1cc2f test), single exit 0x1d0b4 (falls through to the
// loop C header 0x1d0b4, handled by the skeleton).
// No live registers/locals at either end (MAIN_PLAN.md §2). Straight line + 14 single-level counted loops,
// all on [ebp-8] with signed compares (jge).
// Callees: PCX_Init_207a0, PCX_Load_20806, PCX_Copy_To_Buffer_20bd7, PCX_Delete_20b69, Read_Pixel_DB_2225c,
// Behind_Sprite_Clip_2106f x5 call sites, Squeeze_Mouse_230df x2.
// Only Read_Pixel_DB's EAX result is used (stored at 0x1ccea); the other results are discarded.
// The `mov eax,[ebp-8]` before every `inc [ebp-8]` is a dead read and produces nothing.
import { F } from '../../runtime/registry.js';
import { R32, W32 } from '../../runtime/mem.js';

export function chunk_1cc3c() {
  let i; // [ebp-8]

  // pcx_picture 0x31ee4 (LIBRARY.md), "back.pcx" (0x3048a: 62 61 63 6b 2e 70 63 78 00)
  F.PCX_Init_207a0(0x31ee4);                                            // 0x1cc3c..0x1cc41
  F.PCX_Load_20806(0x3048a /* "back.pcx" */, 0x31ee4, 1);               // 0x1cc46..0x1cc55
  F.PCX_Copy_To_Buffer_20bd7(0x31ee4, R32(0x64e7c));                    // 0x1cc5a..0x1cc65
  F.PCX_Delete_20b69(0x31ee4);                                          // 0x1cc6a..0x1cc6f

  // Table at 0x5ff20, stride 0x30: +0 (x arg), +4 (y arg), +8 <- Read_Pixel_DB result.
  for (i = 0; i < 0x3c; i++) {                                                // 0x1cc74..0x1cc87, 0x1ccf0
    if (R32(0x5ff24 + i * 0x30) < 0) continue;                                // 0x1cc8d..0x1cc98 jl -> 0x1ccaa -> ... 0x1ccf0
    if (!(R32(0x5ff24 + i * 0x30) <= 0xc8)) continue;                         // 0x1cc9a..0x1cca8 jle, else 0x1ccaa
    if (!(R32(0x5ff20 + i * 0x30) >= 0)) continue;                            // 0x1ccac..0x1ccb7 jge, else 0x1ccb9
    if (!(R32(0x5ff20 + i * 0x30) <= 0x140)) continue;                        // 0x1ccbb..0x1ccc9 jle, else 0x1cccb
    const y = R32(0x5ff24 + i * 0x30);                                        // 0x1cccd..0x1ccd1 edx
    const x = R32(0x5ff20 + i * 0x30);                                        // 0x1ccd7..0x1ccdb eax
    const r = F.Read_Pixel_DB_2225c(x, y);                              // 0x1cce1
    W32(0x5ff28 + i * 0x30, r);                                               // 0x1cce6..0x1ccea
  }

  F.Behind_Sprite_Clip_2106f(0x33aa4, R32(0x64e7c));                    // 0x1ccf2..0x1ccfd
  F.Behind_Sprite_Clip_2106f(0x45d74, R32(0x64e7c));                    // 0x1cd02..0x1cd0d
  F.Squeeze_Mouse_230df(0, 0, 0, 0x60b50);                              // 0x1cd12..0x1cd1d
  F.Squeeze_Mouse_230df(2, 0, 0, 0);                                    // 0x1cd22..0x1cd2d

  W32(0x33c0c, 0);                                                            // 0x1cd32
  W32(0x60b54, 0);                                                            // 0x1cd3c
  W32(0x60a68, 0);                                                            // 0x1cd46
  W32(0x30bec, 1);                                                            // 0x1cd50
  W32(0x60a6c, 0);                                                            // 0x1cd5a
  W32(0x45d98, 0x42);                                                         // 0x1cd64
  W32(0x5ff00, 0);                                                            // 0x1cd6e
  W32(0x5fd74, 0);                                                            // 0x1cd78
  W32(0x33f2c, 1);                                                            // 0x1cd82
  W32(0x30bf0, 0x438);                                                        // 0x1cd8c
  W32(0x60ee8, 0x36);                                                         // 0x1cd96
  W32(0x60bbc, 0);                                                            // 0x1cda0
  W32(0x60bb0, 0);                                                            // 0x1cdaa
  W32(0x60bb4, 0);                                                            // 0x1cdb4
  W32(0x60bb8, 0);                                                            // 0x1cdbe

  for (i = 0; i < 0x1a; i++) {                                                // 0x1cdc8..0x1cddb, 0x1cdff
    W32(0x3a9e8 + i * 0x18c, 1);                                              // 0x1cddd..0x1cde4
    W32(0x3a9e0 + i * 0x18c, 0);                                              // 0x1cdee..0x1cdf5
  }
  for (i = 0; i < 0x19; i++) {                                                // 0x1ce01..0x1ce14, 0x1ce38
    W32(0x35c90 + i * 0x18c, 0);                                              // 0x1ce16..0x1ce1d
    W32(0x35b24 + i * 0x18c, -0x46);                                          // 0x1ce27..0x1ce2e (0xffffffba)
  }
  for (i = 0; i < 0x19; i++) {                                                // 0x1ce3a..0x1ce4d, 0x1ce71
    W32(0x3833c + i * 0x18c, 0);                                              // 0x1ce4f..0x1ce56
    W32(0x381d0 + i * 0x18c, -0x46);                                          // 0x1ce60..0x1ce67 (0xffffffba)
  }
  for (i = 0; i < 4; i++) {                                                   // 0x1ce73..0x1ce86, 0x1ce99
    W32(0x3d3ac + i * 0x18c, 0);                                              // 0x1ce88..0x1ce8f
  }
  for (i = 0; i < 1; i++) {                                                   // 0x1ce9b..0x1ceae, 0x1cec1
    W32(0x3d220 + i * 0x18c, 0);                                              // 0x1ceb0..0x1ceb7
  }
  for (i = 0; i < 3; i++) {                                                   // 0x1cec3..0x1ced6, 0x1cee9
    W32(0x3d9dc + i * 0x18c, 0);                                              // 0x1ced8..0x1cedf
  }
  for (i = 0; i < 0x3f; i++) {                                                // 0x1ceeb..0x1cefe, 0x1cf11
    W32(0x3e00c + i * 0x18c, 0);                                              // 0x1cf00..0x1cf07
  }
  for (i = 0; i < 0xd; i++) {                                                 // 0x1cf13..0x1cf26, 0x1cf39
    W32(0x34874 + i * 0x18c, 0);                                              // 0x1cf28..0x1cf2f
  }
  for (i = 0; i < 0xc8; i++) {                                                // 0x1cf3b..0x1cf51, 0x1cf64
    W32(0x4c688 + i * 0x18c, 0);                                              // 0x1cf53..0x1cf5a
  }
  for (i = 0; i < 5; i++) {                                                   // 0x1cf66..0x1cf79, 0x1cf8c
    W32(0x340b8 + i * 0x18c, 0);                                              // 0x1cf7b..0x1cf82
  }
  for (i = 0; i < 7; i++) {                                                   // 0x1cf8e..0x1cfa1, 0x1cfe3
    W32(0x44010 + i * 0x18c, ((i << 2) + 0x30) | 0);                          // 0x1cfa3..0x1cfb3 (shl edx,2; add edx,0x30)
    F.Behind_Sprite_Clip_2106f(0x44010 + i * 0x18c, R32(0x64e7c));      // 0x1cfb9..0x1cfcd (ecx=0x44010; add eax,ecx)
    W32(0x44014 + i * 0x18c, 3);                                              // 0x1cfd2..0x1cfd9
  }
  for (i = 0; i < 5; i++) {                                                   // 0x1cfe5..0x1cff8, 0x1d03a
    W32(0x44ae4 + i * 0x18c, ((i << 2) + 0x65) | 0);                          // 0x1cffa..0x1d00a (shl edx,2; add edx,0x65)
    F.Behind_Sprite_Clip_2106f(0x44ae4 + i * 0x18c, R32(0x64e7c));      // 0x1d010..0x1d024 (ecx=0x44ae4; add eax,ecx)
    W32(0x44ae8 + i * 0x18c, 3);                                              // 0x1d029..0x1d030
  }
  for (i = 0; i < 3; i++) {                                                   // 0x1d03c..0x1d04f, 0x1d094
    W32(0x452a0 + i * 0x18c, ((i << 2) + 0xa7) | 0);                          // 0x1d051..0x1d064 (shl edx,2; add edx,0xa7)
    F.Behind_Sprite_Clip_2106f(0x452a0 + i * 0x18c, R32(0x64e7c));      // 0x1d06a..0x1d07e (ecx=0x452a0; add eax,ecx)
    W32(0x452a4 + i * 0x18c, 3);                                              // 0x1d083..0x1d08a
  }

  W32(0x46070, 0);                                                            // 0x1d096
  W32(0x461fc, 0);                                                            // 0x1d0a0
  W32(0x30bf0, 0x438);                                                        // 0x1d0aa
}
