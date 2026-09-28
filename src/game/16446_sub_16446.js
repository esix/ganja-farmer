// 0x16446  void sub_16446(void)   [Watcom, no args, no return value]
// Code 0x16446..0x16836 (RET), plus the 4-entry jump table at 0x1680c (0x16770, 0x167ab, 0x167cf, 0x167fd).
// 1. Switch on [0x30bec] (unsigned compare tree 0x16519..0x165a3):
//      5 -> [0x5fbe0] = 0; 10 -> 1; 15 -> 2; 20/25/30/35/40/45/50 -> 3; in these cases [0x45d98] is set to
//      0x41 unless it is 0x43. Any other value: if [0x45d98] != 0x41 and == 0x43, [0x45d98] = 0x42.
// 2. If state == 0x20 and [0x45d98] == 0x41: y = 0x14, then by rand()%2 either state 0x1c with
//    x = (-rand()) % 300, or state 0x1b with x = rand() % 300 + 0x140.
// 3. State 0x1c: x += 3; state 0x1b: x -= 3. When x passes a limit ([0x33dbc]) while [0x5fbe8] == 0 and
//    [0x45d98] == 0x41: [0x5fa78] = x + 0x1e, [0x5fa7c] = y + 0x32, [0x5fbe8] = 1, [0x45d98] = 0x43.
//    State becomes 0x20 when x > 0x154 (0x1c) or x + width + 0x28 < 0 (0x1b).
// 4. If [0x5fbe8] == 1: [0x5fa7c] += 3; when it exceeds [0x33dc0], [0x5fbe8] = 0 and a jump table on
//    [0x5fbe0] (unsigned > 3 -> nothing) sets globals and plays dws_DPlay(0x61440/0x61460/0x61480), or adds
//    0xa410 to [0x60a68].
// Evidence for names: 0x45d74 is a sprite struct — passed to Sprite_Init / Behind_Sprite_Clip /
// Draw_Sprite_Clip (decompiled.c lines 4518, 567, 601). Fields (LIBRARY.md sprite struct): 0x45d74 x (+0),
// 0x45d78 y (+4), 0x45d7c width (+8), 0x45ee4 state (+0x170).
// 0x61440 / 0x61460 / 0x61480: passed as the dws_DPLAY* argument of dws_DPlay (LIBRARY.md).
// Other globals (0x30bec, 0x45d98, 0x5fbe0, 0x5fbe8, 0x5fa78, 0x5fa7c, 0x33dbc, 0x33dc0, 0x60bb0, 0x60bb4,
// 0x60bb8, 0x60ee8, 0x60ef4, 0x33f2c, 0x33f24, 0x60a68) are referred to by address only.
// Return: EAX at RET is a leftover (a global / dws_DPlay result); signatures.json `returns` = false
// (1 caller) -> no return value (PORTING.md).
// No loops; no x87 instructions.
import { F, register } from '../runtime/registry.js';
import { R32, R32u, W32 } from '../runtime/mem.js';
import { imod } from '../runtime/cpu.js';

