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

register(0x19ade, 'sub_19ade', async function sub_19ade() {
  let i = 0;                                                     // 0x19af6 (dead store)
  let j, k;
  for (i = 0; i < 0xc8; i++) {                                   // 0x19afd..0x19b13 (jge: signed)
    if (R32(0x4c688 + i * 0x18c) !== 1) continue;                // 0x19b19 state (+0x170) != 1 -> 0x1a817

    // 0x19b2d: x (+0x000) += counter_1 (+0x010)
    W32(0x4c518 + i * 0x18c, (R32(0x4c518 + i * 0x18c) + R32(0x4c528 + i * 0x18c)) | 0);
    // 0x19b47: cmp counter_2 (+0x014), 0; jg
    if (R32(0x4c52c + i * 0x18c) > 0) {
      // 0x19b73: y (+0x004) -= counter_2
      W32(0x4c51c + i * 0x18c, (R32(0x4c51c + i * 0x18c) - R32(0x4c52c + i * 0x18c)) | 0);
    } else {
      // 0x19b57: y += counter_2
      W32(0x4c51c + i * 0x18c, (R32(0x4c51c + i * 0x18c) + R32(0x4c52c + i * 0x18c)) | 0);
    }
    // 0x19b8d..0x19baa: x += rand() % 5 - 2 (cdq; idiv)
    {
      const r = imod(await F.rand_232c7(), 5);
      W32(0x4c518 + i * 0x18c, (R32(0x4c518 + i * 0x18c) + ((r - 2) | 0)) | 0);
    }
    // 0x19bb0..0x19bcb: y += rand() % 3 - 1
    {
      const r = imod(await F.rand_232c7(), 3);
      W32(0x4c51c + i * 0x18c, (R32(0x4c51c + i * 0x18c) + ((r - 1) | 0)) | 0);
    }
    // 0x19bd1..0x19c04: x > 0x140 || x < -10 || y < 0 -> state = 0 (0x19c06)
    if (R32(0x4c518 + i * 0x18c) > 0x140 || R32(0x4c518 + i * 0x18c) < -0xa ||
        R32(0x4c51c + i * 0x18c) < 0) {
      W32(0x4c688 + i * 0x18c, 0);
    }

    // 0x19c17: group 0x33f48, j = 0..4
    for (j = 0; j < 5; j++) {
      if (((R32(0x4c518 + i * 0x18c) + 0xd) | 0) > ((R32(0x33f48 + j * 0x18c) + 0xa) | 0) &&            // 0x19c30
          ((((R32(0x33f48 + j * 0x18c) + R32(0x33f50 + j * 0x18c)) | 0) - 0xa) | 0) > R32(0x4c518 + i * 0x18c) &&  // 0x19c54
          ((((R32(0x33f4c + j * 0x18c) + R32(0x33f54 + j * 0x18c)) | 0) - 5) | 0) > R32(0x4c51c + i * 0x18c) &&    // 0x19c84
          ((R32(0x4c51c + i * 0x18c) + 8) | 0) > ((R32(0x33f4c + j * 0x18c) + 5) | 0)) {                   // 0x19cb4
        // 0x19cda: counter_2 (+0x014) of 0x33f48[j] -= 1
        W32(0x33f5c + j * 0x18c, (R32(0x33f5c + j * 0x18c) - 1) | 0);
        W32(0x4c688 + i * 0x18c, 0);                                   // 0x19ce7
        await F.dws_DDiscard_1f770(R16(0x6126a));                      // 0x19cf8
        await F.dws_DPlay_1eff8(0x61260);                              // 0x19d09
      }
    }

    // 0x19d1c: group 0x3d23c, j = 0..3
    for (j = 0; j < 4; j++) {
      if (((R32(0x4c518 + i * 0x18c) + 0xd) | 0) > R32(0x3d23c + j * 0x18c) &&                            // 0x19d35
          ((R32(0x3d23c + j * 0x18c) + R32(0x3d244 + j * 0x18c)) | 0) > R32(0x4c518 + i * 0x18c) &&      // 0x19d54
          ((R32(0x4c51c + i * 0x18c) + 8) | 0) > R32(0x3d240 + j * 0x18c) &&                             // 0x19d81
          ((R32(0x3d240 + j * 0x18c) + R32(0x3d248 + j * 0x18c)) | 0) > R32(0x4c51c + i * 0x18c) &&      // 0x19da2
          R32(0x3d3ac + j * 0x18c) === 1) {                                                              // 0x19dcf
        W32(0x3d3ac + j * 0x18c, 0);                                   // 0x19de4 state = 0
        W32(0x60b90, (R32(0x3d23c + j * 0x18c) - 0xc) | 0);            // 0x19df5
        W32(0x60b94, (R32(0x3d240 + j * 0x18c) - 0x16) | 0);           // 0x19e0a
        W32(((R32(0x60b8c) << 2) + 0x60b58) | 0, 0x33);                // 0x19e1f
        await F.sub_1352c();                                           // 0x19e31
        W32(0x4c688 + i * 0x18c, 0);                                   // 0x19e36
        await F.dws_DDiscard_1f770(R16(0x6128a));                      // 0x19e47
        await F.dws_DPlay_1eff8(0x61280);                              // 0x19e58
        W32(0x60a68, (R32(0x60a68) + 0x1f5) | 0);                      // 0x19e66
        W32(0x60a6c, (R32(0x60a6c) + 1) | 0);                          // 0x19e70
      }
    }

    // 0x19e7b: single sprite 0x5fc04
    if (((R32(0x4c518 + i * 0x18c) + 0xd) | 0) > R32(0x5fc04) &&                                         // 0x19e7b
        ((R32(0x5fc04) + R32(0x5fc0c)) | 0) > R32(0x4c518 + i * 0x18c) &&                                // 0x19e93
        ((R32(0x4c51c + i * 0x18c) + 8) | 0) > R32(0x5fc08) &&                                           // 0x19eaf
        ((R32(0x5fc08) + R32(0x5fc10)) | 0) > R32(0x4c51c + i * 0x18c) &&                                // 0x19ec9
        R32(0x5fd74) !== 0) {                                                                            // 0x19ee5
      W32(0x5fd74, 0);                                                 // 0x19ef0 state = 0
      W32(0x60b90, (R32(0x5fc04) - 0xc) | 0);                          // 0x19efa
      W32(0x60b94, (R32(0x5fc08) - 0x16) | 0);                         // 0x19f07
      W32(((R32(0x60b8c) << 2) + 0x60b58) | 0, 0x33);                  // 0x19f14
      await F.sub_1352c();                                             // 0x19f26
      W32(0x4c688 + i * 0x18c, 0);                                     // 0x19f2b
      await F.dws_DDiscard_1f770(R16(0x6128a));                        // 0x19f3c
      await F.dws_DPlay_1eff8(0x61280);                                // 0x19f4d
      W32(0x60a68, (R32(0x60a68) + 0x7d1) | 0);                        // 0x19f5b
      W32(0x60a6c, (R32(0x60a6c) + 1) | 0);                            // 0x19f65
    }

    // 0x19f6b: group 0x3d0b0, k = 0..0
    for (k = 0; k < 1; k++) {
      if (((R32(0x4c518 + i * 0x18c) + 0xd) | 0) > R32(0x3d0b0 + k * 0x18c) &&                            // 0x19f84
          ((R32(0x3d0b0 + k * 0x18c) + R32(0x3d0b8 + k * 0x18c)) | 0) > R32(0x4c518 + i * 0x18c) &&      // 0x19fa3
          ((R32(0x4c51c + i * 0x18c) + 8) | 0) > R32(0x3d0b4 + k * 0x18c) &&                             // 0x19fd0
          ((R32(0x3d0b4 + k * 0x18c) + R32(0x3d0bc + k * 0x18c)) | 0) > R32(0x4c51c + i * 0x18c) &&      // 0x19ff1
          R32(0x3d220 + k * 0x18c) !== 0) {                                                              // 0x1a01e
        // 0x1a030: threshold_1 (+0x01c) of 0x3d0b0[k] -= 1
        W32(0x3d0cc + k * 0x18c, (R32(0x3d0cc + k * 0x18c) - 1) | 0);
        W32(0x4c688 + i * 0x18c, 0);                                   // 0x1a03d
        await F.dws_DDiscard_1f770(R16(0x6126a));                      // 0x1a04e
        await F.dws_DPlay_1eff8(0x61260);                              // 0x1a05f
      }
      // 0x1a06d: cmp threshold_1, 0; jge -> next k
      if (R32(0x3d0cc + k * 0x18c) < 0) {
        W32(0x3d220 + k * 0x18c, 0);                                   // 0x1a081 state = 0
        for (j = 0; j < 4; j++) {                                      // 0x1a092
          // 0x1a0ab..0x1a0cd: ecx = k*0x18c; rand() % 0x1e; x read after the call
          {
            const r = imod(await F.rand_232c7(), 0x1e);
            W32(0x60b90, (r + R32(0x3d0b0 + k * 0x18c)) | 0);
          }
          // 0x1a0d3..0x1a0f5
          {
            const r = imod(await F.rand_232c7(), 0x14);
            W32(0x60b94, (r + R32(0x3d0b4 + k * 0x18c)) | 0);
          }
          W32(((R32(0x60b8c) << 2) + 0x60b58) | 0, 0x33);              // 0x1a0fb
          await F.sub_1352c();                                         // 0x1a10e
          await F.dws_DDiscard_1f770(R16(0x6128a));                    // 0x1a113
          await F.dws_DPlay_1eff8(0x61280);                            // 0x1a125
        }
        W32(0x60a68, (R32(0x60a68) + 0x12c) | 0);                      // 0x1a138
        W32(0x60a6c, (R32(0x60a6c) + 1) | 0);                          // 0x1a142
      }
    }

    // 0x1a14d: group 0x3d86c, j = 0..2
    for (j = 0; j < 3; j++) {
      if (((R32(0x4c518 + i * 0x18c) + 0xd) | 0) > R32(0x3d86c + j * 0x18c) &&                            // 0x1a166
          ((R32(0x3d86c + j * 0x18c) + R32(0x3d874 + j * 0x18c)) | 0) > R32(0x4c518 + i * 0x18c) &&      // 0x1a185
          ((R32(0x4c51c + i * 0x18c) + 8) | 0) > R32(0x3d870 + j * 0x18c) &&                             // 0x1a1b2
          ((R32(0x3d870 + j * 0x18c) + R32(0x3d878 + j * 0x18c)) | 0) > R32(0x4c51c + i * 0x18c) &&      // 0x1a1d3
          R32(0x3d9dc + j * 0x18c) !== 0) {                                                              // 0x1a200
        // 0x1a215: counter_2 (+0x014) of 0x3d86c[j] -= 1
        W32(0x3d880 + j * 0x18c, (R32(0x3d880 + j * 0x18c) - 1) | 0);
        // 0x1a222..0x1a253: x += rand()%3 - rand()%3 (EBX kept across the second rand: rand saves only EDX
        // and 0x232c1, so EBX/ECX survive — they are plain locals here)
        {
          let b = imod(await F.rand_232c7(), 3);
          const r2 = imod(await F.rand_232c7(), 3);
          b = (b - r2) | 0;
          W32(0x3d86c + j * 0x18c, (R32(0x3d86c + j * 0x18c) + b) | 0);
        }
        // 0x1a259..0x1a28a: y += rand()%3 - rand()%3
        {
          let b = imod(await F.rand_232c7(), 3);
          const r2 = imod(await F.rand_232c7(), 3);
          b = (b - r2) | 0;
          W32(0x3d870 + j * 0x18c, (R32(0x3d870 + j * 0x18c) + b) | 0);
        }
        W32(0x4c688 + i * 0x18c, 0);                                   // 0x1a290
        await F.dws_DDiscard_1f770(R16(0x6126a));                      // 0x1a2a1
        await F.dws_DPlay_1eff8(0x61260);                              // 0x1a2b3
      }
      // 0x1a2c1: cmp counter_2, 0; jge -> next j
      if (R32(0x3d880 + j * 0x18c) < 0) {
        W32(0x3d9dc + j * 0x18c, 0);                                   // 0x1a2d5 state = 0
        W32(0x60b90, (R32(0x3d86c + j * 0x18c) - 0xc) | 0);            // 0x1a2e6
        W32(0x60b94, (R32(0x3d870 + j * 0x18c) - 0x16) | 0);           // 0x1a2fb
        W32(((R32(0x60b8c) << 2) + 0x60b58) | 0, 0x33);                // 0x1a310
        await F.sub_1352c();                                           // 0x1a322
        await F.dws_DDiscard_1f770(R16(0x6128a));                      // 0x1a327
        await F.dws_DPlay_1eff8(0x61280);                              // 0x1a338
        W32(0x60a68, (R32(0x60a68) + 0x64) | 0);                       // 0x1a346
        W32(0x60a6c, (R32(0x60a6c) + 1) | 0);                          // 0x1a34d
      }
    }

    // 0x1a358: group 0x35b20, j = 0..24
    for (j = 0; j < 0x19; j++) {
      // first test (0x1a371..0x1a428)
      if (((R32(0x4c518 + i * 0x18c) + R32(0x4c520 + i * 0x18c)) | 0) > R32(0x35b20 + j * 0x18c) &&      // 0x1a371
          ((R32(0x35b20 + j * 0x18c) + R32(0x35b28 + j * 0x18c)) | 0) > R32(0x4c518 + i * 0x18c) &&      // 0x1a39c
          R32(0x4c51c + i * 0x18c) > R32(0x35b24 + j * 0x18c) &&                                         // 0x1a3c9
          ((R32(0x35b24 + j * 0x18c) + 0x11) | 0) > R32(0x4c51c + i * 0x18c) &&                          // 0x1a3e7
          (R32(0x35c90 + j * 0x18c) === 0x1c || R32(0x35c90 + j * 0x18c) === 0x1b)) {                    // 0x1a408
        W32(0x35c90 + j * 0x18c, 0x21);                                // 0x1a42f state
        W32(0x35b34 + j * 0x18c, 0);                                   // 0x1a440 counter_2
        W32(0x35c88 + j * 0x18c, 5);                                   // 0x1a451 curr_frame
        W32(0x60ee0, imod(await F.rand_232c7(), 3));                   // 0x1a462..0x1a475
        await F.dws_DDiscard_1f770(R16(0x612aa));                      // 0x1a47b
        await F.dws_DDiscard_1f770(R16(0x612ca));                      // 0x1a48d
        await F.dws_DDiscard_1f770(R16(0x612ea));                      // 0x1a49f
        if (R32(0x60ee0) === 0) await F.dws_DPlay_1eff8(0x612a0);      // 0x1a4b1
        if (R32(0x60ee0) === 1) await F.dws_DPlay_1eff8(0x612c0);      // 0x1a4c8
        if (R32(0x60ee0) === 2) await F.dws_DPlay_1eff8(0x612e0);      // 0x1a4df
        W32(0x60a68, (R32(0x60a68) + 0xf) | 0);                        // 0x1a4f6
        W32(0x60a6c, (R32(0x60a6c) + 1) | 0);                          // 0x1a4fd
      }
      // second test (0x1a503..0x1a5c9)
      if (((R32(0x4c518 + i * 0x18c) + R32(0x4c520 + i * 0x18c)) | 0) > R32(0x35b20 + j * 0x18c) &&      // 0x1a503
          ((R32(0x35b20 + j * 0x18c) + R32(0x35b28 + j * 0x18c)) | 0) > R32(0x4c518 + i * 0x18c) &&      // 0x1a52e
          ((R32(0x35b24 + j * 0x18c) + 0x11) | 0) < R32(0x4c51c + i * 0x18c) &&                          // 0x1a55b (jl)
          ((R32(0x35b24 + j * 0x18c) + R32(0x35b2c + j * 0x18c)) | 0) > R32(0x4c51c + i * 0x18c) &&      // 0x1a57c
          (R32(0x35c90 + j * 0x18c) === 0x1c || R32(0x35c90 + j * 0x18c) === 0x1b)) {                    // 0x1a5a9
        if (imod(await F.rand_232c7(), 0xa) === 1) {                   // 0x1a5d0..0x1a5e6
          if (R32(0x35b20 + j * 0x18c) > 0xa0) {                       // 0x1a5e8 (jle: signed)
            W32(0x35c90 + j * 0x18c, 2);                               // 0x1a5fb
          } else {
            W32(0x35c90 + j * 0x18c, 3);                               // 0x1a60e
          }
          // 0x1a61f..0x1a63c: curr_frame = rand()%3 + 0x13
          W32(0x35c88 + j * 0x18c, (imod(await F.rand_232c7(), 3) + 0x13) | 0);
        } else {
          W32(0x35c90 + j * 0x18c, 4);                                 // 0x1a644
          W32(0x35c88 + j * 0x18c, 0x15);                              // 0x1a655
        }
        await F.dws_DDiscard_1f770(R16(0x6132a));                      // 0x1a666
        await F.dws_DPlay_1eff8(0x61320);                              // 0x1a677
        W32(0x60a68, (R32(0x60a68) + 0xb) | 0);                        // 0x1a685
        W32(0x60a6c, (R32(0x60a6c) + 1) | 0);                          // 0x1a68c
      }
    }

    // 0x1a697: single sprite 0x4c38c
    if (((R32(0x4c518 + i * 0x18c) + R32(0x4c520 + i * 0x18c)) | 0) > R32(0x4c38c) &&                    // 0x1a697
        ((R32(0x4c38c) + R32(0x4c394)) | 0) > R32(0x4c518 + i * 0x18c) &&                                // 0x1a6b9
        R32(0x4c51c + i * 0x18c) > R32(0x4c390) &&                                                       // 0x1a6d5
        ((R32(0x4c390) + R32(0x4c398)) | 0) > R32(0x4c51c + i * 0x18c) &&                                // 0x1a6ec
        R32(0x4c4fc) !== 0) {                                                                            // 0x1a708
      W32(0x4c3ac, (R32(0x4c3ac) - 2) | 0);                            // 0x1a713 threshold_2 (+0x020) -= 2
      W32(0x4c3a0, Math.imul(R32(0x4c3a0), -1));                       // 0x1a71a counter_2 (+0x014) *= -1
      W32(0x4c688 + i * 0x18c, 0);                                     // 0x1a726
      await F.dws_DDiscard_1f770(R16(0x6126a));                        // 0x1a737
      await F.dws_DPlay_1eff8(0x61260);                                // 0x1a748
    }
    // 0x1a756: threshold_2 > 0 or state == 0 -> 0x1a817
    if (!(R32(0x4c3ac) > 0) && R32(0x4c4fc) !== 0) {
      W32(0x4c4fc, 0);                                                 // 0x1a76d state = 0
      for (j = 0; j < 4; j++) {                                        // 0x1a777
        // 0x1a78c..0x1a7a6: x read after the call, eax = x + rem
        {
          const r = imod(await F.rand_232c7(), 0x1e);
          W32(0x60b90, (R32(0x4c38c) + r) | 0);
        }
        // 0x1a7ab..0x1a7c5
        {
          const r = imod(await F.rand_232c7(), 0x14);
          W32(0x60b94, (r + R32(0x4c390)) | 0);
        }
        W32(((R32(0x60b8c) << 2) + 0x60b58) | 0, 0x33);                // 0x1a7cb
        await F.sub_1352c();                                           // 0x1a7de
        await F.dws_DDiscard_1f770(R16(0x6128a));                      // 0x1a7e3
        await F.dws_DPlay_1eff8(0x61280);                              // 0x1a7f4
      }
      W32(0x60a68, (R32(0x60a68) + 0x3e8) | 0);                        // 0x1a807
      W32(0x60a6c, (R32(0x60a6c) + 1) | 0);                            // 0x1a811
    }
  }                                                                    // 0x1a817 jmp 0x19b06
});
