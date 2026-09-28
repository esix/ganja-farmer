// 0x19ade  void sub_19ade(void)   [Watcom, no args, no return value]
// Args: none — EBX/ECX/EDX/ESI/EDI are pushed at 0x19ae8..0x19aec and popped at 0x1a81f..0x1a823, and
// EAX/EDX/EBX/ECX/ESI are written before any read. Single call site 0x1d67b.
// Return: none — EAX at the RET (0x1a824) is the leftover `mov eax,[ebp-0xc]` of 0x19b06 (199); the caller
// 0x1d67b is followed by `call 0x18a58`, which takes no register args (signatures.json regs 0), so EAX is
// never read; signatures.json has returns=false.
// Locals: [ebp-0xc] i (0..199), [ebp-8] j, [ebp-4] k — only used as loop counters, their addresses are never
// taken, so they are plain JS locals.
//
// All structs touched here are sprite structs (stride 0x18c, field names LIBRARY.md "sprite"); each base
// address is passed to Sprite_Init in main 0x1aa02 (decompiled.c): 0x4c518 (200 of them), 0x33f48 (5),
// 0x3d23c, 0x3d0b0, 0x3d86c (3), 0x35b20 (25), 0x5fc04 and 0x4c38c (single).
//
// For each i in 0..199 whose sprite 0x4c518[i] has state == 1 it moves it (x += counter_1; y -= or +=
// counter_2; plus rand()%5-2 / rand()%3-1), sets its state to 0 when x > 320, x < -10 or y < 0, and then
// runs rectangle overlap tests against the other sprite groups; on a hit it changes fields of both
// sprites, calls dws_DDiscard / dws_DPlay with the dws_DPLAY structs at 0x61260/0x61280/0x612a0/0x612c0/
// 0x612e0/0x61320 (their +0xA soundnum word, LIBRARY.md), calls sub_1352c after writing [0x60b90],
// [0x60b94] and dword [0x60b58 + [0x60b8c]*4] = 0x33, and adds to [0x60a68] / increments [0x60a6c].
// Globals 0x60a68, 0x60a6c, 0x60b58, 0x60b90, 0x60b94, 0x60ee0: address only (sub_1352c reads 0x60b90 /
// 0x60b94 as the x / y it stores into sprite 0x34704[[0x60b8c]], see 1352c_sub_1352c.js).
// No x87 instructions, no address-taken locals.
import { F, register } from '../runtime/registry.js';
import { R16, R32, W32 } from '../runtime/mem.js';
import { imod } from '../runtime/cpu.js';
import { DPLAY, SPRITE, a10Jets, bombs, bongSmoke, choppers, cropDusters, cruiseMissile, explosionDelays, explosionNext, explosionX, explosionY, kills, paratroopers, randomVoice, score, sndExplosion, sndParaDie1, sndParaDie2, sndParaDie3, sndParaDie5, sndRicochet, ufo } from './data.js';

