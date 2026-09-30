// 0x15c7d  void updateLevelProgress(void)   [Watcom, no args, no return value]
// Size 0x198 bytes (0x15c7d..0x15e14 RET).
// Args: none — the body reads no incoming register (EAX is written before its only reads, the dead
// `mov eax,[ebp-8]` loads); EBX/ECX/EDX/ESI/EDI/EBP are saved/restored (0x15c87..0x15c8c / 0x15e0e..0x15e13).
// signatures.json: regs 0, stack 0.
// Return: none — EAX at the RET is a leftover (loop dead load / imul / callee result); the only call site
// (0x1dfd9, in 0x1aa02's loop) is followed by `cmp dword [0x60bc0], 1` at 0x1dfde, which does not read EAX.
// Summary (facts from the disassembly):
//   [0x30bf0] -= 1; if [0x30bf0] < 0 (signed, jge) then [0x60bbc] = 1.
//   If [0x60bbc] != 0: flag = 1 unless any dword in these 0x18c-stride lists is nonzero:
//     5 x [0x340b8], 3 x [0x3d9dc], 4 x [0x3d3ac], 1 x [0x3d220], 25 x [0x35c90], 25 x [0x3833c]
//   (same bases and counts as six of the lists clearEnemies zeroes — 1a825 also writes others; see 1a825_sub_1a825.js);
//   if [0x30bf0] < -0x21c (signed, jge) call clearEnemies();
//   if flag: runLevelEndSequence(); [0x30bec] += 1; [0x30bf0] = 0x438; [0x60bbc] = 0.
// 0x30bf0, 0x60bbc, 0x30bec: address only.
// Frame (sub esp,8): [ebp-4] flag, [ebp-8] i (loop counter). No address is taken and each is written before
// it is read, so they are plain locals. No out-of-bounds indexing (constant loop bounds).
// All dword comparisons signed (jge). No x87 instructions. No busy-wait loop (all loops have constant bounds).
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';
import { A10_JET, BOMB, CHOPPER, CROP_DUSTER, GROUND_TROOP, PARATROOPER } from './states.js';
import { a10Jets, bombs, choppers, cropDusters, groundTroops, paratroopers } from './data.js';
import { G, sprite } from './access.js';

register(0x15c7d, 'updateLevelProgress_15c7d', async function updateLevelProgress() {
  let flag; // [ebp-4]
  let i;    // [ebp-8]

  flag = 1;                                                                   // 0x15c95
  G.levelTimer = (G.levelTimer - 1) | 0;                                       // 0x15c9c dec dword
  if (G.levelTimer < 0) {                                                     // 0x15ca2..0x15ca9 (jge: signed)
    G.levelEnding = 1;                                                          // 0x15cab
  }
  if (G.levelEnding !== 0) {                                                   // 0x15cb5..0x15cbc
    // 0x15cc2..0x15cee (mov eax,[ebp-8] at 0x15ccb is a dead load, same in every loop below)
    for (i = 0; i < 5; i++) {
      if (sprite(choppers, i).state !== CHOPPER.INACTIVE) {                   // 0x15cd7..0x15ce5
        flag = 0;                                                             // 0x15ce7
      }
    }
    for (i = 0; i < 3; i++) {                                                 // 0x15cf0..0x15d1c
      if (sprite(cropDusters, i).state !== CROP_DUSTER.INACTIVE) {
        flag = 0;
      }
    }
    for (i = 0; i < 4; i++) {                                                 // 0x15d1e..0x15d4a
      if (sprite(bombs, i).state !== BOMB.INACTIVE) {
        flag = 0;
      }
    }
    for (i = 0; i < 1; i++) {                                                 // 0x15d4c..0x15d78
      if (sprite(a10Jets, i).state !== A10_JET.INACTIVE) {
        flag = 0;
      }
    }
    for (i = 0; i < 0x19; i++) {                                              // 0x15d7a..0x15da6
      if (sprite(paratroopers, i).state !== PARATROOPER.INACTIVE) {
        flag = 0;
      }
    }
    for (i = 0; i < 0x19; i++) {                                              // 0x15da8..0x15dd4
      if (sprite(groundTroops, i).state !== GROUND_TROOP.INACTIVE) {
        flag = 0;
      }
    }
    if (G.levelTimer < -0x21c) {                                              // 0x15dd6..0x15de0 (0xfffffde4, jge: signed)
      F.clearEnemies_1a825();                                                    // 0x15de2
    }
    if (flag !== 0) {                                                         // 0x15de7..0x15deb
      await F.runLevelEndSequence_15e15();                                                    // 0x15ded
      G.level = (G.level + 1) | 0;                                   // 0x15df2 inc dword
      G.levelTimer = 0x438;                                                    // 0x15df8
      G.levelEnding = 0;                                                        // 0x15e02
    }
  }
});