register(0x16446, 'sub_16446', function sub_16446() {
  let sel; // [ebp-4]
  let sel2; // [ebp-8]

  sel = R32u(0x30bec);                                                    // 1645e/16463
  // 16519..165a3: compare tree with unsigned jb/jbe on [ebp-4]
  switch (sel) {
    case 5:                                                               // 1646b
      if (R32(0x45d98) !== 0x43) {
        W32(0x45d98, 0x41);
      }
      W32(0x5fbe0, 0);
      break;
    case 10:                                                              // 1648d
      if (R32(0x45d98) !== 0x43) {
        W32(0x45d98, 0x41);
      }
      W32(0x5fbe0, 1);
      break;
    case 15:                                                              // 164af
      if (R32(0x45d98) !== 0x43) {
        W32(0x45d98, 0x41);
      }
      W32(0x5fbe0, 2);
      break;
    case 20:                                                              // 164d1
    case 25:
    case 30:
    case 35:
    case 40:
    case 45:
    case 50:
      if (R32(0x45d98) !== 0x43) {
        W32(0x45d98, 0x41);
      }
      W32(0x5fbe0, 3);
      break;
    default:                                                              // 164f3
      if (R32(0x45d98) === 0x41) {
        break;                                                            // 164fc
      }
      if (R32(0x45d98) === 0x43) {                                        // 16501
        W32(0x45d98, 0x42);
      }
      break;
  }

  if (R32(0x45ee4) === 0x20 && R32(0x45d98) === 0x41) {                   // 165a8..165b8
    W32(0x45d78, 0x14);                                                   // 165bc
    if (imod(F.rand_232c7(), 2) === 0) {                            // 165c6..165db
      W32(0x45ee4, 0x1c);                                                 // 165dd
      W32(0x45d74, imod(-(F.rand_232c7()) | 0, 0x12c));             // 165e7..165fc (neg; cdq; idiv)
    } else {
      W32(0x45ee4, 0x1b);                                                 // 16604
      W32(0x45d74, (imod(F.rand_232c7(), 0x12c) + 0x140) | 0);      // 1660e..16627
    }
  }

  if (R32(0x45ee4) === 0x1c) {                                            // 1662d
    W32(0x45d74, (R32(0x45d74) + 3) | 0);                                 // 1663a
    if (((R32(0x45d74) + 0x28) | 0) > R32(0x33dbc) && R32(0x5fbe8) === 0 && R32(0x45d98) === 0x41) { // 16641..16663 (jle / je / je)
      W32(0x5fa78, (R32(0x45d74) + 0x1e) | 0);                            // 16667
      W32(0x5fa7c, (R32(0x45d78) + 0x32) | 0);                            // 16674
      W32(0x5fbe8, 1);                                                    // 16681
      W32(0x45d98, 0x43);                                                 // 1668b
    }
    if (R32(0x45d74) > 0x154) {                                           // 16695 (jle)
      W32(0x45ee4, 0x20);                                                 // 166a1
    }
  }

  if (R32(0x45ee4) === 0x1b) {                                            // 166ab
    W32(0x45d74, (R32(0x45d74) - 3) | 0);                                 // 166b8
    if (((R32(0x45d74) + 0x28) | 0) < ((R32(0x33dbc) + 0xf) | 0) && R32(0x5fbe8) === 0 && R32(0x45d98) === 0x41) { // 166bf..166e6 (jge / je / je)
      W32(0x5fa78, (R32(0x45d74) + 0x1e) | 0);                            // 166ea
      W32(0x5fa7c, (R32(0x45d78) + 0x32) | 0);                            // 166f7
      W32(0x5fbe8, 1);                                                    // 16704
      W32(0x45d98, 0x43);                                                 // 1670e
    }
    if (((((R32(0x45d74) + R32(0x45d7c)) | 0) + 0x28) | 0) < 0) {         // 16718..16728 (test; jge)
      W32(0x45ee4, 0x20);                                                 // 1672a
    }
  }

  if (R32(0x5fbe8) === 1) {                                               // 16734
    W32(0x5fa7c, (R32(0x5fa7c) + 3) | 0);                                 // 16741
    if (R32(0x5fa7c) > R32(0x33dc0)) {                                    // 16748..16753 (jle)
      W32(0x5fbe8, 0);                                                    // 16759
      sel2 = R32(0x5fbe0);                                                // 16763/16768
      // 1681c..16828: cmp [ebp-8],3; ja 0x16809 (-> RET); jmp [eax*4 + 0x1680c]
      switch (sel2 >>> 0) {
        case 0:                                                           // 16770
          W32(0x60bb0, 1);
          W32(0x60ee8, 0x37);
          W32(0x33f2c, 1);
          W32(0x33f24, 0);
          F.dws_DPlay_1eff8(0x61440);                               // 16798..167a3 (cdecl, 1 stack arg)
          break;
        case 1:                                                           // 167ab
          W32(0x60bb4, 1);
          W32(0x60ee8, 0x35);
          F.dws_DPlay_1eff8(0x61460);                               // 167bf..167ca
          break;
        case 2:                                                           // 167cf
          W32(0x60bb8, 1);
          W32(0x60ee8, 0x38);
          W32(0x60ef4, 0x39);
          F.dws_DPlay_1eff8(0x61480);                               // 167ed..167f8
          break;
        case 3:                                                           // 167fd
          W32(0x60a68, (R32(0x60a68) + 0xa410) | 0);
          break;
        default:                                                          // 16809
          break;
      }
    }
  }
});