register(0x19ade, 'sub_19ade', function sub_19ade() {
  let i = 0;                                                     // 0x19af6 (dead store)
  let j, k;
  for (i = 0; i < 0xc8; i++) {                                   // 0x19afd..0x19b13 (jge: signed)
    if (R32((bongSmoke + SPRITE.state) + i * SPRITE.SIZE) !== 1) continue;                // 0x19b19 state (+0x170) != 1 -> 0x1a817

    // 0x19b2d: x (+0x000) += counter_1 (+0x010)
    W32(bongSmoke + i * SPRITE.SIZE, (R32(bongSmoke + i * SPRITE.SIZE) + R32((bongSmoke + SPRITE.counter1) + i * SPRITE.SIZE)) | 0);
    // 0x19b47: cmp counter_2 (+0x014), 0; jg
    if (R32((bongSmoke + SPRITE.counter2) + i * SPRITE.SIZE) > 0) {
      // 0x19b73: y (+0x004) -= counter_2
      W32((bongSmoke + SPRITE.y) + i * SPRITE.SIZE, (R32((bongSmoke + SPRITE.y) + i * SPRITE.SIZE) - R32((bongSmoke + SPRITE.counter2) + i * SPRITE.SIZE)) | 0);
    } else {
      // 0x19b57: y += counter_2
      W32((bongSmoke + SPRITE.y) + i * SPRITE.SIZE, (R32((bongSmoke + SPRITE.y) + i * SPRITE.SIZE) + R32((bongSmoke + SPRITE.counter2) + i * SPRITE.SIZE)) | 0);
    }
    // 0x19b8d..0x19baa: x += rand() % 5 - 2 (cdq; idiv)
    {
      const r = imod(F.rand_232c7(), 5);
      W32(bongSmoke + i * SPRITE.SIZE, (R32(bongSmoke + i * SPRITE.SIZE) + ((r - 2) | 0)) | 0);
    }
    // 0x19bb0..0x19bcb: y += rand() % 3 - 1
    {
      const r = imod(F.rand_232c7(), 3);
      W32((bongSmoke + SPRITE.y) + i * SPRITE.SIZE, (R32((bongSmoke + SPRITE.y) + i * SPRITE.SIZE) + ((r - 1) | 0)) | 0);
    }
    // 0x19bd1..0x19c04: x > 0x140 || x < -10 || y < 0 -> state = 0 (0x19c06)
    if (R32(bongSmoke + i * SPRITE.SIZE) > 0x140 || R32(bongSmoke + i * SPRITE.SIZE) < -0xa ||
        R32((bongSmoke + SPRITE.y) + i * SPRITE.SIZE) < 0) {
      W32((bongSmoke + SPRITE.state) + i * SPRITE.SIZE, 0);
    }

    // 0x19c17: group 0x33f48, j = 0..4
    for (j = 0; j < 5; j++) {
      if (((R32(bongSmoke + i * SPRITE.SIZE) + 0xd) | 0) > ((R32(choppers + j * SPRITE.SIZE) + 0xa) | 0) &&            // 0x19c30
          ((((R32(choppers + j * SPRITE.SIZE) + R32((choppers + SPRITE.width) + j * SPRITE.SIZE)) | 0) - 0xa) | 0) > R32(bongSmoke + i * SPRITE.SIZE) &&  // 0x19c54
          ((((R32((choppers + SPRITE.y) + j * SPRITE.SIZE) + R32((choppers + SPRITE.height) + j * SPRITE.SIZE)) | 0) - 5) | 0) > R32((bongSmoke + SPRITE.y) + i * SPRITE.SIZE) &&    // 0x19c84
          ((R32((bongSmoke + SPRITE.y) + i * SPRITE.SIZE) + 8) | 0) > ((R32((choppers + SPRITE.y) + j * SPRITE.SIZE) + 5) | 0)) {                   // 0x19cb4
        // 0x19cda: counter_2 (+0x014) of 0x33f48[j] -= 1
        W32((choppers + SPRITE.counter2) + j * SPRITE.SIZE, (R32((choppers + SPRITE.counter2) + j * SPRITE.SIZE) - 1) | 0);
        W32((bongSmoke + SPRITE.state) + i * SPRITE.SIZE, 0);                                   // 0x19ce7
        F.dws_DDiscard_1f770(R16((sndRicochet + DPLAY.soundnum)));                      // 0x19cf8
        F.dws_DPlay_1eff8(sndRicochet);                              // 0x19d09
      }
    }

    // 0x19d1c: group 0x3d23c, j = 0..3
    for (j = 0; j < 4; j++) {
      if (((R32(bongSmoke + i * SPRITE.SIZE) + 0xd) | 0) > R32(bombs + j * SPRITE.SIZE) &&                            // 0x19d35
          ((R32(bombs + j * SPRITE.SIZE) + R32((bombs + SPRITE.width) + j * SPRITE.SIZE)) | 0) > R32(bongSmoke + i * SPRITE.SIZE) &&      // 0x19d54
          ((R32((bongSmoke + SPRITE.y) + i * SPRITE.SIZE) + 8) | 0) > R32((bombs + SPRITE.y) + j * SPRITE.SIZE) &&                             // 0x19d81
          ((R32((bombs + SPRITE.y) + j * SPRITE.SIZE) + R32((bombs + SPRITE.height) + j * SPRITE.SIZE)) | 0) > R32((bongSmoke + SPRITE.y) + i * SPRITE.SIZE) &&      // 0x19da2
          R32((bombs + SPRITE.state) + j * SPRITE.SIZE) === 1) {                                                              // 0x19dcf
        W32((bombs + SPRITE.state) + j * SPRITE.SIZE, 0);                                   // 0x19de4 state = 0
        W32(explosionX, (R32(bombs + j * SPRITE.SIZE) - 0xc) | 0);            // 0x19df5
        W32(explosionY, (R32((bombs + SPRITE.y) + j * SPRITE.SIZE) - 0x16) | 0);           // 0x19e0a
        W32(((R32(explosionNext) << 2) + explosionDelays) | 0, 0x33);                // 0x19e1f
        F.sub_1352c();                                           // 0x19e31
        W32((bongSmoke + SPRITE.state) + i * SPRITE.SIZE, 0);                                   // 0x19e36
        F.dws_DDiscard_1f770(R16((sndExplosion + DPLAY.soundnum)));                      // 0x19e47
        F.dws_DPlay_1eff8(sndExplosion);                              // 0x19e58
        W32(score, (R32(score) + 0x1f5) | 0);                      // 0x19e66
        W32(kills, (R32(kills) + 1) | 0);                          // 0x19e70
      }
    }

    // 0x19e7b: single sprite 0x5fc04
    if (((R32(bongSmoke + i * SPRITE.SIZE) + 0xd) | 0) > R32(cruiseMissile) &&                                         // 0x19e7b
        ((R32(cruiseMissile) + R32((cruiseMissile + SPRITE.width))) | 0) > R32(bongSmoke + i * SPRITE.SIZE) &&                                // 0x19e93
        ((R32((bongSmoke + SPRITE.y) + i * SPRITE.SIZE) + 8) | 0) > R32((cruiseMissile + SPRITE.y)) &&                                           // 0x19eaf
        ((R32((cruiseMissile + SPRITE.y)) + R32((cruiseMissile + SPRITE.height))) | 0) > R32((bongSmoke + SPRITE.y) + i * SPRITE.SIZE) &&                                // 0x19ec9
        R32((cruiseMissile + SPRITE.state)) !== 0) {                                                                            // 0x19ee5
      W32((cruiseMissile + SPRITE.state), 0);                                                 // 0x19ef0 state = 0
      W32(explosionX, (R32(cruiseMissile) - 0xc) | 0);                          // 0x19efa
      W32(explosionY, (R32((cruiseMissile + SPRITE.y)) - 0x16) | 0);                         // 0x19f07
      W32(((R32(explosionNext) << 2) + explosionDelays) | 0, 0x33);                  // 0x19f14
      F.sub_1352c();                                             // 0x19f26
      W32((bongSmoke + SPRITE.state) + i * SPRITE.SIZE, 0);                                     // 0x19f2b
      F.dws_DDiscard_1f770(R16((sndExplosion + DPLAY.soundnum)));                        // 0x19f3c
      F.dws_DPlay_1eff8(sndExplosion);                                // 0x19f4d
      W32(score, (R32(score) + 0x7d1) | 0);                        // 0x19f5b
      W32(kills, (R32(kills) + 1) | 0);                            // 0x19f65
    }

    // 0x19f6b: group 0x3d0b0, k = 0..0
    for (k = 0; k < 1; k++) {
      if (((R32(bongSmoke + i * SPRITE.SIZE) + 0xd) | 0) > R32(a10Jets + k * SPRITE.SIZE) &&                            // 0x19f84
          ((R32(a10Jets + k * SPRITE.SIZE) + R32((a10Jets + SPRITE.width) + k * SPRITE.SIZE)) | 0) > R32(bongSmoke + i * SPRITE.SIZE) &&      // 0x19fa3
          ((R32((bongSmoke + SPRITE.y) + i * SPRITE.SIZE) + 8) | 0) > R32((a10Jets + SPRITE.y) + k * SPRITE.SIZE) &&                             // 0x19fd0
          ((R32((a10Jets + SPRITE.y) + k * SPRITE.SIZE) + R32((a10Jets + SPRITE.height) + k * SPRITE.SIZE)) | 0) > R32((bongSmoke + SPRITE.y) + i * SPRITE.SIZE) &&      // 0x19ff1
          R32((a10Jets + SPRITE.state) + k * SPRITE.SIZE) !== 0) {                                                              // 0x1a01e
        // 0x1a030: threshold_1 (+0x01c) of 0x3d0b0[k] -= 1
        W32((a10Jets + SPRITE.threshold1) + k * SPRITE.SIZE, (R32((a10Jets + SPRITE.threshold1) + k * SPRITE.SIZE) - 1) | 0);
        W32((bongSmoke + SPRITE.state) + i * SPRITE.SIZE, 0);                                   // 0x1a03d
        F.dws_DDiscard_1f770(R16((sndRicochet + DPLAY.soundnum)));                      // 0x1a04e
        F.dws_DPlay_1eff8(sndRicochet);                              // 0x1a05f
      }
      // 0x1a06d: cmp threshold_1, 0; jge -> next k
      if (R32((a10Jets + SPRITE.threshold1) + k * SPRITE.SIZE) < 0) {
        W32((a10Jets + SPRITE.state) + k * SPRITE.SIZE, 0);                                   // 0x1a081 state = 0
        for (j = 0; j < 4; j++) {                                      // 0x1a092
          // 0x1a0ab..0x1a0cd: ecx = k*0x18c; rand() % 0x1e; x read after the call
          {
            const r = imod(F.rand_232c7(), 0x1e);
            W32(explosionX, (r + R32(a10Jets + k * SPRITE.SIZE)) | 0);
          }
          // 0x1a0d3..0x1a0f5
          {
            const r = imod(F.rand_232c7(), 0x14);
            W32(explosionY, (r + R32((a10Jets + SPRITE.y) + k * SPRITE.SIZE)) | 0);
          }
          W32(((R32(explosionNext) << 2) + explosionDelays) | 0, 0x33);              // 0x1a0fb
          F.sub_1352c();                                         // 0x1a10e
          F.dws_DDiscard_1f770(R16((sndExplosion + DPLAY.soundnum)));                    // 0x1a113
          F.dws_DPlay_1eff8(sndExplosion);                            // 0x1a125
        }
        W32(score, (R32(score) + 0x12c) | 0);                      // 0x1a138
        W32(kills, (R32(kills) + 1) | 0);                          // 0x1a142
      }
    }

    // 0x1a14d: group 0x3d86c, j = 0..2
    for (j = 0; j < 3; j++) {
      if (((R32(bongSmoke + i * SPRITE.SIZE) + 0xd) | 0) > R32(cropDusters + j * SPRITE.SIZE) &&                            // 0x1a166
          ((R32(cropDusters + j * SPRITE.SIZE) + R32((cropDusters + SPRITE.width) + j * SPRITE.SIZE)) | 0) > R32(bongSmoke + i * SPRITE.SIZE) &&      // 0x1a185
          ((R32((bongSmoke + SPRITE.y) + i * SPRITE.SIZE) + 8) | 0) > R32((cropDusters + SPRITE.y) + j * SPRITE.SIZE) &&                             // 0x1a1b2
          ((R32((cropDusters + SPRITE.y) + j * SPRITE.SIZE) + R32((cropDusters + SPRITE.height) + j * SPRITE.SIZE)) | 0) > R32((bongSmoke + SPRITE.y) + i * SPRITE.SIZE) &&      // 0x1a1d3
          R32((cropDusters + SPRITE.state) + j * SPRITE.SIZE) !== 0) {                                                              // 0x1a200
        // 0x1a215: counter_2 (+0x014) of 0x3d86c[j] -= 1
        W32((cropDusters + SPRITE.counter2) + j * SPRITE.SIZE, (R32((cropDusters + SPRITE.counter2) + j * SPRITE.SIZE) - 1) | 0);
        // 0x1a222..0x1a253: x += rand()%3 - rand()%3 (EBX kept across the second rand: rand saves only EDX
        // and 0x232c1, so EBX/ECX survive — they are plain locals here)
        {
          let b = imod(F.rand_232c7(), 3);
          const r2 = imod(F.rand_232c7(), 3);
          b = (b - r2) | 0;
          W32(cropDusters + j * SPRITE.SIZE, (R32(cropDusters + j * SPRITE.SIZE) + b) | 0);
        }
        // 0x1a259..0x1a28a: y += rand()%3 - rand()%3
        {
          let b = imod(F.rand_232c7(), 3);
          const r2 = imod(F.rand_232c7(), 3);
          b = (b - r2) | 0;
          W32((cropDusters + SPRITE.y) + j * SPRITE.SIZE, (R32((cropDusters + SPRITE.y) + j * SPRITE.SIZE) + b) | 0);
        }
        W32((bongSmoke + SPRITE.state) + i * SPRITE.SIZE, 0);                                   // 0x1a290
        F.dws_DDiscard_1f770(R16((sndRicochet + DPLAY.soundnum)));                      // 0x1a2a1
        F.dws_DPlay_1eff8(sndRicochet);                              // 0x1a2b3
      }
      // 0x1a2c1: cmp counter_2, 0; jge -> next j
      if (R32((cropDusters + SPRITE.counter2) + j * SPRITE.SIZE) < 0) {
        W32((cropDusters + SPRITE.state) + j * SPRITE.SIZE, 0);                                   // 0x1a2d5 state = 0
        W32(explosionX, (R32(cropDusters + j * SPRITE.SIZE) - 0xc) | 0);            // 0x1a2e6
        W32(explosionY, (R32((cropDusters + SPRITE.y) + j * SPRITE.SIZE) - 0x16) | 0);           // 0x1a2fb
        W32(((R32(explosionNext) << 2) + explosionDelays) | 0, 0x33);                // 0x1a310
        F.sub_1352c();                                           // 0x1a322
        F.dws_DDiscard_1f770(R16((sndExplosion + DPLAY.soundnum)));                      // 0x1a327
        F.dws_DPlay_1eff8(sndExplosion);                              // 0x1a338
        W32(score, (R32(score) + 0x64) | 0);                       // 0x1a346
        W32(kills, (R32(kills) + 1) | 0);                          // 0x1a34d
      }
    }

    // 0x1a358: group 0x35b20, j = 0..24
    for (j = 0; j < 0x19; j++) {
      // first test (0x1a371..0x1a428)
      if (((R32(bongSmoke + i * SPRITE.SIZE) + R32((bongSmoke + SPRITE.width) + i * SPRITE.SIZE)) | 0) > R32(paratroopers + j * SPRITE.SIZE) &&      // 0x1a371
          ((R32(paratroopers + j * SPRITE.SIZE) + R32((paratroopers + SPRITE.width) + j * SPRITE.SIZE)) | 0) > R32(bongSmoke + i * SPRITE.SIZE) &&      // 0x1a39c
          R32((bongSmoke + SPRITE.y) + i * SPRITE.SIZE) > R32((paratroopers + SPRITE.y) + j * SPRITE.SIZE) &&                                         // 0x1a3c9
          ((R32((paratroopers + SPRITE.y) + j * SPRITE.SIZE) + 0x11) | 0) > R32((bongSmoke + SPRITE.y) + i * SPRITE.SIZE) &&                          // 0x1a3e7
          (R32((paratroopers + SPRITE.state) + j * SPRITE.SIZE) === 0x1c || R32((paratroopers + SPRITE.state) + j * SPRITE.SIZE) === 0x1b)) {                    // 0x1a408
        W32((paratroopers + SPRITE.state) + j * SPRITE.SIZE, 0x21);                                // 0x1a42f state
        W32((paratroopers + SPRITE.counter2) + j * SPRITE.SIZE, 0);                                   // 0x1a440 counter_2
        W32((paratroopers + SPRITE.currFrame) + j * SPRITE.SIZE, 5);                                   // 0x1a451 curr_frame
        W32(randomVoice, imod(F.rand_232c7(), 3));                   // 0x1a462..0x1a475
        F.dws_DDiscard_1f770(R16((sndParaDie1 + DPLAY.soundnum)));                      // 0x1a47b
        F.dws_DDiscard_1f770(R16((sndParaDie2 + DPLAY.soundnum)));                      // 0x1a48d
        F.dws_DDiscard_1f770(R16((sndParaDie3 + DPLAY.soundnum)));                      // 0x1a49f
        if (R32(randomVoice) === 0) F.dws_DPlay_1eff8(sndParaDie1);      // 0x1a4b1
        if (R32(randomVoice) === 1) F.dws_DPlay_1eff8(sndParaDie2);      // 0x1a4c8
        if (R32(randomVoice) === 2) F.dws_DPlay_1eff8(sndParaDie3);      // 0x1a4df
        W32(score, (R32(score) + 0xf) | 0);                        // 0x1a4f6
        W32(kills, (R32(kills) + 1) | 0);                          // 0x1a4fd
      }
      // second test (0x1a503..0x1a5c9)
      if (((R32(bongSmoke + i * SPRITE.SIZE) + R32((bongSmoke + SPRITE.width) + i * SPRITE.SIZE)) | 0) > R32(paratroopers + j * SPRITE.SIZE) &&      // 0x1a503
          ((R32(paratroopers + j * SPRITE.SIZE) + R32((paratroopers + SPRITE.width) + j * SPRITE.SIZE)) | 0) > R32(bongSmoke + i * SPRITE.SIZE) &&      // 0x1a52e
          ((R32((paratroopers + SPRITE.y) + j * SPRITE.SIZE) + 0x11) | 0) < R32((bongSmoke + SPRITE.y) + i * SPRITE.SIZE) &&                          // 0x1a55b (jl)
          ((R32((paratroopers + SPRITE.y) + j * SPRITE.SIZE) + R32((paratroopers + SPRITE.height) + j * SPRITE.SIZE)) | 0) > R32((bongSmoke + SPRITE.y) + i * SPRITE.SIZE) &&      // 0x1a57c
          (R32((paratroopers + SPRITE.state) + j * SPRITE.SIZE) === 0x1c || R32((paratroopers + SPRITE.state) + j * SPRITE.SIZE) === 0x1b)) {                    // 0x1a5a9
        if (imod(F.rand_232c7(), 0xa) === 1) {                   // 0x1a5d0..0x1a5e6
          if (R32(paratroopers + j * SPRITE.SIZE) > 0xa0) {                       // 0x1a5e8 (jle: signed)
            W32((paratroopers + SPRITE.state) + j * SPRITE.SIZE, 2);                               // 0x1a5fb
          } else {
            W32((paratroopers + SPRITE.state) + j * SPRITE.SIZE, 3);                               // 0x1a60e
          }
          // 0x1a61f..0x1a63c: curr_frame = rand()%3 + 0x13
          W32((paratroopers + SPRITE.currFrame) + j * SPRITE.SIZE, (imod(F.rand_232c7(), 3) + 0x13) | 0);
        } else {
          W32((paratroopers + SPRITE.state) + j * SPRITE.SIZE, 4);                                 // 0x1a644
          W32((paratroopers + SPRITE.currFrame) + j * SPRITE.SIZE, 0x15);                              // 0x1a655
        }
        F.dws_DDiscard_1f770(R16((sndParaDie5 + DPLAY.soundnum)));                      // 0x1a666
        F.dws_DPlay_1eff8(sndParaDie5);                              // 0x1a677
        W32(score, (R32(score) + 0xb) | 0);                        // 0x1a685
        W32(kills, (R32(kills) + 1) | 0);                          // 0x1a68c
      }
    }

    // 0x1a697: single sprite 0x4c38c
    if (((R32(bongSmoke + i * SPRITE.SIZE) + R32((bongSmoke + SPRITE.width) + i * SPRITE.SIZE)) | 0) > R32(ufo) &&                    // 0x1a697
        ((R32(ufo) + R32((ufo + SPRITE.width))) | 0) > R32(bongSmoke + i * SPRITE.SIZE) &&                                // 0x1a6b9
        R32((bongSmoke + SPRITE.y) + i * SPRITE.SIZE) > R32((ufo + SPRITE.y)) &&                                                       // 0x1a6d5
        ((R32((ufo + SPRITE.y)) + R32((ufo + SPRITE.height))) | 0) > R32((bongSmoke + SPRITE.y) + i * SPRITE.SIZE) &&                                // 0x1a6ec
        R32((ufo + SPRITE.state)) !== 0) {                                                                            // 0x1a708
      W32((ufo + SPRITE.threshold2), (R32((ufo + SPRITE.threshold2)) - 2) | 0);                            // 0x1a713 threshold_2 (+0x020) -= 2
      W32((ufo + SPRITE.counter2), Math.imul(R32((ufo + SPRITE.counter2)), -1));                       // 0x1a71a counter_2 (+0x014) *= -1
      W32((bongSmoke + SPRITE.state) + i * SPRITE.SIZE, 0);                                     // 0x1a726
      F.dws_DDiscard_1f770(R16((sndRicochet + DPLAY.soundnum)));                        // 0x1a737
      F.dws_DPlay_1eff8(sndRicochet);                                // 0x1a748
    }
    // 0x1a756: threshold_2 > 0 or state == 0 -> 0x1a817
    if (!(R32((ufo + SPRITE.threshold2)) > 0) && R32((ufo + SPRITE.state)) !== 0) {
      W32((ufo + SPRITE.state), 0);                                                 // 0x1a76d state = 0
      for (j = 0; j < 4; j++) {                                        // 0x1a777
        // 0x1a78c..0x1a7a6: x read after the call, eax = x + rem
        {
          const r = imod(F.rand_232c7(), 0x1e);
          W32(explosionX, (R32(ufo) + r) | 0);
        }
        // 0x1a7ab..0x1a7c5
        {
          const r = imod(F.rand_232c7(), 0x14);
          W32(explosionY, (r + R32((ufo + SPRITE.y))) | 0);
        }
        W32(((R32(explosionNext) << 2) + explosionDelays) | 0, 0x33);                // 0x1a7cb
        F.sub_1352c();                                           // 0x1a7de
        F.dws_DDiscard_1f770(R16((sndExplosion + DPLAY.soundnum)));                      // 0x1a7e3
        F.dws_DPlay_1eff8(sndExplosion);                              // 0x1a7f4
      }
      W32(score, (R32(score) + 0x3e8) | 0);                        // 0x1a807
      W32(kills, (R32(kills) + 1) | 0);                            // 0x1a811
    }
  }                                                                    // 0x1a817 jmp 0x19b06
});
