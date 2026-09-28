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
import { BULLETS_FIELD, SPRITE, a10Jets, bombs, bongSmoke, bullets, choppers, cropDusters, cruiseMissile, currentWeapon, doubleBuffer, dusterSpray, explosions, frameCounter10, groundTroops, gunSight, hasAutoGun, hasBong, hasMissileLauncher, jah, kills, killsDigits, level, levelDigits, levelEnding, levelTimer, missile, missileTarget, mouseButtons, nukeCloud, paratroopers, pcxScratch, plants, rasta, score, scoreDigits } from '../data.js';

export function startNewGame() {
  let i; // [ebp-8]

  // pcx_picture 0x31ee4 (LIBRARY.md), "back.pcx" (0x3048a: 62 61 63 6b 2e 70 63 78 00)
  F.PCX_Init_207a0(pcxScratch);                                            // 0x1cc3c..0x1cc41
  F.PCX_Load_20806(0x3048a /* "back.pcx" */, pcxScratch, 1);               // 0x1cc46..0x1cc55
  F.PCX_Copy_To_Buffer_20bd7(pcxScratch, R32(doubleBuffer));                    // 0x1cc5a..0x1cc65
  F.PCX_Delete_20b69(pcxScratch);                                          // 0x1cc6a..0x1cc6f

  // Table at 0x5ff20, stride 0x30: +0 (x arg), +4 (y arg), +8 <- Read_Pixel_DB result.
  for (i = 0; i < 0x3c; i++) {                                                // 0x1cc74..0x1cc87, 0x1ccf0
    if (R32((bullets + BULLETS_FIELD.y) + i * 0x30) < 0) continue;                                // 0x1cc8d..0x1cc98 jl -> 0x1ccaa -> ... 0x1ccf0
    if (!(R32((bullets + BULLETS_FIELD.y) + i * 0x30) <= 0xc8)) continue;                         // 0x1cc9a..0x1cca8 jle, else 0x1ccaa
    if (!(R32(bullets + i * 0x30) >= 0)) continue;                            // 0x1ccac..0x1ccb7 jge, else 0x1ccb9
    if (!(R32(bullets + i * 0x30) <= 0x140)) continue;                        // 0x1ccbb..0x1ccc9 jle, else 0x1cccb
    const y = R32((bullets + BULLETS_FIELD.y) + i * 0x30);                                        // 0x1cccd..0x1ccd1 edx
    const x = R32(bullets + i * 0x30);                                        // 0x1ccd7..0x1ccdb eax
    const r = F.Read_Pixel_DB_2225c(x, y);                              // 0x1cce1
    W32((bullets + BULLETS_FIELD.savedPixel) + i * 0x30, r);                                               // 0x1cce6..0x1ccea
  }

  F.Behind_Sprite_Clip_2106f(gunSight, R32(doubleBuffer));                    // 0x1ccf2..0x1ccfd
  F.Behind_Sprite_Clip_2106f(jah, R32(doubleBuffer));                    // 0x1cd02..0x1cd0d
  F.Squeeze_Mouse_230df(0, 0, 0, mouseButtons);                              // 0x1cd12..0x1cd1d
  F.Squeeze_Mouse_230df(2, 0, 0, 0);                                    // 0x1cd22..0x1cd2d

  W32((gunSight + SPRITE.currFrame), 0);                                                            // 0x1cd32
  W32(frameCounter10, 0);                                                            // 0x1cd3c
  W32(score, 0);                                                            // 0x1cd46
  W32(level, 1);                                                            // 0x1cd50
  W32(kills, 0);                                                            // 0x1cd5a
  W32((jah + SPRITE.threshold3), 0x42);                                                         // 0x1cd64
  W32((nukeCloud + SPRITE.state), 0);                                                            // 0x1cd6e
  W32((cruiseMissile + SPRITE.state), 0);                                                            // 0x1cd78
  W32((rasta + SPRITE.state), 1);                                                            // 0x1cd82
  W32(levelTimer, 0x438);                                                        // 0x1cd8c
  W32(currentWeapon, 0x36);                                                         // 0x1cd96
  W32(levelEnding, 0);                                                            // 0x1cda0
  W32(hasAutoGun, 0);                                                            // 0x1cdaa
  W32(hasMissileLauncher, 0);                                                            // 0x1cdb4
  W32(hasBong, 0);                                                            // 0x1cdbe

  for (i = 0; i < 0x1a; i++) {                                                // 0x1cdc8..0x1cddb, 0x1cdff
    W32((plants + SPRITE.state) + i * SPRITE.SIZE, 1);                                              // 0x1cddd..0x1cde4
    W32((plants + SPRITE.currFrame) + i * SPRITE.SIZE, 0);                                              // 0x1cdee..0x1cdf5
  }
  for (i = 0; i < 0x19; i++) {                                                // 0x1ce01..0x1ce14, 0x1ce38
    W32((paratroopers + SPRITE.state) + i * SPRITE.SIZE, 0);                                              // 0x1ce16..0x1ce1d
    W32((paratroopers + SPRITE.y) + i * SPRITE.SIZE, -0x46);                                          // 0x1ce27..0x1ce2e (0xffffffba)
  }
  for (i = 0; i < 0x19; i++) {                                                // 0x1ce3a..0x1ce4d, 0x1ce71
    W32((groundTroops + SPRITE.state) + i * SPRITE.SIZE, 0);                                              // 0x1ce4f..0x1ce56
    W32((groundTroops + SPRITE.y) + i * SPRITE.SIZE, -0x46);                                          // 0x1ce60..0x1ce67 (0xffffffba)
  }
  for (i = 0; i < 4; i++) {                                                   // 0x1ce73..0x1ce86, 0x1ce99
    W32((bombs + SPRITE.state) + i * SPRITE.SIZE, 0);                                              // 0x1ce88..0x1ce8f
  }
  for (i = 0; i < 1; i++) {                                                   // 0x1ce9b..0x1ceae, 0x1cec1
    W32((a10Jets + SPRITE.state) + i * SPRITE.SIZE, 0);                                              // 0x1ceb0..0x1ceb7
  }
  for (i = 0; i < 3; i++) {                                                   // 0x1cec3..0x1ced6, 0x1cee9
    W32((cropDusters + SPRITE.state) + i * SPRITE.SIZE, 0);                                              // 0x1ced8..0x1cedf
  }
  for (i = 0; i < 0x3f; i++) {                                                // 0x1ceeb..0x1cefe, 0x1cf11
    W32((dusterSpray + SPRITE.state) + i * SPRITE.SIZE, 0);                                              // 0x1cf00..0x1cf07
  }
  for (i = 0; i < 0xd; i++) {                                                 // 0x1cf13..0x1cf26, 0x1cf39
    W32((explosions + SPRITE.state) + i * SPRITE.SIZE, 0);                                              // 0x1cf28..0x1cf2f
  }
  for (i = 0; i < 0xc8; i++) {                                                // 0x1cf3b..0x1cf51, 0x1cf64
    W32((bongSmoke + SPRITE.state) + i * SPRITE.SIZE, 0);                                              // 0x1cf53..0x1cf5a
  }
  for (i = 0; i < 5; i++) {                                                   // 0x1cf66..0x1cf79, 0x1cf8c
    W32((choppers + SPRITE.state) + i * SPRITE.SIZE, 0);                                              // 0x1cf7b..0x1cf82
  }
  for (i = 0; i < 7; i++) {                                                   // 0x1cf8e..0x1cfa1, 0x1cfe3
    W32(scoreDigits + i * SPRITE.SIZE, ((i << 2) + 0x30) | 0);                          // 0x1cfa3..0x1cfb3 (shl edx,2; add edx,0x30)
    F.Behind_Sprite_Clip_2106f(scoreDigits + i * SPRITE.SIZE, R32(doubleBuffer));      // 0x1cfb9..0x1cfcd (ecx=0x44010; add eax,ecx)
    W32((scoreDigits + SPRITE.y) + i * SPRITE.SIZE, 3);                                              // 0x1cfd2..0x1cfd9
  }
  for (i = 0; i < 5; i++) {                                                   // 0x1cfe5..0x1cff8, 0x1d03a
    W32(killsDigits + i * SPRITE.SIZE, ((i << 2) + 0x65) | 0);                          // 0x1cffa..0x1d00a (shl edx,2; add edx,0x65)
    F.Behind_Sprite_Clip_2106f(killsDigits + i * SPRITE.SIZE, R32(doubleBuffer));      // 0x1d010..0x1d024 (ecx=0x44ae4; add eax,ecx)
    W32((killsDigits + SPRITE.y) + i * SPRITE.SIZE, 3);                                              // 0x1d029..0x1d030
  }
  for (i = 0; i < 3; i++) {                                                   // 0x1d03c..0x1d04f, 0x1d094
    W32(levelDigits + i * SPRITE.SIZE, ((i << 2) + 0xa7) | 0);                          // 0x1d051..0x1d064 (shl edx,2; add edx,0xa7)
    F.Behind_Sprite_Clip_2106f(levelDigits + i * SPRITE.SIZE, R32(doubleBuffer));      // 0x1d06a..0x1d07e (ecx=0x452a0; add eax,ecx)
    W32((levelDigits + SPRITE.y) + i * SPRITE.SIZE, 3);                                              // 0x1d083..0x1d08a
  }

  W32((missile + SPRITE.state), 0);                                                            // 0x1d096
  W32((missileTarget + SPRITE.state), 0);                                                            // 0x1d0a0
  W32(levelTimer, 0x438);                                                        // 0x1d0aa
}
