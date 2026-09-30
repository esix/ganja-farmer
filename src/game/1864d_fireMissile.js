// 0x1864d  void fireMissile(void)   [Watcom, no args (no register is read before it is written; EBX/ECX/EDX/ESI/EDI
//   are only saved/restored), no return value: EAX holds a leftover load; the only caller 0x18f27 (call at 0x196ba)
//   does not read EAX afterwards]
// Makes no calls (only __CHK, omitted).
// Copies x/y of the sprite at 0x33aa4 into the sprite at 0x4608c, clears 0x4608c.counter_2/counter_3, then scans
// the sprite arrays at 0x33f48 (5), 0x3d86c (3), 0x3d0b0 (1) and the sprite at 0x5fc04 for a rectangle (built
// from x/y/width/height with margins) that contains that point and whose `state` != 0; a hit copies the sprite's
// counter_1 into 0x4608c.counter_2 (the 0x5fc04 hit instead sets 5 / -5 by state 0x46 / 0x45, and counter_3 = 3).
// Then sets fields of the sprite at 0x45f00 from the sprite at 0x33dbc and switches on 0x33dbc.curr_frame.
//
// Sprite evidence: each base below is passed as a sprite* to library sprite functions
//   (Sprite_Init 0x20ce5 / PCX_Get_Sprite 0x20c12 / *_Sprite_Clip, see decompiled.c):
//   0x33aa4 (Behind/Erase_Sprite_Clip in 0x10cac), 0x33dbc (Erase/Behind/Draw_Sprite_Clip in 0x15e15),
//   0x33f48 + i*0x18c, 0x3d86c + i*0x18c, 0x3d0b0 + i*0x18c, 0x5fc04, 0x45f00, 0x4608c (Sprite_Init in 0x1aa02).
// Field offsets (x +0, y +4, width +8, height +0xC, counter_1 +0x10, counter_2 +0x14, counter_3 +0x18,
// threshold_3 +0x24, curr_frame +0x168, state +0x170): sprite struct, stride 0x18c (LIBRARY.md).
// Any game meaning of these fields/values is not established here.
import { register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';
import { A10_JET, CHOPPER, CROP_DUSTER, CRUISE_MISSILE, MISSILE, MISSILE_TARGET } from './states.js';
import { a10Jets, choppers, cropDusters, cruiseMissile, gunSight, missile, missileTarget, rasta } from './data.js';
import { sprite } from './access.js';

register(0x1864d, 'fireMissile_1864d', function fireMissile() {
  let i; // [ebp-4]
  let sw; // [ebp-8]: switch operand

  sprite(missileTarget).x = sprite(gunSight).x; // 0x4608c.x = 0x33aa4.x
  sprite(missileTarget).y = sprite(gunSight).y; // 0x4608c.y = 0x33aa4.y
  sprite(missileTarget).counter2 = 0; // 0x4608c.counter_2
  sprite(missileTarget).counter3 = 0; // 0x4608c.counter_3

  // 0x1868d..0x1874a: sprites 0x33f48 + i*0x18c, i = 0..4
  for (i = 0; i < 5; i++) {
    if (((sprite(choppers, i).x + 10) | 0) < sprite(missileTarget).x && // x + 10 < X      (0x186b6 jge)
        ((sprite(choppers, i).x + sprite(choppers, i).width - 10) | 0) > sprite(missileTarget).x && // x + width - 10 > X (0x186e1 jg)
        ((sprite(choppers, i).y + sprite(choppers, i).height - 5) | 0) > sprite(missileTarget).y && // y + height - 5 > Y (0x18708 jg)
        ((sprite(choppers, i).y + 5) | 0) < sprite(missileTarget).y && // y + 5 < Y        (0x18722 jl)
        sprite(choppers, i).state !== CHOPPER.INACTIVE) { // state != 0 (0x18734)
      sprite(missileTarget).counter2 = sprite(choppers, i).counter1; // 0x4608c.counter_2 = counter_1
    }
  }

  // 0x1874f..0x18800: sprites 0x3d86c + i*0x18c, i = 0..2
  for (i = 0; i < 3; i++) {
    if (sprite(missileTarget).x > sprite(cropDusters, i).x && // X > x (0x1877b jle)
        ((sprite(cropDusters, i).x + sprite(cropDusters, i).width) | 0) > sprite(missileTarget).x && // x + width > X (0x1879d jg)
        sprite(missileTarget).y > sprite(cropDusters, i).y && // Y > y (0x187b4 jg)
        ((sprite(cropDusters, i).y + sprite(cropDusters, i).height) | 0) > sprite(missileTarget).y && // y + height > Y (0x187d8 jg)
        sprite(cropDusters, i).state !== CROP_DUSTER.INACTIVE) { // state != 0 (0x187ea)
      sprite(missileTarget).counter2 = sprite(cropDusters, i).counter1; // 0x4608c.counter_2 = counter_1
    }
  }

  // 0x18805..0x188b6: sprite 0x3d0b0 + i*0x18c, i = 0 only
  for (i = 0; i < 1; i++) {
    if (sprite(missileTarget).x > sprite(a10Jets, i).x && // X > x (0x18831 jle)
        ((sprite(a10Jets, i).x + sprite(a10Jets, i).width) | 0) > sprite(missileTarget).x && // x + width > X (0x18853 jg)
        sprite(missileTarget).y > sprite(a10Jets, i).y && // Y > y (0x1886a jg)
        ((sprite(a10Jets, i).y + sprite(a10Jets, i).height) | 0) > sprite(missileTarget).y && // y + height > Y (0x1888e jg)
        sprite(a10Jets, i).state !== A10_JET.INACTIVE) { // state != 0 (0x188a0)
      sprite(missileTarget).counter2 = sprite(a10Jets, i).counter1; // 0x4608c.counter_2 = counter_1
    }
  }

  // 0x188bb..0x1893e: sprite 0x5fc04
  if (((sprite(cruiseMissile).x - 3) | 0) < sprite(missileTarget).x && // x - 3 < X (0x188c9 jge)
      ((sprite(cruiseMissile).x + sprite(cruiseMissile).width + 3) | 0) > sprite(missileTarget).x && // x + width + 3 > X (0x188df jg)
      ((sprite(cruiseMissile).y - 3) | 0) < sprite(missileTarget).y && // y - 3 < Y (0x188f1 jl)
      ((sprite(cruiseMissile).y + sprite(cruiseMissile).height + 3) | 0) > sprite(missileTarget).y && // y + height + 3 > Y (0x18909 jg)
      sprite(cruiseMissile).state !== CRUISE_MISSILE.INACTIVE) { // state != 0 (0x18914)
    if (sprite(cruiseMissile).state === CRUISE_MISSILE.FLYING_RIGHT) {
      sprite(missileTarget).counter2 = 5;
    }
    if (sprite(cruiseMissile).state === CRUISE_MISSILE.FLYING_LEFT) {
      sprite(missileTarget).counter2 = -5;
    }
    sprite(missileTarget).counter3 = 3; // 0x4608c.counter_3
  }

  // 0x18948..0x1897a
  sprite(missile).x = sprite(rasta).x; // 0x45f00.x = 0x33dbc.x
  sprite(missile).y = sprite(rasta).y; // 0x45f00.y = 0x33dbc.y
  sprite(missile).state = MISSILE.FLYING; // 0x45f00.state
  sprite(missileTarget).state = MISSILE_TARGET.ACTIVE; // 0x4608c.state
  sprite(missile).counter1 = 7; // 0x45f00.counter_1
  sprite(missile).threshold3 = 0x96; // 0x45f00.threshold_3

  // 0x18984: switch on 0x33dbc.curr_frame; dispatch 0x18a0f..0x18a4d (compiler compare tree, unsigned jb/jbe/je;
  // only the listed values reach a case body, everything else jumps to 0x18a0d -> exit)
  sw = sprite(rasta).currFrame;
  switch (sw) {
    case 0x15: // 0x18991
      sprite(missile).currFrame = 2; // 0x45f00.curr_frame
      sprite(missile).x = (sprite(rasta).x + 10) | 0;
      break;
    case 0x17: // 0x189ad
      sprite(missile).currFrame = 3;
      sprite(missile).x = (sprite(rasta).x + 0xf) | 0;
      break;
    case 0x19: // 0x189c9
      sprite(missile).currFrame = 1;
      break;
    case 0x1d: // 0x189d8
      sprite(missile).currFrame = 0;
      sprite(missile).y = (sprite(rasta).y + 7) | 0;
      break;
    case 0x1b: // 0x189f4
      sprite(missile).currFrame = 4;
      sprite(missile).y = (sprite(rasta).y + 7) | 0;
      break;
  }
});
