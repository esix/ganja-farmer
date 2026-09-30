// 0x136a5  void updateParatroopers(void)   [Watcom, no args, no return value]
// Args: none (signatures.json regs=0/stack=0; EAX/EDX/ECX are written before any read; EBX..EDI saved/restored).
// Return: none. EAX at the RET (0x14424) is a leftover (last `imul eax,[ebp-0x18],0x18c` or the loop's
// `mov eax,[ebp-0x18]`); the only caller (0x1d649) is followed by `call 0x135bb` (regs=0, no reads).
// Arrays (evidence: main 0x1aa02 Sprite_Inits them, e.g. 0x1ae0c / 0x1af9e / 0x1b341; stride 0x18c = sprite,
// field names from LIBRARY.md "sprite"):
//   A = 0x35b20: 25 sprites, frames from "ptroop.pcx" (0x301c8)
//   B = 0x381cc: 25 sprites, frames from "pt2.pcx" (0x301d3)
//   P = 0x3a878: 26 sprites, frames from "plant.pcx" (0x301fe)
//   Q = 0x5ff20: 60 entries of stride 0x30 (fields +0, +4, +0xc used here; meaning not established)
// For i = 0..24 advances A[i] / B[i] through their state values (see the per-block comments), with
// hit tests against Q[j] (j = 0..59), A[k]/B[k] (k = 0..24) and P[j] (j = 0..25); plays sounds via
// dws_DDiscard/dws_DPlay on the dws_DPLAY structs at 0x612a0/0x612c0/0x612e0/0x61320/0x61340
// (DDiscard gets the struct's +0xa WORD soundnum, LIBRARY.md dws_DPLAY); adds to [0x60a68] and [0x60a6c].
// Facts noted (not claimed to be bugs, the binary does exactly this):
//  - 0x13c89 / 0x13d0d: the k-loop hit tests add the WIDTH of element i (A[i].width / B[i].width), not of k.
//  - [ebp-4] (min distance, 1000) is initialized once at 0x136c4, before the i-loop, and never reset.
//  - 0x142b8: the "P[j].x <= B[i].x" branch writes B[i].counter_1 (+0x10), while the other branch writes
//    +0x18 (counter_3); +0x18 is what the state 0x2f block reads (0x14032 / 0x1409b).
// All locals are plain (no address taken; every one is written before it is read).
import { F, register } from '../runtime/registry.js';
import { R16, R32, W32 } from '../runtime/mem.js';
import { imod } from '../runtime/cpu.js';
import { GROUND_TROOP, PARATROOPER, PLANT } from './states.js';
import { BULLETS_FIELD, SPRITE, bullets, explosionDelays, groundTroops, paratroopers, plants, sndParaDie1, sndParaDie2, sndParaDie3, sndParaDie5, sndParaSquish } from './data.js';
import { G, dplay, sprite } from './access.js';

