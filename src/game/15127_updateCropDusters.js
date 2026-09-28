// 0x15127  void updateCropDusters(void)   [Watcom, no args, no return value]
// Per-call update of the 3-entry sprite array at 0x3d86c (stride 0x18c; decompiled.c
// "Sprite_Init(&DAT_0003d86c + iStack_18 * 0x18c, 400, 0x6b, 0x48, 0x1c, ...)" in a 3-iteration loop, and
// 16c37_sub_16c37.js erases i*0x18c+0x3d86c for i<3 with Erase_Sprite_Clip).
// Field names from the sprite struct (LIBRARY.md), array S = 0x3d86c, index i:
//   0x3d86c x, 0x3d870 y, 0x3d87c counter_1, 0x3d880 counter_2, 0x3d884 counter_3,
//   0x3d9d4 curr_frame, 0x3d9dc state
// and of the 63-entry sprite array at 0x3de9c (see 1556a_sub_1556a.js header), index [0x60bac]:
//   0x3de9c x, 0x3dea0 y, 0x3e00c state
// (Only the struct offsets are cited; what counter_1/2/3 and state mean to the game is not claimed.)
// For each i in 0..2:
//   curr_frame++ with wrap: if counter_1 < 0: >1 -> 0; else: >3 -> 2.
//   if state != 0: x += counter_1; if x < -200 and counter_1 < 0: re-randomize x/counter_1 (arm B also sets curr_frame=2 at 0x152b9; counter_2=4);
//     then if [0x60bbc] != 0: state = 0, x = -200.
//   if state == 0: y = 0x6b; if [0x60bbc] == 0: state = 1; counter_2 = 4; re-randomize x/counter_1.
//   if state == 0x2d: counter_3--; if counter_3 <= 0: state = 1; else [0x60bac] = ([0x60bac]+1, >0x3e -> 0),
//     and entry [0x60bac] of 0x3de9c gets state = 1, x = S.x + 0x19, y = S.y + 0xf.
//   if state == 1 and rand()%75 == 4 and -20 < x < 320: state = 0x2d, counter_3 = rand()%63.
// Return value: none. EAX at RET (0x15569) is a leftover; the only call site (0x1d662) is followed by
// `call 0x1556a` (no register args, signatures.json regs 0); signatures.json returns=false.
// All `% n` are `cdq; idiv` remainders (imod, sign of the dividend). No x87 instructions.
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';
import { imod } from '../runtime/cpu.js';
import { SPRITE, cropDusters, dusterSpray, dusterSprayNext, levelEnding } from './data.js';

