// 0x173a2  void updateMissile(void)   [Watcom, no args, no return value]
// Arguments: none. The prologue (0x173ac..0x173b1) only saves EBX/ECX/EDX/ESI/EDI (restored at 0x185b9..0x185bd);
// EAX is first written at 0x173d6; the function ends with a plain `ret` (no stack args). signatures.json agrees
// (regs 0, stack 0). The "1" in functions.tsv is the caller count (only caller: 0x1aa02, call at 0x1d671).
// Return: none. EAX at RET is a leftover (loads/callee results); the caller 0x1d671 continues with
// `call 0x185bf` (no register args) and never reads it. signatures.json returns=false.
//
// Everything is guarded by [0x46070] == 1 (0x45f00.state). Then, in order:
//   - 0x45f00.threshold_3 is decremented; when it goes < 0: SEQ (below) at 0x4608c.x-12 / 0x4608c.y-22,
//     then 0x45f00.state = 0x4608c.state = 0;
//   - 0x45f00.state / 0x4608c.state = 0 when 0x45f00.x > 0x17c or < -0x3c or 0x45f00.y < -0x14;
//   - 0x4608c.counter_1 countdown (reload 4) toggles 0x4608c.curr_frame between 0 and 1;
//   - 0x4608c.x/y += 0x4608c.counter_2/counter_3;
//   - 0x45f00.counter_1 decremented; if < 0 and 0x4608c.y-10 < 0x45f00.y, 0x45f00.curr_frame is set to
//     4/0/3/1/2 depending on the relative x/y of 0x45f00 and 0x4608c;
//   - three entries of the sprite array 0x46218 (ring index 0x60eec, wraps to 0 at >= 0x3f) get x/y,
//     counter_1 and state = 1;
//   - 0x45f00.x/y changed by a switch on 0x45f00.curr_frame (0..4);
//   - rectangle tests of 0x45f00 against 0x4608c, 0x35b20[i], 0x33f48[j], 0x5fc04, 0x35b20[i] (two tests),
//     0x3d23c[j], 0x3d0b0[k], 0x3d86c[j], 0x4c38c, each followed by the writes/calls shown inline;
//   - if 0x4c38c.threshold_2 <= 0 and 0x4c38c.state != 0: state = 0 and SEQ four times at random offsets.
// SEQ (a label for a sequence the binary repeats inline): [0x60b90] = X, [0x60b94] = Y,
//   [0x60b58 + 4*[0x60b8c]] = 0x33, spawnExplosion(), dws_DDiscard(word [0x6128a]), dws_DPlay(0x61280).
//   spawnExplosion advances ring index [0x60b8c] and writes x, y, state 0x26, curr_frame 0 of that slot of the sprite array 0x34704 (sprites built from "exp2.pcx", see 1352c_sub_1352c.js).
//
// Sprite evidence: every base used here is passed to Sprite_Init (0x20ce5) in 0x1aa02 (decompiled.c 4303..4553):
//   single sprites 0x45f00, 0x4608c, 0x5fc04, 0x4c38c; arrays (stride 0x18c) 0x33f48, 0x35b20, 0x3d86c,
//   0x46218, 0x3d0b0, 0x3d23c. Field offsets (LIBRARY.md "sprite"): x +0, y +4, width +8, height +0xC,
//   counter_1 +0x10, counter_2 +0x14, counter_3 +0x18, threshold_2 +0x20, threshold_3 +0x24, curr_frame +0x168,
//   state +0x170. Game meaning of these fields/values is not established here.
// dws_DPLAY structs (LIBRARY.md): 0x61260, 0x61280, 0x612a0, 0x612c0, 0x612e0, 0x61320; +0xA = soundnum word,
//   passed zero-extended (xor reg,reg; mov reg16,[..]; push) to dws_DDiscard (cdecl).
// 0x60b58: 13-entry int array (see 135bb_sub_135bb.js), meaning unknown. 0x60a68, 0x60a6c, 0x60ee0, 0x60eec:
//   globals, meaning not established here.
// Locals [ebp-4], [ebp-8], [ebp-0xc] (loop counters) and [ebp-0x10] (switch operand) are never address-taken.
import { F, register } from '../runtime/registry.js';
import { R16, R32, W32 } from '../runtime/mem.js';
import { imod } from '../runtime/cpu.js';
import { A10_JET, BOMB, CROP_DUSTER, CRUISE_MISSILE, MISSILE, MISSILE_SMOKE, MISSILE_TARGET, PARATROOPER, UFO } from './states.js';
import { SPRITE, a10Jets, bombs, choppers, cropDusters, cruiseMissile, explosionDelays, missile, missileSmoke, missileTarget, paratroopers, sndExplosion, sndParaDie1, sndParaDie2, sndParaDie3, sndParaDie5, sndRicochet, ufo } from './data.js';
import { G, dplay, sprite } from './access.js';

