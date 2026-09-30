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
import { A10_JET, BOMB, BONG_SMOKE, CHOPPER, CROP_DUSTER, CRUISE_MISSILE, DUSTER_SPRAY, EXPLOSION, GROUND_TROOP, MISSILE, MISSILE_TARGET, NUKE_CLOUD, PARATROOPER, PLANT, RASTA, WEAPON } from '../states.js';
import { a10Jets, bombs, bongSmoke, choppers, cropDusters, cruiseMissile, dusterSpray, explosions, groundTroops, gunSight, jah, killsDigits, levelDigits, missile, missileTarget, mouseButtons, nukeCloud, paratroopers, pcxScratch, plants, rasta, scoreDigits } from '../data.js';
import { G, bullet, sprite } from '../access.js';

export function startNewGame() {
  let i; // [ebp-8]

  // pcx_picture 0x31ee4 (LIBRARY.md), "back.pcx" (0x3048a: 62 61 63 6b 2e 70 63 78 00)
  F.PCX_Init_207a0(pcxScratch);                                            // 0x1cc3c..0x1cc41
  F.PCX_Load_20806(0x3048a /* "back.pcx" */, pcxScratch, 1);               // 0x1cc46..0x1cc55
  F.PCX_Copy_To_Buffer_20bd7(pcxScratch, G.doubleBuffer);                    // 0x1cc5a..0x1cc65
  F.PCX_Delete_20b69(pcxScratch);                                          // 0x1cc6a..0x1cc6f

  // Table at 0x5ff20, stride 0x30: +0 (x arg), +4 (y arg), +8 <- Read_Pixel_DB result.
  for (i = 0; i < 0x3c; i++) {                                                // 0x1cc74..0x1cc87, 0x1ccf0
    if (bullet(i).y < 0) continue;                                // 0x1cc8d..0x1cc98 jl -> 0x1ccaa -> ... 0x1ccf0
    if (!(bullet(i).y <= 0xc8)) continue;                         // 0x1cc9a..0x1cca8 jle, else 0x1ccaa
    if (!(bullet(i).x >= 0)) continue;                            // 0x1ccac..0x1ccb7 jge, else 0x1ccb9
    if (!(bullet(i).x <= 0x140)) continue;                        // 0x1ccbb..0x1ccc9 jle, else 0x1cccb
    const y = bullet(i).y;                                        // 0x1cccd..0x1ccd1 edx
    const x = bullet(i).x;                                        // 0x1ccd7..0x1ccdb eax
    const r = F.Read_Pixel_DB_2225c(x, y);                              // 0x1cce1
    bullet(i).savedPixel = r;                                               // 0x1cce6..0x1ccea
  }

  F.Behind_Sprite_Clip_2106f(gunSight, G.doubleBuffer);                    // 0x1ccf2..0x1ccfd
  F.Behind_Sprite_Clip_2106f(jah, G.doubleBuffer);                    // 0x1cd02..0x1cd0d
  F.Squeeze_Mouse_230df(0, 0, 0, mouseButtons);                              // 0x1cd12..0x1cd1d
  F.Squeeze_Mouse_230df(2, 0, 0, 0);                                    // 0x1cd22..0x1cd2d

  sprite(gunSight).currFrame = 0;                                                            // 0x1cd32
  G.frameCounter10 = 0;                                                            // 0x1cd3c
  G.score = 0;                                                            // 0x1cd46
  G.level = 1;                                                            // 0x1cd50
  G.kills = 0;                                                            // 0x1cd5a
  sprite(jah).threshold3 = 0x42;                                                         // 0x1cd64
  sprite(nukeCloud).state = NUKE_CLOUD.HIDDEN;                                                            // 0x1cd6e
  sprite(cruiseMissile).state = CRUISE_MISSILE.INACTIVE;                                                            // 0x1cd78
  sprite(rasta).state = RASTA.AIMING;                                                            // 0x1cd82
  G.levelTimer = 0x438;                                                        // 0x1cd8c
  G.currentWeapon = WEAPON.DEFAULT_GUN;                                                         // 0x1cd96
  G.levelEnding = 0;                                                            // 0x1cda0
  G.hasAutoGun = 0;                                                            // 0x1cdaa
  G.hasMissileLauncher = 0;                                                            // 0x1cdb4
  G.hasBong = 0;                                                            // 0x1cdbe

  for (i = 0; i < 0x1a; i++) {                                                // 0x1cdc8..0x1cddb, 0x1cdff
    sprite(plants, i).state = PLANT.ALIVE;                                              // 0x1cddd..0x1cde4
    sprite(plants, i).currFrame = 0;                                              // 0x1cdee..0x1cdf5
  }
  for (i = 0; i < 0x19; i++) {                                                // 0x1ce01..0x1ce14, 0x1ce38
    sprite(paratroopers, i).state = PARATROOPER.INACTIVE;                                              // 0x1ce16..0x1ce1d
    sprite(paratroopers, i).y = -0x46;                                          // 0x1ce27..0x1ce2e (0xffffffba)
  }
  for (i = 0; i < 0x19; i++) {                                                // 0x1ce3a..0x1ce4d, 0x1ce71
    sprite(groundTroops, i).state = GROUND_TROOP.INACTIVE;                                              // 0x1ce4f..0x1ce56
    sprite(groundTroops, i).y = -0x46;                                          // 0x1ce60..0x1ce67 (0xffffffba)
  }
  for (i = 0; i < 4; i++) {                                                   // 0x1ce73..0x1ce86, 0x1ce99
    sprite(bombs, i).state = BOMB.INACTIVE;                                              // 0x1ce88..0x1ce8f
  }
  for (i = 0; i < 1; i++) {                                                   // 0x1ce9b..0x1ceae, 0x1cec1
    sprite(a10Jets, i).state = A10_JET.INACTIVE;                                              // 0x1ceb0..0x1ceb7
  }
  for (i = 0; i < 3; i++) {                                                   // 0x1cec3..0x1ced6, 0x1cee9
    sprite(cropDusters, i).state = CROP_DUSTER.INACTIVE;                                              // 0x1ced8..0x1cedf
  }
  for (i = 0; i < 0x3f; i++) {                                                // 0x1ceeb..0x1cefe, 0x1cf11
    sprite(dusterSpray, i).state = DUSTER_SPRAY.INACTIVE;                                              // 0x1cf00..0x1cf07
  }
  for (i = 0; i < 0xd; i++) {                                                 // 0x1cf13..0x1cf26, 0x1cf39
    sprite(explosions, i).state = EXPLOSION.IDLE;                                              // 0x1cf28..0x1cf2f
  }
  for (i = 0; i < 0xc8; i++) {                                                // 0x1cf3b..0x1cf51, 0x1cf64
    sprite(bongSmoke, i).state = BONG_SMOKE.INACTIVE;                                              // 0x1cf53..0x1cf5a
  }
  for (i = 0; i < 5; i++) {                                                   // 0x1cf66..0x1cf79, 0x1cf8c
    sprite(choppers, i).state = CHOPPER.INACTIVE;                                              // 0x1cf7b..0x1cf82
  }
  for (i = 0; i < 7; i++) {                                                   // 0x1cf8e..0x1cfa1, 0x1cfe3
    sprite(scoreDigits, i).x = ((i << 2) + 0x30) | 0;                          // 0x1cfa3..0x1cfb3 (shl edx,2; add edx,0x30)
    F.Behind_Sprite_Clip_2106f(sprite(scoreDigits, i).addr, G.doubleBuffer);      // 0x1cfb9..0x1cfcd (ecx=0x44010; add eax,ecx)
    sprite(scoreDigits, i).y = 3;                                              // 0x1cfd2..0x1cfd9
  }
  for (i = 0; i < 5; i++) {                                                   // 0x1cfe5..0x1cff8, 0x1d03a
    sprite(killsDigits, i).x = ((i << 2) + 0x65) | 0;                          // 0x1cffa..0x1d00a (shl edx,2; add edx,0x65)
    F.Behind_Sprite_Clip_2106f(sprite(killsDigits, i).addr, G.doubleBuffer);      // 0x1d010..0x1d024 (ecx=0x44ae4; add eax,ecx)
    sprite(killsDigits, i).y = 3;                                              // 0x1d029..0x1d030
  }
  for (i = 0; i < 3; i++) {                                                   // 0x1d03c..0x1d04f, 0x1d094
    sprite(levelDigits, i).x = ((i << 2) + 0xa7) | 0;                          // 0x1d051..0x1d064 (shl edx,2; add edx,0xa7)
    F.Behind_Sprite_Clip_2106f(sprite(levelDigits, i).addr, G.doubleBuffer);      // 0x1d06a..0x1d07e (ecx=0x452a0; add eax,ecx)
    sprite(levelDigits, i).y = 3;                                              // 0x1d083..0x1d08a
  }

  sprite(missile).state = MISSILE.INACTIVE;                                                            // 0x1d096
  sprite(missileTarget).state = MISSILE_TARGET.INACTIVE;                                                            // 0x1d0a0
  G.levelTimer = 0x438;                                                        // 0x1d0aa
}
