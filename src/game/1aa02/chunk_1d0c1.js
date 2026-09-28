// main (0x1aa02) chunk G1: range [0x1d0c1, 0x1d630)
// Entry 0x1d0c1, single exit 0x1d630 (falls through to chunk G2, chunk_1d630).
// No live registers/locals at either end (MAIN_PLAN.md §2). Locals: [ebp-8], [ebp-0x18], [ebp-0x1c]
// (chunk-local lets).
// Contents: [0x60a64] = Timer_Query(); [0x60bc0] = 1 unless one of the 26 dwords [0x3a9e8 + i*0x18c] is
// nonzero; [0x60b54] counter wrapping after 10; Squeeze_Mouse(3, 0x60b48, 0x60b4c, 0x60b50) and copies into
// [0x33aa4]/[0x33aa8]; chains of tests on keyboard_state (0x64f04 + 4*scan, LIBRARY.md "Game-side use of
// keyboard_state") that call functions or store globals. Each test is a single read per frame, no loop
// waits on them. Then, only if [0x60f00] == 0 and [0x60b50] == 2, the jump-table switch on [0x60ee8]
// (table at 0x1d5e8, MAIN_PLAN.md §1.2), followed by [0x60f00] = 1; finally [0x60f00] = 0 if [0x60b50] != 2.
// Scan codes of the tested slots (index = (addr - 0x64f04) / 4): 0x64f08 = 1, 0x64f10 = 3, 0x64f18 = 5,
// 0x64f30 = 0xb, 0x64f5c = 0x16, 0x64f68 = 0x19, 0x64f84 = 0x20, 0x64f8c = 0x22, 0x64f98 = 0x25,
// 0x64f9c = 0x26, 0x64fc0 = 0x2f, 0x64fc4 = 0x30, 0x64fc8 = 0x31, 0x64fcc = 0x32, 0x64ff4 = 0x3c,
// 0x64ff8 = 0x3d, 0x64ffc = 0x3e.
// Callees: Timer_Query (EAX stored), Squeeze_Mouse (EAX, EDX, EBX, ECX; result not read), sub_10c0b,
// sub_16c37, sub_10cac, sub_10b7d, sub_1a825, dws_DPlay x13 call sites, dws_DDiscard x12 call sites
// (both cdecl, 1 pushed arg, `add esp,4`; results not read). dws_DDiscard's arg is a zero-extended word
// (`xor eax,eax; mov ax,[m]; push eax`), hence R16.
import { F } from '../../runtime/registry.js';
import { R16, R32, W32 } from '../../runtime/mem.js';