register(0x15127, 'updateCropDusters_15127', function updateCropDusters() {
  let i; // [ebp-4]
  let o; // i * 0x18c (imul eax/edx, [ebp-4], 0x18c — recomputed from [ebp-4] each time in the original)
  let k; // [0x60bac] * 0x18c, recomputed from memory at each use as the binary does (15471, 15495, 154b5)

  i = 0;                                                            // 1513f
  for (i = 0; i < 3; i++) {                                         // 15146..15159, 1514f..15152
    o = Math.imul(i, SPRITE.SIZE);
    if (R32((cropDusters + SPRITE.counter1) + o) < 0) {                                     // 15166: cmp ..,0; jge 15198
      W32((cropDusters + SPRITE.currFrame) + o, (R32((cropDusters + SPRITE.currFrame) + o) + 1) | 0);                 // 15176: inc
      if (R32((cropDusters + SPRITE.currFrame) + o) > 1) {                                   // 1517c: cmp ..,1; jle
        W32((cropDusters + SPRITE.currFrame) + o, 0);                                        // 1518c
      }
    } else {
      W32((cropDusters + SPRITE.currFrame) + o, (R32((cropDusters + SPRITE.currFrame) + o) + 1) | 0);                 // 1519f: inc
      if (R32((cropDusters + SPRITE.currFrame) + o) > 3) {                                   // 151a5: cmp ..,3; jle
        W32((cropDusters + SPRITE.currFrame) + o, 2);                                        // 151b5
      }
    }

    if (R32((cropDusters + SPRITE.state) + o) !== 0) {                                   // 151c6: cmp ..,0; je 15328
      W32(cropDusters + o, (R32(cropDusters + o) + R32((cropDusters + SPRITE.counter1) + o)) | 0);  // 151e1..151e7: add
      if (R32(cropDusters + o) < -200 && R32((cropDusters + SPRITE.counter1) + o) < 0) {        // 151f4: jge ->skip; 15207: jl 15215
        if (imod(F.rand_232c7(), 3) === 1) {                  // 15215..1522b
          W32(cropDusters + o, (imod(F.rand_232c7(), 500) + 0x190) | 0);   // 1522d..1524d
          W32((cropDusters + SPRITE.counter1) + o, (-2 - imod(F.rand_232c7(), 2)) | 0);         // 15253..15276
          W32((cropDusters + SPRITE.counter2) + o, 4);                                                // 15283
        } else {
          W32((cropDusters + SPRITE.counter1) + o, (imod(F.rand_232c7(), 2) + 2) | 0);          // 1528f..152ac
          W32((cropDusters + SPRITE.currFrame) + o, 2);                                                // 152b9
          W32(cropDusters + o, (-100 - imod(F.rand_232c7(), 500)) | 0);     // 152c3..152e6
          W32((cropDusters + SPRITE.counter2) + o, 4);                                                // 152f3
        }
        if (R32(levelEnding) !== 0) {                                   // 152fd: cmp [0x60bbc],0; je 15328
          W32((cropDusters + SPRITE.state) + o, 0);                                      // 1530d
          W32(cropDusters + o, -200);                                   // 1531e: 0xffffff38
        }
      }
    }

    if (R32((cropDusters + SPRITE.state) + o) === 0) {                                   // 1532f: cmp ..,0; jne 1542e
      W32((cropDusters + SPRITE.y) + o, 0x6b);                                       // 15343
      if (R32(levelEnding) === 0) {                                     // 1534d: jne 15367
        W32((cropDusters + SPRITE.state) + o, 1);                                        // 1535d
      }
      W32((cropDusters + SPRITE.counter2) + o, 4);                                          // 1536e
      if (imod(F.rand_232c7(), 3) === 1) {                    // 15378..1538e
        W32(cropDusters + o, (imod(F.rand_232c7(), 500) + 0x190) | 0);     // 15390..153b1
        W32((cropDusters + SPRITE.counter1) + o, (-2 - imod(F.rand_232c7(), 2)) | 0);           // 153b7..153da
      } else {
        W32(cropDusters + o, (-100 - imod(F.rand_232c7(), 500)) | 0);       // 153e2..15403
        W32((cropDusters + SPRITE.counter1) + o, (imod(F.rand_232c7(), 2) + 2) | 0);            // 15409..15428
      }
    }

    if (R32((cropDusters + SPRITE.state) + o) === 0x2d) {                                // 15435: cmp ..,0x2d; jne 154d8
      W32((cropDusters + SPRITE.counter3) + o, (R32((cropDusters + SPRITE.counter3) + o) - 1) | 0);                 // 15449: dec
      if (R32((cropDusters + SPRITE.counter3) + o) > 0) {                                   // 1544f: cmp ..,0; jle 154c7
        W32(dusterSprayNext, (R32(dusterSprayNext) + 1) | 0);                       // 15458: inc [0x60bac]
        if (R32(dusterSprayNext) > 0x3e) {                                  // 1545e: cmp ..,0x3e; jle
          W32(dusterSprayNext, 0);                                          // 15467
        }
        k = Math.imul(R32(dusterSprayNext), SPRITE.SIZE);                          // 15471: imul [0x60bac]
        W32((dusterSpray + SPRITE.state) + k, 1);                                        // 1547b
        k = Math.imul(R32(dusterSprayNext), SPRITE.SIZE);                          // 15495: re-read [0x60bac] (store above may alias it)
        W32(dusterSpray + k, (R32(cropDusters + o) + 0x19) | 0);            // 1548c..1549f
        k = Math.imul(R32(dusterSprayNext), SPRITE.SIZE);
        W32((dusterSpray + SPRITE.y) + k, (R32((cropDusters + SPRITE.y) + o) + 0xf) | 0);             // 154ac..154bf
      } else {
        W32((cropDusters + SPRITE.state) + o, 1);                                        // 154ce
      }
    }

    // 154df..15525: short-circuit chain; rand() is called only when state == 1.
    if (R32((cropDusters + SPRITE.state) + o) === 1 &&
        imod(F.rand_232c7(), 0x4b) === 4 &&                   // 154e8..154fe
        R32(cropDusters + o) > -0x14 &&                                 // 15509: cmp ..,-0x14; jg
        R32(cropDusters + o) < 0x140) {                                 // 1551b: cmp ..,0x140; jl
      W32((cropDusters + SPRITE.state) + o, 0x2d);                                       // 15530
      W32((cropDusters + SPRITE.counter3) + o, imod(F.rand_232c7(), 0x3f));           // 1553a..15556
    }
  }
});
