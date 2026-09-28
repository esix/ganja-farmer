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

register(0x1864d, 'sub_1864d', function sub_1864d() {
  let i; // [ebp-4]
  let sw; // [ebp-8]: switch operand

  W32(0x4608c, R32(0x33aa4)); // 0x4608c.x = 0x33aa4.x
  W32(0x46090, R32(0x33aa8)); // 0x4608c.y = 0x33aa4.y
  W32(0x460a0, 0); // 0x4608c.counter_2
  W32(0x460a4, 0); // 0x4608c.counter_3

  // 0x1868d..0x1874a: sprites 0x33f48 + i*0x18c, i = 0..4
  for (i = 0; i < 5; i++) {
    if (((R32(0x33f48 + i * 0x18c) + 10) | 0) < R32(0x4608c) && // x + 10 < X      (0x186b6 jge)
        ((R32(0x33f48 + i * 0x18c) + R32(0x33f50 + i * 0x18c) - 10) | 0) > R32(0x4608c) && // x + width - 10 > X (0x186e1 jg)
        ((R32(0x33f4c + i * 0x18c) + R32(0x33f54 + i * 0x18c) - 5) | 0) > R32(0x46090) && // y + height - 5 > Y (0x18708 jg)
        ((R32(0x33f4c + i * 0x18c) + 5) | 0) < R32(0x46090) && // y + 5 < Y        (0x18722 jl)
        R32(0x340b8 + i * 0x18c) !== 0) { // state != 0 (0x18734)
      W32(0x460a0, R32(0x33f58 + i * 0x18c)); // 0x4608c.counter_2 = counter_1
    }
  }

  // 0x1874f..0x18800: sprites 0x3d86c + i*0x18c, i = 0..2
  for (i = 0; i < 3; i++) {
    if (R32(0x4608c) > R32(0x3d86c + i * 0x18c) && // X > x (0x1877b jle)
        ((R32(0x3d86c + i * 0x18c) + R32(0x3d874 + i * 0x18c)) | 0) > R32(0x4608c) && // x + width > X (0x1879d jg)
        R32(0x46090) > R32(0x3d870 + i * 0x18c) && // Y > y (0x187b4 jg)
        ((R32(0x3d870 + i * 0x18c) + R32(0x3d878 + i * 0x18c)) | 0) > R32(0x46090) && // y + height > Y (0x187d8 jg)
        R32(0x3d9dc + i * 0x18c) !== 0) { // state != 0 (0x187ea)
      W32(0x460a0, R32(0x3d87c + i * 0x18c)); // 0x4608c.counter_2 = counter_1
    }
  }

  // 0x18805..0x188b6: sprite 0x3d0b0 + i*0x18c, i = 0 only
  for (i = 0; i < 1; i++) {
    if (R32(0x4608c) > R32(0x3d0b0 + i * 0x18c) && // X > x (0x18831 jle)
        ((R32(0x3d0b0 + i * 0x18c) + R32(0x3d0b8 + i * 0x18c)) | 0) > R32(0x4608c) && // x + width > X (0x18853 jg)
        R32(0x46090) > R32(0x3d0b4 + i * 0x18c) && // Y > y (0x1886a jg)
        ((R32(0x3d0b4 + i * 0x18c) + R32(0x3d0bc + i * 0x18c)) | 0) > R32(0x46090) && // y + height > Y (0x1888e jg)
        R32(0x3d220 + i * 0x18c) !== 0) { // state != 0 (0x188a0)
      W32(0x460a0, R32(0x3d0c0 + i * 0x18c)); // 0x4608c.counter_2 = counter_1
    }
  }

  // 0x188bb..0x1893e: sprite 0x5fc04
  if (((R32(0x5fc04) - 3) | 0) < R32(0x4608c) && // x - 3 < X (0x188c9 jge)
      ((R32(0x5fc04) + R32(0x5fc0c) + 3) | 0) > R32(0x4608c) && // x + width + 3 > X (0x188df jg)
      ((R32(0x5fc08) - 3) | 0) < R32(0x46090) && // y - 3 < Y (0x188f1 jl)
      ((R32(0x5fc08) + R32(0x5fc10) + 3) | 0) > R32(0x46090) && // y + height + 3 > Y (0x18909 jg)
      R32(0x5fd74) !== 0) { // state != 0 (0x18914)
    if (R32(0x5fd74) === 0x46) {
      W32(0x460a0, 5);
    }
    if (R32(0x5fd74) === 0x45) {
      W32(0x460a0, -5);
    }
    W32(0x460a4, 3); // 0x4608c.counter_3
  }

  // 0x18948..0x1897a
  W32(0x45f00, R32(0x33dbc)); // 0x45f00.x = 0x33dbc.x
  W32(0x45f04, R32(0x33dc0)); // 0x45f00.y = 0x33dbc.y
  W32(0x46070, 1); // 0x45f00.state
  W32(0x461fc, 1); // 0x4608c.state
  W32(0x45f10, 7); // 0x45f00.counter_1
  W32(0x45f24, 0x96); // 0x45f00.threshold_3

  // 0x18984: switch on 0x33dbc.curr_frame; dispatch 0x18a0f..0x18a4d (compiler compare tree, unsigned jb/jbe/je;
  // only the listed values reach a case body, everything else jumps to 0x18a0d -> exit)
  sw = R32(0x33f24);
  switch (sw) {
    case 0x15: // 0x18991
      W32(0x46068, 2); // 0x45f00.curr_frame
      W32(0x45f00, (R32(0x33dbc) + 10) | 0);
      break;
    case 0x17: // 0x189ad
      W32(0x46068, 3);
      W32(0x45f00, (R32(0x33dbc) + 0xf) | 0);
      break;
    case 0x19: // 0x189c9
      W32(0x46068, 1);
      break;
    case 0x1d: // 0x189d8
      W32(0x46068, 0);
      W32(0x45f04, (R32(0x33dc0) + 7) | 0);
      break;
    case 0x1b: // 0x189f4
      W32(0x46068, 4);
      W32(0x45f04, (R32(0x33dc0) + 7) | 0);
      break;
  }
});
