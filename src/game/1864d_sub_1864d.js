// 0x1864d  void sub_1864d(void)   [Watcom, no args (no register is read before it is written; EBX/ECX/EDX/ESI/EDI
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
import { SPRITE, a10Jets, choppers, cropDusters, cruiseMissile, gunSight, missile, missileTarget, rasta } from './data.js';

register(0x1864d, 'sub_1864d', function sub_1864d() {
  let i; // [ebp-4]
  let sw; // [ebp-8]: switch operand

  W32(missileTarget, R32(gunSight)); // 0x4608c.x = 0x33aa4.x
  W32((missileTarget + SPRITE.y), R32((gunSight + SPRITE.y))); // 0x4608c.y = 0x33aa4.y
  W32((missileTarget + SPRITE.counter2), 0); // 0x4608c.counter_2
  W32((missileTarget + SPRITE.counter3), 0); // 0x4608c.counter_3

  // 0x1868d..0x1874a: sprites 0x33f48 + i*0x18c, i = 0..4
  for (i = 0; i < 5; i++) {
    if (((R32(choppers + i * SPRITE.SIZE) + 10) | 0) < R32(missileTarget) && // x + 10 < X      (0x186b6 jge)
        ((R32(choppers + i * SPRITE.SIZE) + R32((choppers + SPRITE.width) + i * SPRITE.SIZE) - 10) | 0) > R32(missileTarget) && // x + width - 10 > X (0x186e1 jg)
        ((R32((choppers + SPRITE.y) + i * SPRITE.SIZE) + R32((choppers + SPRITE.height) + i * SPRITE.SIZE) - 5) | 0) > R32((missileTarget + SPRITE.y)) && // y + height - 5 > Y (0x18708 jg)
        ((R32((choppers + SPRITE.y) + i * SPRITE.SIZE) + 5) | 0) < R32((missileTarget + SPRITE.y)) && // y + 5 < Y        (0x18722 jl)
        R32((choppers + SPRITE.state) + i * SPRITE.SIZE) !== 0) { // state != 0 (0x18734)
      W32((missileTarget + SPRITE.counter2), R32((choppers + SPRITE.counter1) + i * SPRITE.SIZE)); // 0x4608c.counter_2 = counter_1
    }
  }

  // 0x1874f..0x18800: sprites 0x3d86c + i*0x18c, i = 0..2
  for (i = 0; i < 3; i++) {
    if (R32(missileTarget) > R32(cropDusters + i * SPRITE.SIZE) && // X > x (0x1877b jle)
        ((R32(cropDusters + i * SPRITE.SIZE) + R32((cropDusters + SPRITE.width) + i * SPRITE.SIZE)) | 0) > R32(missileTarget) && // x + width > X (0x1879d jg)
        R32((missileTarget + SPRITE.y)) > R32((cropDusters + SPRITE.y) + i * SPRITE.SIZE) && // Y > y (0x187b4 jg)
        ((R32((cropDusters + SPRITE.y) + i * SPRITE.SIZE) + R32((cropDusters + SPRITE.height) + i * SPRITE.SIZE)) | 0) > R32((missileTarget + SPRITE.y)) && // y + height > Y (0x187d8 jg)
        R32((cropDusters + SPRITE.state) + i * SPRITE.SIZE) !== 0) { // state != 0 (0x187ea)
      W32((missileTarget + SPRITE.counter2), R32((cropDusters + SPRITE.counter1) + i * SPRITE.SIZE)); // 0x4608c.counter_2 = counter_1
    }
  }

  // 0x18805..0x188b6: sprite 0x3d0b0 + i*0x18c, i = 0 only
  for (i = 0; i < 1; i++) {
    if (R32(missileTarget) > R32(a10Jets + i * SPRITE.SIZE) && // X > x (0x18831 jle)
        ((R32(a10Jets + i * SPRITE.SIZE) + R32((a10Jets + SPRITE.width) + i * SPRITE.SIZE)) | 0) > R32(missileTarget) && // x + width > X (0x18853 jg)
        R32((missileTarget + SPRITE.y)) > R32((a10Jets + SPRITE.y) + i * SPRITE.SIZE) && // Y > y (0x1886a jg)
        ((R32((a10Jets + SPRITE.y) + i * SPRITE.SIZE) + R32((a10Jets + SPRITE.height) + i * SPRITE.SIZE)) | 0) > R32((missileTarget + SPRITE.y)) && // y + height > Y (0x1888e jg)
        R32((a10Jets + SPRITE.state) + i * SPRITE.SIZE) !== 0) { // state != 0 (0x188a0)
      W32((missileTarget + SPRITE.counter2), R32((a10Jets + SPRITE.counter1) + i * SPRITE.SIZE)); // 0x4608c.counter_2 = counter_1
    }
  }

  // 0x188bb..0x1893e: sprite 0x5fc04
  if (((R32(cruiseMissile) - 3) | 0) < R32(missileTarget) && // x - 3 < X (0x188c9 jge)
      ((R32(cruiseMissile) + R32((cruiseMissile + SPRITE.width)) + 3) | 0) > R32(missileTarget) && // x + width + 3 > X (0x188df jg)
      ((R32((cruiseMissile + SPRITE.y)) - 3) | 0) < R32((missileTarget + SPRITE.y)) && // y - 3 < Y (0x188f1 jl)
      ((R32((cruiseMissile + SPRITE.y)) + R32((cruiseMissile + SPRITE.height)) + 3) | 0) > R32((missileTarget + SPRITE.y)) && // y + height + 3 > Y (0x18909 jg)
      R32((cruiseMissile + SPRITE.state)) !== 0) { // state != 0 (0x18914)
    if (R32((cruiseMissile + SPRITE.state)) === 0x46) {
      W32((missileTarget + SPRITE.counter2), 5);
    }
    if (R32((cruiseMissile + SPRITE.state)) === 0x45) {
      W32((missileTarget + SPRITE.counter2), -5);
    }
    W32((missileTarget + SPRITE.counter3), 3); // 0x4608c.counter_3
  }

  // 0x18948..0x1897a
  W32(missile, R32(rasta)); // 0x45f00.x = 0x33dbc.x
  W32((missile + SPRITE.y), R32((rasta + SPRITE.y))); // 0x45f00.y = 0x33dbc.y
  W32((missile + SPRITE.state), 1); // 0x45f00.state
  W32((missileTarget + SPRITE.state), 1); // 0x4608c.state
  W32((missile + SPRITE.counter1), 7); // 0x45f00.counter_1
  W32((missile + SPRITE.threshold3), 0x96); // 0x45f00.threshold_3

  // 0x18984: switch on 0x33dbc.curr_frame; dispatch 0x18a0f..0x18a4d (compiler compare tree, unsigned jb/jbe/je;
  // only the listed values reach a case body, everything else jumps to 0x18a0d -> exit)
  sw = R32((rasta + SPRITE.currFrame));
  switch (sw) {
    case 0x15: // 0x18991
      W32((missile + SPRITE.currFrame), 2); // 0x45f00.curr_frame
      W32(missile, (R32(rasta) + 10) | 0);
      break;
    case 0x17: // 0x189ad
      W32((missile + SPRITE.currFrame), 3);
      W32(missile, (R32(rasta) + 0xf) | 0);
      break;
    case 0x19: // 0x189c9
      W32((missile + SPRITE.currFrame), 1);
      break;
    case 0x1d: // 0x189d8
      W32((missile + SPRITE.currFrame), 0);
      W32((missile + SPRITE.y), (R32((rasta + SPRITE.y)) + 7) | 0);
      break;
    case 0x1b: // 0x189f4
      W32((missile + SPRITE.currFrame), 4);
      W32((missile + SPRITE.y), (R32((rasta + SPRITE.y)) + 7) | 0);
      break;
  }
});