export async function chunk_1d0c1() {
  let i;   // [ebp-8]
  let v18; // [ebp-0x18]  switch operand
  let v1c; // [ebp-0x1c]  switch index

  W32(0x60a64, await F.Timer_Query_235f9());                     // 1d0c1 call, 1d0c6 mov [0x60a64],eax
  W32(0x60bc0, 1);                                               // 1d0cb
  for (i = 0; i < 0x1a; i++) {                                   // 1d0d5 =0; 1d0e4 cmp 0x1a / jge 1d106; 1d0de..1d0e1 inc
    if (R32(0x3a9e8 + Math.imul(i, 0x18c)) !== 0) {              // 1d0ea imul, 1d0f1 cmp [eax+0x3a9e8],0, 1d0f8 je 1d104
      W32(0x60bc0, 0);                                           // 1d0fa
    }
  }                                                              // 1d104 jmp 1d0de
  W32(0x60b54, (R32(0x60b54) + 1) | 0);                          // 1d106 inc
  if (R32(0x60b54) > 0xa) {                                      // 1d10c cmp 0xa, 1d113 jle 1d11f (signed)
    W32(0x60b54, 0);                                             // 1d115
  }
  W32(0x60ba8, R32(0x33aa8));                                    // 1d11f..1d124
  W32(0x60ba4, R32(0x33aa4));                                    // 1d129..1d12e
  await F.Squeeze_Mouse_230df(3, 0x60b48, 0x60b4c, 0x60b50);     // 1d133 ecx, 1d138 ebx, 1d13d edx, 1d142 eax, 1d147 call
  W32(0x33aa4, ((R32(0x60b48) >> 1) - 0x10) | 0);                // 1d14c mov, 1d151 sar 1, 1d153 sub 0x10, 1d156 mov
  if (R32(0x33aa4) < 0) {                                        // 1d15b cmp 0, 1d162 jge 1d16e (signed)
    W32(0x33aa4, 0);                                             // 1d164
  }
  W32(0x33aa8, R32(0x60b4c));                                    // 1d16e..1d173

  if (R32(0x64f08) !== 0) {                                      // 1d178 cmp, 1d17f je 1d186
    await F.sub_10c0b();                                         // 1d181
  }
  await F.sub_16c37();                                           // 1d186
  if (R32(0x64ff4) !== 0) {                                      // 1d18b cmp, 1d192 je 1d199
    await F.sub_10cac();                                         // 1d194
  }
  if (R32(0x64ff8) !== 0 && R32(0x64ffc) !== 0) {                // 1d199/1d1a0 je 1d1ab(->1d1b7); 1d1a2/1d1a9 jne 1d1ad
    W32(0x60a68, (R32(0x60a68) + 0x1388) | 0);                   // 1d1ad add [0x60a68],0x1388
  }
  if (R32(0x64f68) !== 0) {                                      // 1d1b7 cmp, 1d1be je 1d1c5
    await F.sub_10b7d();                                         // 1d1c0
  }
  if (R32(0x64f9c) !== 0 && R32(0x64fc0) !== 0 && R32(0x64f5c) !== 0) { // 1d1c5/1d1cc, 1d1ce/1d1d5, 1d1d9/1d1e0
    W32(0x30bec, (R32(0x30bec) + 1) | 0);                        // 1d1e4 inc [0x30bec]
  }
  if (R32(0x64f9c) !== 0 && R32(0x64fc0) !== 0 && R32(0x64f84) !== 0) { // 1d1ea/1d1f1, 1d1f3/1d1fa, 1d1fe/1d205
    W32(0x30bec, (R32(0x30bec) - 1) | 0);                        // 1d209 dec [0x30bec]
  }
  if (R32(0x64fc8) !== 0 && R32(0x64f5c) !== 0 && R32(0x64f98) !== 0) { // 1d20f/1d216, 1d218/1d21f, 1d223/1d22a
    await F.sub_1a825();                                         // 1d22e
  }
  if (R32(0x64f18) !== 0 && R32(0x64f10) !== 0 && R32(0x64f30) !== 0) { // 1d233/1d23a, 1d23c/1d243, 1d247/1d24e
    await F.dws_DPlay_1eff8(0x611c0);                            // 1d252..1d25d (cdecl, add esp,4)
    for (i = 0; i < 0x1a; i++) {                                 // 1d260 =0; 1d26f cmp 0x1a / jge 1d2aa; 1d269..1d26c inc
      W32(0x3a9e8 + Math.imul(i, 0x18c), 0x33);                  // 1d275 imul, 1d27c
      W32(0x3a9e0 + Math.imul(i, 0x18c), 6);                     // 1d286 imul, 1d28d
      W32(0x3a890 + Math.imul(i, 0x18c), 0x3c);                  // 1d297 imul, 1d29e
    }                                                            // 1d2a8 jmp 1d269
  }
  if (R32(0x64f8c) !== 0 && R32(0x64fcc) !== 0) {                // 1d2aa/1d2b1 je 1d2bc(->1d2d6); 1d2b3/1d2ba jne 1d2be
    W32(0x60bb4, 1);                                             // 1d2be
    await F.dws_DPlay_1eff8(0x61460);                            // 1d2c8..1d2d3
  }
  if (R32(0x64f8c) !== 0 && R32(0x64fc4) !== 0) {                // 1d2d6/1d2dd je 1d2e8(->1d30c); 1d2df/1d2e6 jne 1d2ea
    W32(0x60bb8, 1);                                             // 1d2ea
    W32(0x60ef4, 0x39);                                          // 1d2f4
    await F.dws_DPlay_1eff8(0x61480);                            // 1d2fe..1d309
  }
  if (R32(0x64f8c) !== 0 && R32(0x64fc8) !== 0) {                // 1d30c/1d313 je 1d31e(->1d338); 1d315/1d31c jne 1d320
    W32(0x60bb0, 1);                                             // 1d320
    await F.dws_DPlay_1eff8(0x61440);                            // 1d32a..1d335
  }

  if (R32(0x60f00) === 0 && R32(0x60b50) === 2) {                // 1d338/1d33f jne 1d34a(->1d61d); 1d341/1d348 je 1d34f
    v18 = R32(0x60ee8);                                          // 1d34f..1d354; 1d357 jmp 1d5f8
    v1c = (v18 - 0x35) | 0;                                      // 1d5f8 mov, 1d5fb sub 0x35, 1d5fe mov [ebp-0x1c]
    if ((v1c >>> 0) > 3) {                                       // 1d601 cmp 3, 1d605 ja 1d5e3 (unsigned)
      // 1d5e3 jmp 1d613
    } else {
      // 1d607..1d60d jmp [eax*4 + 0x1d5e8]; table (0x1d5e8: b2d40100 5cd30100 35d40100 54d50100)
      // = {0: 0x1d4b2, 1: 0x1d35c, 2: 0x1d435, 3: 0x1d554}. Every body ends with jmp 1d613.
      switch (v1c) {
        case 1:                                                  // [0x60ee8] == 0x36 -> 0x1d35c
          if (R32(0x60bb0) === 1) {                              // 1d35c cmp, 1d363 jne 1d3b8
            await F.dws_DDiscard_1f770(R16(0x6148a));            // 1d365..1d373 (zero-extended word)
            await F.dws_DDiscard_1f770(R16(0x613ea));            // 1d376..1d384
            W32(0x60ee8, 0x37);                                  // 1d387
            W32(0x33f2c, 1);                                     // 1d391
            W32(0x33f24, 0);                                     // 1d39b
            await F.dws_DPlay_1eff8(0x61440);                    // 1d3a5..1d3b0; 1d3b3 jmp 1d613
          } else if (R32(0x60bb4) === 1) {                       // 1d3b8 cmp, 1d3bf jne 1d3ef
            await F.dws_DDiscard_1f770(R16(0x6144a));            // 1d3c1..1d3cf
            W32(0x60ee8, 0x35);                                  // 1d3d2
            await F.dws_DPlay_1eff8(0x61460);                    // 1d3dc..1d3e7; 1d3ea jmp 1d613
          } else if (R32(0x60bb8) === 1) {                       // 1d3ef cmp, 1d3f6 jne 1d430
            await F.dws_DDiscard_1f770(R16(0x6146a));            // 1d3f8..1d406
            W32(0x60ee8, 0x38);                                  // 1d409
            W32(0x60ef4, 0x39);                                  // 1d413
            await F.dws_DPlay_1eff8(0x61480);                    // 1d41d..1d428; 1d42b jmp 1d613
          }                                                      // 1d430 jmp 1d613
          break;
        case 2:                                                  // [0x60ee8] == 0x37 -> 0x1d435
          if (R32(0x60bb4) === 1) {                              // 1d435 cmp, 1d43c jne 1d46c
            await F.dws_DDiscard_1f770(R16(0x6144a));            // 1d43e..1d44c
            W32(0x60ee8, 0x35);                                  // 1d44f
            await F.dws_DPlay_1eff8(0x61460);                    // 1d459..1d464; 1d467 jmp 1d613
          } else if (R32(0x60bb8) === 1) {                       // 1d46c cmp, 1d473 jne 1d4ad
            await F.dws_DDiscard_1f770(R16(0x6146a));            // 1d475..1d483
            W32(0x60ee8, 0x38);                                  // 1d486
            W32(0x60ef4, 0x39);                                  // 1d490
            await F.dws_DPlay_1eff8(0x61480);                    // 1d49a..1d4a5; 1d4a8 jmp 1d613
          }                                                      // 1d4ad jmp 1d613
          break;
        case 0:                                                  // [0x60ee8] == 0x35 -> 0x1d4b2
          if (R32(0x60bb8) === 1) {                              // 1d4b2 cmp, 1d4b9 jne 1d4f3
            await F.dws_DDiscard_1f770(R16(0x6146a));            // 1d4bb..1d4c9
            W32(0x60ee8, 0x38);                                  // 1d4cc
            W32(0x60ef4, 0x39);                                  // 1d4d6
            await F.dws_DPlay_1eff8(0x61480);                    // 1d4e0..1d4eb; 1d4ee jmp 1d613
          } else if (R32(0x60bb0) === 1) {                       // 1d4f3 cmp, 1d4fa jne 1d54f
            await F.dws_DDiscard_1f770(R16(0x6148a));            // 1d4fc..1d50a
            await F.dws_DDiscard_1f770(R16(0x613ea));            // 1d50d..1d51b
            W32(0x60ee8, 0x37);                                  // 1d51e
            W32(0x33f2c, 1);                                     // 1d528
            W32(0x33f24, 0);                                     // 1d532
            await F.dws_DPlay_1eff8(0x61440);                    // 1d53c..1d547; 1d54a jmp 1d613
          }                                                      // 1d54f jmp 1d613
          break;
        case 3:                                                  // [0x60ee8] == 0x38 -> 0x1d554
          if (R32(0x60bb0) === 1) {                              // 1d554 cmp, 1d55b jne 1d5ad
            await F.dws_DDiscard_1f770(R16(0x6148a));            // 1d55d..1d56b
            await F.dws_DDiscard_1f770(R16(0x613ea));            // 1d56e..1d57c
            W32(0x60ee8, 0x37);                                  // 1d57f
            W32(0x33f2c, 1);                                     // 1d589
            W32(0x33f24, 0);                                     // 1d593
            await F.dws_DPlay_1eff8(0x61440);                    // 1d59d..1d5a8; 1d5ab jmp 1d613
          } else if (R32(0x60bb4) === 1) {                       // 1d5ad cmp, 1d5b4 jne 1d5e1
            await F.dws_DDiscard_1f770(R16(0x6144a));            // 1d5b6..1d5c4
            W32(0x60ee8, 0x35);                                  // 1d5c7
            await F.dws_DPlay_1eff8(0x61460);                    // 1d5d1..1d5dc; 1d5df jmp 1d613
          }                                                      // 1d5e1 jmp 1d613
          break;
      }
    }
    W32(0x60f00, 1);                                             // 1d613
  }
  if (R32(0x60b50) !== 2) {                                      // 1d61d cmp 2, 1d624 je 1d630
    W32(0x60f00, 0);                                             // 1d626
  }
}