register(0x136a5, 'updateParatroopers_136a5', function updateParatroopers() {
  let i;        // [ebp-0x18]
  let k;        // [ebp-0x14]
  let j;        // [ebp-0x10]
  let r;        // [ebp-0xc]
  let d;        // [ebp-8]
  let best;     // [ebp-4]
  let t;        // ECX at 0x13c17
  const S = (n) => Math.imul(n, SPRITE.SIZE);
  const Qo = (n) => Math.imul(n, 0x30);

  r = 0;                                                        // 0x136bd
  best = 0x3e8;                                                 // 0x136c4
  for (i = 0; i < 0x19; i++) {                                  // 0x136cb..0x136de (jge: signed)
    // 0x136e4: A[i].counter_1 (+0x10) ++; > 3 ?
    sprite(paratroopers, i).counter1 = (sprite(paratroopers, i).counter1 + 1) | 0;
    if (sprite(paratroopers, i).counter1 > 3) {
      // 0x136fe: state (+0x170) == 0x1c
      if (sprite(paratroopers, i).state === PARATROOPER.DESCENDING_SWING_FORWARD) {
        sprite(paratroopers, i).currFrame = (sprite(paratroopers, i).currFrame + 1) | 0;     // 0x13719 curr_frame++
        if (sprite(paratroopers, i).currFrame > 4) {
          sprite(paratroopers, i).state = PARATROOPER.DESCENDING_SWING_BACK;                            // 0x1372f
        }
        sprite(paratroopers, i).y = (sprite(paratroopers, i).y + 1) | 0;     // 0x13740 y++
        if (sprite(paratroopers, i).y > 0x96) {
          sprite(paratroopers, i).y = 0x96;                            // 0x13760
          sprite(paratroopers, i).state = PARATROOPER.LANDING;                            // 0x13771
          sprite(paratroopers, i).currFrame = 0xc;                             // 0x13782
        }
      }
      // 0x1378c: state == 0x1b
      if (sprite(paratroopers, i).state === PARATROOPER.DESCENDING_SWING_BACK) {
        sprite(paratroopers, i).currFrame = (sprite(paratroopers, i).currFrame - 1) | 0;     // 0x137a7 curr_frame--
        if (sprite(paratroopers, i).currFrame < 0) {
          sprite(paratroopers, i).state = PARATROOPER.DESCENDING_SWING_FORWARD;                            // 0x137bd
          sprite(paratroopers, i).currFrame = 0;                               // 0x137ce
        }
        sprite(paratroopers, i).y = (sprite(paratroopers, i).y + 1) | 0;     // 0x137df
        if (sprite(paratroopers, i).y > 0x96) {
          sprite(paratroopers, i).y = 0x96;                            // 0x137ff
          sprite(paratroopers, i).state = PARATROOPER.LANDING;                            // 0x13810
          sprite(paratroopers, i).currFrame = 0xc;                             // 0x13821
        }
      }
      // 0x1382b: state == 0x27
      if (sprite(paratroopers, i).state === PARATROOPER.LANDING) {
        sprite(paratroopers, i).currFrame = (sprite(paratroopers, i).currFrame + 1) | 0;     // 0x13842
        if (sprite(paratroopers, i).currFrame > 0x12) {
          sprite(paratroopers, i).state = PARATROOPER.LANDED;                            // 0x13858
        }
      }
    }

    // 0x13862: A[i].state != 0 -> test Q[0..59]
    if (sprite(paratroopers, i).state !== PARATROOPER.INACTIVE) {
      for (j = 0; j < 0x3c; j++) {                              // 0x13876..0x13889
        // 0x1388f..0x13938
        if (R32((bullets + BULLETS_FIELD.active) + Qo(j)) === 1 &&
            R32(bullets + Qo(j)) > sprite(paratroopers, i).x &&
            ((sprite(paratroopers, i).x + sprite(paratroopers, i).width) | 0) > R32(bullets + Qo(j)) &&
            R32((bullets + BULLETS_FIELD.y) + Qo(j)) > sprite(paratroopers, i).y &&
            ((sprite(paratroopers, i).y + 0x11) | 0) > R32((bullets + BULLETS_FIELD.y) + Qo(j)) &&
            (sprite(paratroopers, i).state === PARATROOPER.DESCENDING_SWING_FORWARD || sprite(paratroopers, i).state === PARATROOPER.DESCENDING_SWING_BACK)) {
          sprite(paratroopers, i).state = PARATROOPER.CHUTE_SHOT_FALLING;                            // 0x13941
          sprite(paratroopers, i).counter2 = 0;                               // 0x13952 counter_2 (+0x14)
          sprite(paratroopers, i).currFrame = 5;                               // 0x13963
          r = imod(F.rand_232c7(), 3);                    // 0x13974..0x13987
          F.dws_DDiscard_1f770(dplay(sndParaDie1).soundnum);             // 0x1398a
          F.dws_DDiscard_1f770(dplay(sndParaDie2).soundnum);             // 0x1399c
          F.dws_DDiscard_1f770(dplay(sndParaDie3).soundnum);             // 0x139ae
          if (r === 0) {
            F.dws_DPlay_1eff8(sndParaDie1);                   // 0x139c6
          }
          if (r === 1) {
            F.dws_DPlay_1eff8(sndParaDie2);                   // 0x139da
          }
          if (r === 2) {
            F.dws_DPlay_1eff8(sndParaDie3);                   // 0x139ee
          }
          W32((bullets + BULLETS_FIELD.active) + Qo(j), 0);                              // 0x139fc
          G.score = (G.score + 0xf) | 0;               // 0x13a0a
          G.kills = (G.kills + 1) | 0;                 // 0x13a11
        }
        // 0x13a17..0x13acf
        if (R32((bullets + BULLETS_FIELD.active) + Qo(j)) === 1 &&
            R32(bullets + Qo(j)) > sprite(paratroopers, i).x &&
            ((sprite(paratroopers, i).x + sprite(paratroopers, i).width) | 0) > R32(bullets + Qo(j)) &&
            ((sprite(paratroopers, i).y + 0x11) | 0) < R32((bullets + BULLETS_FIELD.y) + Qo(j)) &&
            ((sprite(paratroopers, i).y + sprite(paratroopers, i).height) | 0) > R32((bullets + BULLETS_FIELD.y) + Qo(j)) &&
            (sprite(paratroopers, i).state === PARATROOPER.DESCENDING_SWING_FORWARD || sprite(paratroopers, i).state === PARATROOPER.DESCENDING_SWING_BACK)) {
          if (imod(F.rand_232c7(), 10) === 1) {           // 0x13ad8..0x13aee
            if (sprite(paratroopers, i).x > 0xa0) {                   // 0x13af0 (jle)
              sprite(paratroopers, i).state = PARATROOPER.SHOT_FALLING_RIGHT;                           // 0x13b03
            } else {
              sprite(paratroopers, i).state = PARATROOPER.SHOT_FALLING_LEFT;                           // 0x13b16
            }
            sprite(paratroopers, i).currFrame = (imod(F.rand_232c7(), 3) + 0x13) | 0;  // 0x13b27..0x13b44
          } else {
            sprite(paratroopers, i).state = PARATROOPER.SHOT_DYING;                             // 0x13b4c
            sprite(paratroopers, i).currFrame = 0x15;                          // 0x13b5d
          }
          F.dws_DDiscard_1f770(dplay(sndParaDie5).soundnum);             // 0x13b6e
          F.dws_DPlay_1eff8(sndParaDie5);                     // 0x13b7f
          W32((bullets + BULLETS_FIELD.active) + Qo(j), 0);                              // 0x13b8d
          G.score = (G.score + 0xb) | 0;               // 0x13b9b
          G.kills = (G.kills + 1) | 0;                 // 0x13ba2
        }
      }
    }

    // 0x13bad: A[i].state == 0x21
    if (sprite(paratroopers, i).state === PARATROOPER.CHUTE_SHOT_FALLING) {
      sprite(paratroopers, i).currFrame = (sprite(paratroopers, i).currFrame + 1) | 0;       // 0x13bc1
      if (sprite(paratroopers, i).currFrame > 0xa) {
        sprite(paratroopers, i).currFrame = 6;                                 // 0x13bd7
      }
      if (sprite(paratroopers, i).counter2 > 5) {                            // 0x13be8
        sprite(paratroopers, i).counter2 = 5;                                 // 0x13bf8
      }
      t = sprite(paratroopers, i).counter2;                                  // 0x13c17 mov ecx
      sprite(paratroopers, i).counter2 = (sprite(paratroopers, i).counter2 + 1) | 0;       // 0x13c1d
      sprite(paratroopers, i).y = (sprite(paratroopers, i).y + t) | 0;       // 0x13c23 y += old counter_2
      if (sprite(paratroopers, i).y > 0x97) {                         // 0x13c29
        for (k = 0; k < 0x19; k++) {                            // 0x13c40..0x13c53
          // 0x13c59..0x13cb0 (width of A[i], 0x13c89)
          if (sprite(paratroopers, i).x > sprite(paratroopers, k).x &&
              ((sprite(paratroopers, k).x + sprite(paratroopers, i).width) | 0) > sprite(paratroopers, i).x &&
              sprite(paratroopers, k).state === PARATROOPER.LANDING) {
            sprite(paratroopers, k).state = PARATROOPER.INACTIVE;                             // 0x13cb4
            sprite(paratroopers, k).currFrame = 0xb;                           // 0x13cc5
            G.score = (G.score + 0x64) | 0;            // 0x13cd6
          }
          // 0x13cdd..0x13d68 (width of B[i], 0x13d0d)
          if (sprite(paratroopers, i).x > sprite(groundTroops, k).x &&
              ((sprite(groundTroops, k).x + sprite(groundTroops, i).width) | 0) > sprite(paratroopers, i).x &&
              (sprite(groundTroops, k).state === GROUND_TROOP.WALKING_TO_PLANT || sprite(groundTroops, k).state === GROUND_TROOP.RUNNING_AWAY_RIGHT ||
               sprite(groundTroops, k).state === GROUND_TROOP.RUNNING_AWAY_LEFT || sprite(groundTroops, k).state === GROUND_TROOP.PLANTING_CHARGE)) {
            sprite(groundTroops, k).state = GROUND_TROOP.INACTIVE;                             // 0x13d6e
            sprite(groundTroops, k).y = -0x46;                         // 0x13d7f (0xffffffba)
            G.score = (G.score + 0x64) | 0;            // 0x13d90
          }
        }
        sprite(paratroopers, i).state = PARATROOPER.INACTIVE;                                 // 0x13d9c
        F.dws_DDiscard_1f770(dplay(sndParaSquish).soundnum);               // 0x13dad
        F.dws_DPlay_1eff8(sndParaSquish);                       // 0x13dbe
        sprite(paratroopers, i).currFrame = 0xb;                               // 0x13dcc
      }
    }

    // 0x13ddd: B[i].state == 0x2e
    if (sprite(groundTroops, i).state === GROUND_TROOP.RUNNING_AWAY_RIGHT) {
      sprite(groundTroops, i).currFrame = (sprite(groundTroops, i).currFrame + 1) | 0;       // 0x13df4
      if (sprite(groundTroops, i).currFrame > 3) {
        sprite(groundTroops, i).currFrame = 0;                                 // 0x13e03
      }
      sprite(groundTroops, i).x = (sprite(groundTroops, i).x + 4) | 0;       // 0x13e14
      if (sprite(groundTroops, i).x > 0x140) {
        sprite(groundTroops, i).state = GROUND_TROOP.INACTIVE;                                 // 0x13e35
      }
    }
    // 0x13e46: B[i].state == 0x31
    if (sprite(groundTroops, i).state === GROUND_TROOP.RUNNING_AWAY_LEFT) {
      sprite(groundTroops, i).currFrame = (sprite(groundTroops, i).currFrame + 1) | 0;       // 0x13e5d
      if (sprite(groundTroops, i).currFrame > 0x10) {
        sprite(groundTroops, i).currFrame = 0xd;                               // 0x13e6c
      }
      sprite(groundTroops, i).x = (sprite(groundTroops, i).x - 4) | 0;       // 0x13e7d
      if (sprite(groundTroops, i).x < -0x1e) {                        // jge
        sprite(groundTroops, i).state = GROUND_TROOP.INACTIVE;                                 // 0x13e9b
      }
    }
    // 0x13eac: B[i].state == 0x30
    if (sprite(groundTroops, i).state === GROUND_TROOP.PLANTING_CHARGE) {
      sprite(groundTroops, i).currFrame = (sprite(groundTroops, i).currFrame + 1) | 0;       // 0x13ec7
      if (sprite(groundTroops, i).currFrame > 0xc) {
        if (sprite(groundTroops, i).x > 0xa0) {                       // 0x13eda (jle)
          sprite(groundTroops, i).state = GROUND_TROOP.RUNNING_AWAY_RIGHT;                            // 0x13eed
          sprite(groundTroops, i).currFrame = 0;                               // 0x13efe
        } else {
          sprite(groundTroops, i).state = GROUND_TROOP.RUNNING_AWAY_LEFT;                            // 0x13f11
          sprite(groundTroops, i).currFrame = 0xd;                             // 0x13f22
        }
        for (j = 0; j < 0x1a; j++) {                            // 0x13f33..0x13f46
          // 0x13f4c..0x13fae
          if (sprite(plants, j).state === PLANT.ALIVE &&
              ((sprite(groundTroops, i).x - 4) | 0) < sprite(plants, j).x &&
              ((sprite(plants, j).x + 0xc) | 0) <
                ((((sprite(groundTroops, i).x + sprite(groundTroops, i).width) | 0) + 4) | 0)) {
            sprite(plants, j).state = PLANT.CHARGE_PLANTED;                          // 0x13fb2 P[j].state
            sprite(plants, j).counter2 = 0x24;                          // 0x13fc3 P[j].counter_2 (+0x14)
            G.explosionX = sprite(groundTroops, i).x;                  // 0x13fd4
            G.explosionY = (sprite(groundTroops, i).y - 0x16) | 0;     // 0x13fe6
            F.spawnExplosion_1352c();                                // 0x13ffb
            W32((G.explosionNext << 2) + explosionDelays, 0xc);            // 0x14000..0x14008
          }
        }
      }
    }
    // 0x14017: B[i].state == 0x2f
    if (sprite(groundTroops, i).state === GROUND_TROOP.WALKING_TO_PLANT) {
      if (sprite(groundTroops, i).counter3 === 1) {                          // 0x1402b counter_3 (+0x18)
        sprite(groundTroops, i).currFrame = (sprite(groundTroops, i).currFrame + 1) | 0;     // 0x14042
        if (sprite(groundTroops, i).currFrame > 3) {
          sprite(groundTroops, i).currFrame = 0;                               // 0x14051
        }
        sprite(groundTroops, i).x = (sprite(groundTroops, i).x + 2) | 0;     // 0x14062
        if (sprite(groundTroops, i).x > 0x140) {
          sprite(groundTroops, i).state = GROUND_TROOP.INACTIVE;                               // 0x14083
        }
      }
      if (sprite(groundTroops, i).counter3 === 0) {                          // 0x14094
        sprite(groundTroops, i).currFrame = (sprite(groundTroops, i).currFrame + 1) | 0;     // 0x140ab
        if (sprite(groundTroops, i).currFrame > 0x10) {
          sprite(groundTroops, i).currFrame = 0xd;                             // 0x140ba
        }
        sprite(groundTroops, i).x = (sprite(groundTroops, i).x - 2) | 0;     // 0x140cb
        if (sprite(groundTroops, i).x < -0x1e) {
          sprite(groundTroops, i).state = GROUND_TROOP.INACTIVE;                               // 0x140e9
        }
      }
      for (j = 0; j < 0x1a; j++) {                              // 0x140fa..0x1410d
        // 0x14113..0x14175
        if (sprite(plants, j).state === PLANT.ALIVE &&
            ((sprite(groundTroops, i).x + 4) | 0) < sprite(plants, j).x &&
            ((sprite(plants, j).x + 0xc) | 0) <
              ((((sprite(groundTroops, i).x + sprite(groundTroops, i).width) | 0) - 4) | 0)) {
          sprite(groundTroops, i).state = GROUND_TROOP.PLANTING_CHARGE;                            // 0x14179
          sprite(groundTroops, i).currFrame = 4;                               // 0x1418a
        }
      }
    }
    // 0x141a0: A[i].state == 0x28
    if (sprite(paratroopers, i).state === PARATROOPER.LANDED) {
      sprite(groundTroops, i).currFrame = 0;                                   // 0x141b4
      sprite(groundTroops, i).state = GROUND_TROOP.WALKING_TO_PLANT;                                // 0x141c5
      sprite(groundTroops, i).x = sprite(paratroopers, i).x;                 // 0x141d6
      sprite(groundTroops, i).y = sprite(paratroopers, i).y;                 // 0x141f0
      sprite(paratroopers, i).state = PARATROOPER.INACTIVE;                                   // 0x1420a
      sprite(paratroopers, i).y = -0x46;                               // 0x1421b (0xffffffba)
      for (j = 0; j < 0x1a; j++) {                              // 0x1422c..0x1423f
        d = (sprite(groundTroops, i).x - sprite(plants, j).x) | 0;    // 0x14245..0x1425f
        if (d < best && sprite(plants, j).state === PLANT.ALIVE) {            // 0x14262..0x14278 (jge: signed)
          best = d;                                             // 0x1427c
          if (sprite(plants, j).x > sprite(groundTroops, i).x) {      // 0x14282 (jle)
            sprite(groundTroops, i).counter3 = 1;                             // 0x1429e counter_3 (+0x18)
          } else {
            sprite(groundTroops, i).counter1 = 0;                             // 0x142b1 counter_1 (+0x10)
            sprite(groundTroops, i).currFrame = 0xd;                           // 0x142c2
          }
        }
      }
    }
    // 0x142d8: A[i].state == 2
    if (sprite(paratroopers, i).state === PARATROOPER.SHOT_FALLING_RIGHT) {
      sprite(paratroopers, i).x = (sprite(paratroopers, i).x + 2) | 0;       // 0x142e8
      sprite(paratroopers, i).y = (sprite(paratroopers, i).y + 1) | 0;       // 0x142f6
      if (sprite(paratroopers, i).y > 0x96) {
        sprite(paratroopers, i).state = PARATROOPER.INACTIVE;                                 // 0x1430f
        sprite(paratroopers, i).y = -0x32;                             // 0x14320 (0xffffffce)
      }
      if (sprite(paratroopers, i).x > 0x140) {                        // 0x14331
        sprite(paratroopers, i).state = PARATROOPER.INACTIVE;                                 // 0x14344
      }
    }
    // 0x14355: A[i].state == 3
    if (sprite(paratroopers, i).state === PARATROOPER.SHOT_FALLING_LEFT) {
      sprite(paratroopers, i).x = (sprite(paratroopers, i).x - 2) | 0;       // 0x14365
      sprite(paratroopers, i).y = (sprite(paratroopers, i).y + 1) | 0;       // 0x14373
      if (sprite(paratroopers, i).y > 0x96) {
        sprite(paratroopers, i).state = PARATROOPER.INACTIVE;                                 // 0x1438c
        sprite(paratroopers, i).y = -0x32;                             // 0x1439d
      }
      // ORIGINAL BUG (kept on purpose): unlike the other deactivations this one does not park the sprite at
      // y = -0x32. drawGameFrame draws every paratrooper, active or not, and the sprite is 0x26 wide, so at
      // x = -0x20 its right-most 6 columns stay on screen, frozen, until the slot is reused.
      if (sprite(paratroopers, i).x < -0x1e) {                        // 0x143ae (jge)
        sprite(paratroopers, i).state = PARATROOPER.INACTIVE;                                 // 0x143be
      }
    }
    // 0x143cf: A[i].state == 4
    if (sprite(paratroopers, i).state === PARATROOPER.SHOT_DYING) {
      sprite(paratroopers, i).currFrame = (sprite(paratroopers, i).currFrame + 1) | 0;       // 0x143df
      if (sprite(paratroopers, i).currFrame > 0x1a) {
        sprite(paratroopers, i).state = PARATROOPER.INACTIVE;                                 // 0x143f5
        sprite(paratroopers, i).y = -0x32;                             // 0x14406
      }
    }
  }
});