register(0x173a2, 'updateMissile_173a2', function updateMissile() {
  let k; // [ebp-4]
  let i; // [ebp-8]
  let j; // [ebp-0xc]
  let sw; // [ebp-0x10]: switch operand
  let r; // EAX after rand
  let d; // EBX / EDX temporaries

  // 173ba: cmp [0x46070], 1; jne end
  if (sprite(missile).state !== MISSILE.FLYING) return;

  // 173c7: dec [0x45f24] (0x45f00.threshold_3); cmp 0; jge
  sprite(missile).threshold3 = (sprite(missile).threshold3 - 1) | 0;
  if (sprite(missile).threshold3 < 0) {
    G.explosionX = (sprite(missileTarget).x - 0xc) | 0;                               // 173d6
    G.explosionY = (sprite(missileTarget).y - 0x16) | 0;                              // 173e3
    W32(explosionDelays + (G.explosionNext << 2), 0x33);                             // 173f0..173f8
    F.spawnExplosion_1352c();                                                  // 17402
    F.dws_DDiscard_1f770(dplay(sndExplosion).soundnum);                             // 17407..17415 (cdecl)
    F.dws_DPlay_1eff8(sndExplosion);                                     // 17418..17423 (cdecl)
    sprite(missile).state = MISSILE.INACTIVE;                                                      // 17426
    sprite(missileTarget).state = MISSILE_TARGET.INACTIVE;                                                      // 17430
  }

  // 1743a..1746e: x > 0x17c || x < -0x3c || y < -0x14 (signed)
  if (sprite(missile).x > 0x17c || sprite(missile).x < -0x3c || sprite(missile).y < -0x14) {
    sprite(missile).state = MISSILE.INACTIVE;                                                      // 1745a
    sprite(missileTarget).state = MISSILE_TARGET.INACTIVE;                                                      // 17464
  }

  // 1746e: dec [0x4609c] (0x4608c.counter_1); cmp 0; jge
  sprite(missileTarget).counter1 = (sprite(missileTarget).counter1 - 1) | 0;
  if (sprite(missileTarget).counter1 < 0) {
    sprite(missileTarget).counter1 = 4;                                                      // 1747d
    if (sprite(missileTarget).currFrame === 0) {                                             // 17487
      sprite(missileTarget).currFrame = 1;                                                    // 17490
    } else {
      sprite(missileTarget).currFrame = 0;                                                    // 1749c
    }
  }

  // 174a6..174b6: 0x4608c.x += counter_2; 0x4608c.y += counter_3
  sprite(missileTarget).x = (sprite(missileTarget).x + sprite(missileTarget).counter2) | 0;
  sprite(missileTarget).y = (sprite(missileTarget).y + sprite(missileTarget).counter3) | 0;

  // 174bc: dec [0x45f10] (0x45f00.counter_1); jge -> 175b9; 174cb: [0x46090]-10 < [0x45f04] (jl)
  sprite(missile).counter1 = (sprite(missile).counter1 - 1) | 0;
  if (sprite(missile).counter1 < 0 && ((sprite(missileTarget).y - 0xa) | 0) < sprite(missile).y) {
    // 174e0: y <= Y && x < X -> curr_frame 4
    if (sprite(missile).y <= sprite(missileTarget).y && sprite(missile).x < sprite(missileTarget).x) {
      sprite(missile).currFrame = 4;                                                    // 174fc
    }
    // 17506: y <= Y && x > X -> 0
    if (sprite(missile).y <= sprite(missileTarget).y && sprite(missile).x > sprite(missileTarget).x) {
      sprite(missile).currFrame = 0;                                                    // 17522
    }
    // 1752c: X-5 > x && y > Y -> 3
    if (((sprite(missileTarget).x - 5) | 0) > sprite(missile).x && sprite(missile).y > sprite(missileTarget).y) {
      sprite(missile).currFrame = 3;                                                    // 1754b
    }
    // 17555: X+15 < x && y > Y -> 1
    if (((sprite(missileTarget).x + 0xf) | 0) < sprite(missile).x && sprite(missile).y > sprite(missileTarget).y) {
      sprite(missile).currFrame = 1;                                                    // 17574
    }
    // 1757e: y > Y && X-5 < x && X+15 > x -> 2
    if (sprite(missile).y > sprite(missileTarget).y && ((sprite(missileTarget).x - 5) | 0) < sprite(missile).x &&
        ((sprite(missileTarget).x + 0xf) | 0) > sprite(missile).x) {
      sprite(missile).currFrame = 2;                                                    // 175af
    }
  }

  // 175b9: inc [0x60eec]; cmp 0x3f; jl
  G.missileSmokeNext = (G.missileSmokeNext + 1) | 0;
  if (G.missileSmokeNext >= 0x3f) {
    G.missileSmokeNext = 0;                                                      // 175c8
  }
  sprite(missileSmoke, G.missileSmokeNext).x = sprite(missile).x;            // 175d2..175e2 x
  sprite(missileSmoke, G.missileSmokeNext).y = (sprite(missile).y + 5) | 0;  // 175e8..175fb y
  sprite(missileSmoke, G.missileSmokeNext).counter1 = 0xe;                     // 17601 counter_1
  sprite(missileSmoke, G.missileSmokeNext).state = MISSILE_SMOKE.ACTIVE;                       // 17615 state

  // 17629
  G.missileSmokeNext = (G.missileSmokeNext + 1) | 0;
  if (G.missileSmokeNext >= 0x3f) {
    G.missileSmokeNext = 0;                                                      // 17638
  }
  sprite(missileSmoke, G.missileSmokeNext).x = (sprite(missile).x + 2) | 0;  // 17642..17655
  sprite(missileSmoke, G.missileSmokeNext).y = (sprite(missile).y + 7) | 0;  // 1765b..1766e
  sprite(missileSmoke, G.missileSmokeNext).counter1 = 7;                       // 17674
  sprite(missileSmoke, G.missileSmokeNext).state = MISSILE_SMOKE.ACTIVE;                       // 17688

  // 1769c
  G.missileSmokeNext = (G.missileSmokeNext + 1) | 0;
  if (G.missileSmokeNext >= 0x3f) {
    G.missileSmokeNext = 0;                                                      // 176ab
  }
  sprite(missileSmoke, G.missileSmokeNext).x = (sprite(missile).x - 2) | 0;  // 176b5..176c8
  sprite(missileSmoke, G.missileSmokeNext).y = (sprite(missile).y + 7) | 0;  // 176ce..176e1
  sprite(missileSmoke, G.missileSmokeNext).counter1 = 4;                       // 176e7
  sprite(missileSmoke, G.missileSmokeNext).state = MISSILE_SMOKE.ACTIVE;                       // 176fb

  // 1770f: switch on [0x46068] (0x45f00.curr_frame); 1776c: cmp 4; ja default (unsigned);
  // jump table at 0x17758: 0x17719, 0x17722, 0x17732, 0x1773b, 0x1774b; default 0x17754 -> 0x1777e
  sw = sprite(missile).currFrame;
  switch (sw >>> 0) {
    case 0:
      sprite(missile).x = (sprite(missile).x - 0xa) | 0;                             // 17719
      break;
    case 1:
      sprite(missile).x = (sprite(missile).x - 7) | 0;                               // 17722
      sprite(missile).y = (sprite(missile).y - 5) | 0;                               // 17729
      break;
    case 2:
      sprite(missile).y = (sprite(missile).y - 8) | 0;                               // 17732
      break;
    case 3:
      sprite(missile).x = (sprite(missile).x + 7) | 0;                               // 1773b
      sprite(missile).y = (sprite(missile).y - 5) | 0;                               // 17742
      break;
    case 4:
      sprite(missile).x = (sprite(missile).x + 0xa) | 0;                             // 1774b
      break;
    default:
      break;                                                              // 17754
  }

  // 1777e..177e5: ((x+w > X && x < X) || (X+W > x && x > X)) && Y+H > y && Y-9 < y
  if (((((sprite(missile).x + sprite(missile).width) | 0) > sprite(missileTarget).x && sprite(missile).x < sprite(missileTarget).x) ||
       (((sprite(missileTarget).x + sprite(missileTarget).width) | 0) > sprite(missile).x && sprite(missile).x > sprite(missileTarget).x)) &&
      ((sprite(missileTarget).y + sprite(missileTarget).height) | 0) > sprite(missile).y &&
      ((sprite(missileTarget).y - 9) | 0) < sprite(missile).y) {
    G.explosionX = (sprite(missileTarget).x - 0xc) | 0;                               // 177ea
    G.explosionY = (sprite(missileTarget).y - 0x16) | 0;                              // 177f7
    W32(explosionDelays + (G.explosionNext << 2), 0x33);                             // 17804..1780c
    F.spawnExplosion_1352c();                                                  // 17816
    F.dws_DDiscard_1f770(dplay(sndExplosion).soundnum);                             // 1781b..17829 (cdecl)
    F.dws_DPlay_1eff8(sndExplosion);                                     // 1782c..17837 (cdecl)
    sprite(missile).state = MISSILE.INACTIVE;                                                      // 1783a
    sprite(missileTarget).state = MISSILE_TARGET.INACTIVE;                                                      // 17844

    // 1784e..1799a: sprites 0x35b20 + i*0x18c, i < 0x19
    for (i = 0; i < 0x19; i++) {
      // 17867..178db: Y-22 < s.y && Y+22 > s.y && s.x+s.w > X-17 && X+30 > s.x
      if (((sprite(missileTarget).y - 0x16) | 0) < sprite(paratroopers, i).y &&
          ((sprite(missileTarget).y + 0x16) | 0) > sprite(paratroopers, i).y &&
          ((sprite(paratroopers, i).x + sprite(paratroopers, i).width) | 0) > ((sprite(missileTarget).x - 0x11) | 0) &&
          ((sprite(missileTarget).x + 0x1e) | 0) > sprite(paratroopers, i).x) {
        r = F.rand_232c7();                                         // 178e0
        if (imod(r, 0xa) === 1) {                                         // 178e5..178f6
          if (sprite(paratroopers, i).x > 0xa0) {                          // 178f8
            sprite(paratroopers, i).state = PARATROOPER.SHOT_FALLING_RIGHT;                                  // 1790b state
          } else {
            sprite(paratroopers, i).state = PARATROOPER.SHOT_FALLING_LEFT;                                  // 1791e state
          }
          r = F.rand_232c7();                                       // 1792f
          sprite(paratroopers, i).currFrame = (imod(r, 3) + 0x13) | 0;              // 17934..1794c curr_frame
        } else {
          sprite(paratroopers, i).state = PARATROOPER.SHOT_DYING;                                    // 17954 state
          sprite(paratroopers, i).currFrame = 0x15;                                 // 17965 curr_frame
        }
        F.dws_DDiscard_1f770(dplay(sndParaDie5).soundnum);                         // 17976..17984 (cdecl)
        F.dws_DPlay_1eff8(sndParaDie5);                                 // 17987..17992 (cdecl)
      }
    }
  }

  // 1799a..17b31: sprites 0x33f48 + j*0x18c, j < 5
  for (j = 0; j < 5; j++) {
    // 179b3..17a31: s.x+10 < x && s.x+s.w-10 > x && s.y+s.h-5 > y && s.y+5 < y
    if (((sprite(choppers, j).x + 0xa) | 0) < sprite(missile).x &&
        ((((sprite(choppers, j).x + sprite(choppers, j).width) | 0) - 0xa) | 0) > sprite(missile).x &&
        ((((sprite(choppers, j).y + sprite(choppers, j).height) | 0) - 5) | 0) > sprite(missile).y &&
        ((sprite(choppers, j).y + 5) | 0) < sprite(missile).y) {
      sprite(choppers, j).counter2 = -5;                                       // 17a36 counter_2
      r = F.rand_232c7();                                           // 17a4e
      d = imod(r, 3);                                                     // 17a53..17a61 ebx
      r = F.rand_232c7();                                           // 17a63
      d = (d - imod(r, 3)) | 0;                                           // 17a68..17a76 sub ebx, edx
      sprite(choppers, j).x = (sprite(choppers, j).x + d) | 0;                       // 17a78 x
      r = F.rand_232c7();                                           // 17a85
      d = imod(r, 3);                                                     // 17a8a..17a98
      r = F.rand_232c7();                                           // 17a9a
      d = (d - imod(r, 3)) | 0;                                           // 17a9f..17aad
      sprite(choppers, j).y = (sprite(choppers, j).y + d) | 0;                       // 17aaf y
      sprite(missile).state = MISSILE.INACTIVE;                                                    // 17ab5
      sprite(missileTarget).state = MISSILE_TARGET.INACTIVE;                                                    // 17abf
      G.explosionX = (sprite(missile).x - 0xc) | 0;                             // 17ac9
      G.explosionY = (sprite(missile).y - 0x16) | 0;                            // 17ad8
      W32(explosionDelays + (G.explosionNext << 2), 0x33);                           // 17ae7..17af0
      F.spawnExplosion_1352c();                                                // 17afa
      F.dws_DDiscard_1f770(dplay(sndExplosion).soundnum);                           // 17aff..17b0e (cdecl)
      F.dws_DPlay_1eff8(sndExplosion);                                   // 17b11..17b1c (cdecl)
      G.score = (G.score + 0x64) | 0;                            // 17b1f
      G.kills = (G.kills + 1) | 0;                               // 17b26
    }
  }

  // 17b31..17b86: P = 0x5fc04: P.x-3 < x && P.x+P.w+3 > x && P.y+P.h+3 > y && P.y-3 < y
  if (((sprite(cruiseMissile).x - 3) | 0) < sprite(missile).x &&
      ((((sprite(cruiseMissile).x + sprite(cruiseMissile).width) | 0) + 3) | 0) > sprite(missile).x &&
      ((((sprite(cruiseMissile).y + sprite(cruiseMissile).height) | 0) + 3) | 0) > sprite(missile).y &&
      ((sprite(cruiseMissile).y - 3) | 0) < sprite(missile).y) {
    sprite(missile).state = MISSILE.INACTIVE;                                                      // 17b86
    sprite(missileTarget).state = MISSILE_TARGET.INACTIVE;                                                      // 17b90
    sprite(cruiseMissile).state = CRUISE_MISSILE.INACTIVE;                                                      // 17b9a 0x5fc04.state
    G.explosionX = (sprite(missile).x - 0xc) | 0;                               // 17ba4
    G.explosionY = (sprite(missile).y - 0x16) | 0;                              // 17bb1
    W32(explosionDelays + (G.explosionNext << 2), 0x33);                             // 17bbe..17bc6
    F.spawnExplosion_1352c();                                                  // 17bd0
    F.dws_DDiscard_1f770(dplay(sndExplosion).soundnum);                             // 17bd5..17be3 (cdecl)
    F.dws_DPlay_1eff8(sndExplosion);                                     // 17be6..17bf1 (cdecl)
    G.kills = (G.kills + 1) | 0;                                 // 17bf4
    G.score = (G.score + 0x7d1) | 0;                             // 17bfa
  }

  // 17c04..17ef5: sprites 0x35b20 + i*0x18c, i < 0x19
  for (i = 0; i < 0x19; i++) {
    // 17c1d..17cb0: x+w > s.x && s.x+s.w > x && y > s.y && s.y+17 > y && (s.state == 0x1c || s.state == 0x1b)
    if (((sprite(missile).x + sprite(missile).width) | 0) > sprite(paratroopers, i).x &&
        ((sprite(paratroopers, i).x + sprite(paratroopers, i).width) | 0) > sprite(missile).x &&
        sprite(missile).y > sprite(paratroopers, i).y &&
        ((sprite(paratroopers, i).y + 0x11) | 0) > sprite(missile).y &&
        (sprite(paratroopers, i).state === PARATROOPER.DESCENDING_SWING_FORWARD || sprite(paratroopers, i).state === PARATROOPER.DESCENDING_SWING_BACK)) {
      sprite(paratroopers, i).state = PARATROOPER.CHUTE_SHOT_FALLING;                                     // 17cb5 state
      sprite(paratroopers, i).counter2 = 0;                                        // 17cc6 counter_2
      sprite(paratroopers, i).currFrame = 5;                                        // 17cd7 curr_frame
      r = F.rand_232c7();                                           // 17ce8
      G.randomVoice = imod(r, 3);                                           // 17ced..17cfb
      F.dws_DDiscard_1f770(dplay(sndParaDie1).soundnum);                           // 17d01..17d10 (cdecl)
      F.dws_DDiscard_1f770(dplay(sndParaDie2).soundnum);                           // 17d13..17d22 (cdecl)
      F.dws_DDiscard_1f770(dplay(sndParaDie3).soundnum);                           // 17d25..17d34 (cdecl)
      if (G.randomVoice === 0) {                                           // 17d37
        F.dws_DPlay_1eff8(sndParaDie1);                                 // 17d40..17d4b (cdecl)
      }
      if (G.randomVoice === 1) {                                           // 17d4e
        F.dws_DPlay_1eff8(sndParaDie2);                                 // 17d57..17d62 (cdecl)
      }
      if (G.randomVoice === 2) {                                           // 17d65
        F.dws_DPlay_1eff8(sndParaDie3);                                 // 17d6e..17d79 (cdecl)
      }
      G.score = (G.score + 0xf) | 0;                             // 17d7c
      G.kills = (G.kills + 1) | 0;                               // 17d83
    }
    // 17d89..17e29: x+w > s.x && s.x+s.w > x && s.y+17 < y && s.y+s.h > y && (s.state == 0x1c || s.state == 0x1b)
    if (((sprite(missile).x + sprite(missile).width) | 0) > sprite(paratroopers, i).x &&
        ((sprite(paratroopers, i).x + sprite(paratroopers, i).width) | 0) > sprite(missile).x &&
        ((sprite(paratroopers, i).y + 0x11) | 0) < sprite(missile).y &&
        ((sprite(paratroopers, i).y + sprite(paratroopers, i).height) | 0) > sprite(missile).y &&
        (sprite(paratroopers, i).state === PARATROOPER.DESCENDING_SWING_FORWARD || sprite(paratroopers, i).state === PARATROOPER.DESCENDING_SWING_BACK)) {
      r = F.rand_232c7();                                           // 17e2e
      if (imod(r, 0xa) === 1) {                                           // 17e33..17e44
        if (sprite(paratroopers, i).x > 0xa0) {                            // 17e46
          sprite(paratroopers, i).state = PARATROOPER.SHOT_FALLING_RIGHT;                                    // 17e59 state
        } else {
          sprite(paratroopers, i).state = PARATROOPER.SHOT_FALLING_LEFT;                                    // 17e6c state
        }
        r = F.rand_232c7();                                         // 17e7d
        sprite(paratroopers, i).currFrame = (imod(r, 3) + 0x13) | 0;                // 17e82..17e9a curr_frame
      } else {
        sprite(paratroopers, i).state = PARATROOPER.SHOT_DYING;                                      // 17ea2 state
        sprite(paratroopers, i).currFrame = 0x15;                                   // 17eb3 curr_frame
      }
      F.dws_DDiscard_1f770(dplay(sndParaDie5).soundnum);                           // 17ec4..17ed2 (cdecl)
      F.dws_DPlay_1eff8(sndParaDie5);                                   // 17ed5..17ee0 (cdecl)
      G.score = (G.score + 0xb) | 0;                             // 17ee3
      G.kills = (G.kills + 1) | 0;                               // 17eea
    }
  }

  // 17ef5..18088: sprites 0x3d23c + j*0x18c, j < 4
  for (j = 0; j < 4; j++) {
    // 17f0e..17f99: x+w > s.x && s.x+s.w > x && y > s.y && s.y+s.h > y && s.state == 1
    if (((sprite(missile).x + sprite(missile).width) | 0) > sprite(bombs, j).x &&
        ((sprite(bombs, j).x + sprite(bombs, j).width) | 0) > sprite(missile).x &&
        sprite(missile).y > sprite(bombs, j).y &&
        ((sprite(bombs, j).y + sprite(bombs, j).height) | 0) > sprite(missile).y &&
        sprite(bombs, j).state === BOMB.FALLING) {
      sprite(bombs, j).state = BOMB.INACTIVE;                                        // 17f9e state
      G.explosionX = (sprite(bombs, j).x - 0xc) | 0;                 // 17faf
      G.explosionY = (sprite(bombs, j).y - 0x16) | 0;                // 17fc4
      W32(explosionDelays + (G.explosionNext << 2), 0x33);                           // 17fd9..17fe1
      F.spawnExplosion_1352c();                                                // 17feb
      F.dws_DDiscard_1f770(dplay(sndExplosion).soundnum);                           // 17ff0..17ffe (cdecl)
      F.dws_DPlay_1eff8(sndExplosion);                                   // 18001..1800c (cdecl)
      sprite(missile).state = MISSILE.INACTIVE;                                                    // 1800f
      sprite(missileTarget).state = MISSILE_TARGET.INACTIVE;                                                    // 18019
      G.explosionX = (sprite(missile).x - 0xc) | 0;                             // 18023
      G.explosionY = (sprite(missile).y - 0x16) | 0;                            // 18030
      W32(explosionDelays + (G.explosionNext << 2), 0x33);                           // 1803d..18045
      F.spawnExplosion_1352c();                                                // 1804f
      F.dws_DDiscard_1f770(dplay(sndExplosion).soundnum);                           // 18054..18062 (cdecl)
      F.dws_DPlay_1eff8(sndExplosion);                                   // 18065..18070 (cdecl)
      G.score = (G.score + 0x1f5) | 0;                           // 18073
      G.kills = (G.kills + 1) | 0;                               // 1807d
    }
  }

  // 18088..18275: sprite 0x3d0b0 + k*0x18c, k < 1
  for (k = 0; k < 1; k++) {
    // 180a1..1812c: x+w > s.x && s.x+s.w > x && y > s.y && s.y+s.h > y && s.state != 0
    if (((sprite(missile).x + sprite(missile).width) | 0) > sprite(a10Jets, k).x &&
        ((sprite(a10Jets, k).x + sprite(a10Jets, k).width) | 0) > sprite(missile).x &&
        sprite(missile).y > sprite(a10Jets, k).y &&
        ((sprite(a10Jets, k).y + sprite(a10Jets, k).height) | 0) > sprite(missile).y &&
        sprite(a10Jets, k).state !== A10_JET.INACTIVE) {
      sprite(a10Jets, k).state = A10_JET.INACTIVE;                                        // 18131 state
      // 18142..181e8: j < 4
      for (j = 0; j < 4; j++) {
        r = F.rand_232c7();                                         // 18162
        d = imod(r, 0x1e);                                                // 18167..18173 edx
        G.explosionX = (d + sprite(a10Jets, k).x) | 0;                         // 18175..1817d s.x + rand%30
        r = F.rand_232c7();                                         // 1818a
        d = imod(r, 0x14);                                                // 1818f..1819b
        G.explosionY = (d + sprite(a10Jets, k).y) | 0;                         // 1819d..181a5 s.y + rand%20
        W32(explosionDelays + (G.explosionNext << 2), 0x33);                         // 181ab..181b4
        F.spawnExplosion_1352c();                                              // 181be
        F.dws_DDiscard_1f770(dplay(sndExplosion).soundnum);                         // 181c3..181d2 (cdecl)
        F.dws_DPlay_1eff8(sndExplosion);                                 // 181d5..181e0 (cdecl)
      }
      G.score = (G.score + 0x12c) | 0;                           // 181e8
      G.kills = (G.kills + 1) | 0;                               // 181f2
      sprite(missile).state = MISSILE.INACTIVE;                                                    // 181f8
      sprite(missileTarget).state = MISSILE_TARGET.INACTIVE;                                                    // 18202
      sprite(missile).state = MISSILE.INACTIVE;                                                    // 1820c (repeated store in the binary)
      sprite(missileTarget).state = MISSILE_TARGET.INACTIVE;                                                    // 18216 (repeated store in the binary)
      G.explosionX = (sprite(missile).x - 0xc) | 0;                             // 18220
      G.explosionY = (sprite(missile).y - 0x16) | 0;                            // 1822d
      W32(explosionDelays + (G.explosionNext << 2), 0x33);                           // 1823a..18242
      F.spawnExplosion_1352c();                                                // 1824c
      F.dws_DDiscard_1f770(dplay(sndExplosion).soundnum);                           // 18251..1825f (cdecl)
      F.dws_DPlay_1eff8(sndExplosion);                                   // 18262..1826d (cdecl)
    }
  }

  // 18275..18405: sprites 0x3d86c + j*0x18c, j < 3
  for (j = 0; j < 3; j++) {
    // 1828e..18319: x+w > s.x && s.x+s.w > x && y > s.y && s.y+s.h > y && s.state != 0
    if (((sprite(missile).x + sprite(missile).width) | 0) > sprite(cropDusters, j).x &&
        ((sprite(cropDusters, j).x + sprite(cropDusters, j).width) | 0) > sprite(missile).x &&
        sprite(missile).y > sprite(cropDusters, j).y &&
        ((sprite(cropDusters, j).y + sprite(cropDusters, j).height) | 0) > sprite(missile).y &&
        sprite(cropDusters, j).state !== CROP_DUSTER.INACTIVE) {
      sprite(cropDusters, j).state = CROP_DUSTER.INACTIVE;                                        // 1831e state
      G.explosionX = (sprite(cropDusters, j).x - 0xc) | 0;                 // 1832f
      G.explosionY = (sprite(cropDusters, j).y - 0x16) | 0;                // 18344
      W32(explosionDelays + (G.explosionNext << 2), 0x33);                           // 18359..18361
      F.spawnExplosion_1352c();                                                // 1836b
      F.dws_DDiscard_1f770(dplay(sndExplosion).soundnum);                           // 18370..1837e (cdecl)
      F.dws_DPlay_1eff8(sndExplosion);                                   // 18381..1838c (cdecl)
      G.score = (G.score + 0x64) | 0;                            // 1838f
      G.kills = (G.kills + 1) | 0;                               // 18396
      sprite(missile).state = MISSILE.INACTIVE;                                                    // 1839c
      sprite(missileTarget).state = MISSILE_TARGET.INACTIVE;                                                    // 183a6
      G.explosionX = (sprite(missile).x - 0xc) | 0;                             // 183b0
      G.explosionY = (sprite(missile).y - 0x16) | 0;                            // 183bd
      W32(explosionDelays + (G.explosionNext << 2), 0x33);                           // 183ca..183d2
      F.spawnExplosion_1352c();                                                // 183dc
      F.dws_DDiscard_1f770(dplay(sndExplosion).soundnum);                           // 183e1..183ef (cdecl)
      F.dws_DPlay_1eff8(sndExplosion);                                   // 183f2..183fd (cdecl)
    }
  }

  // 18405..1845a: B = 0x4c38c: x+w > B.x && B.x+B.w > x && y > B.y && B.y+B.h > y && B.state != 0
  if (((sprite(missile).x + sprite(missile).width) | 0) > sprite(ufo).x &&
      ((sprite(ufo).x + sprite(ufo).width) | 0) > sprite(missile).x &&
      sprite(missile).y > sprite(ufo).y &&
      ((sprite(ufo).y + sprite(ufo).height) | 0) > sprite(missile).y &&
      sprite(ufo).state !== UFO.INACTIVE) {
    sprite(ufo).threshold2 = (sprite(ufo).threshold2 - 0xf) | 0;                               // 1845f threshold_2 -= 15
    sprite(ufo).counter2 = Math.imul(sprite(ufo).counter2, -1);                            // 18466..1846d counter_2 *= -1
    F.dws_DDiscard_1f770(dplay(sndRicochet).soundnum);                             // 18472..18480 (cdecl)
    F.dws_DPlay_1eff8(sndRicochet);                                     // 18483..1848e (cdecl)
    sprite(missile).state = MISSILE.INACTIVE;                                                      // 18491
    sprite(missileTarget).state = MISSILE_TARGET.INACTIVE;                                                      // 1849b
    G.explosionX = (sprite(missile).x - 0xc) | 0;                               // 184a5
    G.explosionY = (sprite(missile).y - 0x16) | 0;                              // 184b2
    W32(explosionDelays + (G.explosionNext << 2), 0x33);                             // 184bf..184c7
    F.spawnExplosion_1352c();                                                  // 184d1
    F.dws_DDiscard_1f770(dplay(sndExplosion).soundnum);                             // 184d6..184e4 (cdecl)
    F.dws_DPlay_1eff8(sndExplosion);                                     // 184e7..184f2 (cdecl)
  }

  // 184f5: [0x4c3ac] > 0 (jg) -> end; [0x4c4fc] == 0 -> end
  if (sprite(ufo).threshold2 <= 0 && sprite(ufo).state !== UFO.INACTIVE) {
    sprite(ufo).state = UFO.INACTIVE;                                                      // 1850c state
    // 18516..185a6: j < 4
    for (j = 0; j < 4; j++) {
      r = F.rand_232c7();                                           // 1852b
      d = imod(r, 0x1e);                                                  // 18530..1853c edx
      G.explosionX = (sprite(ufo).x + d) | 0;                               // 1853e..18545
      r = F.rand_232c7();                                           // 1854a
      d = imod(r, 0x14);                                                  // 1854f..1855b
      G.explosionY = (d + sprite(ufo).y) | 0;                               // 1855d..18564
      W32(explosionDelays + (G.explosionNext << 2), 0x33);                           // 1856a..18573
      F.spawnExplosion_1352c();                                                // 1857d
      F.dws_DDiscard_1f770(dplay(sndExplosion).soundnum);                           // 18582..18590 (cdecl)
      F.dws_DPlay_1eff8(sndExplosion);                                   // 18593..1859e (cdecl)
    }
    G.score = (G.score + 0x3e8) | 0;                             // 185a6
    G.kills = (G.kills + 1) | 0;                                 // 185b0
  }
  // 185b6: epilogue
});
