// 0x15e15  void sub_15e15(void)   [Watcom, no args, no return value]
// Size 0x631 bytes (0x15e15..0x16445 RET).
// Args: none — EAX/EDX/EBX/ECX are loaded before any read; EBX/ECX/EDX/ESI/EDI/EBP are saved/restored
// (0x15e1f..0x15e24 / 0x1643f..0x16444). signatures.json: regs 0, stack 0.
// Return: none — EAX at the RET is sub_1a825's leftover; the only call site (0x15ded) is followed by
// 0x15df2 `inc dword [0x30bec]`, which does not read EAX. signatures.json returns=false.
// Summary (facts from the disassembly):
//   sub_16c37(); Draw_Sprite_Clip(s, [0x64e7c], 1) for 0x33918, 0x44010 + i*0x18c (i<7), 0x44ae4 + i*0x18c
//   (i<4), 0x452a0 + i*0x18c (i<3), 0x33c30; stores constants to globals (below); scans the 26 structs
//   0x3a878 + i*0x18c for the longest run of consecutive dword [+0x170] == 0 and stores dword [+0] of the
//   struct at the start of that run to [0x60bcc] (initially -1; strict `>` so the first longest run wins);
//   then loops while [0x30bf4] == 0x22 ([0x30bf4] is set to 0x22 right before the loop):
//     [0x60a64] = Timer_Query(); sub_14fba(); Erase_Sprite_Clip for a list of structs; [0x60bc4] = 1;
//     sub_18f27(); sub_15788(); sub_16837(); sub_14425(); Behind_Sprite_Clip for the list;
//     Draw_Sprite_Clip(.., 1) for the list; Show_Double_Buffer([0x64e7c], 0);
//     waits until Timer_Query() - [0x60a64] >= 1 (signed, jge) calling sub_10050();
//   after the loop: sub_15c34(); [0x60bc4] = 0; sub_1a825().
// Evidence: [0x64e7c] = double_buffer (LIBRARY.md). The addresses passed to Draw/Erase/Behind_Sprite_Clip are
// sprite* (LIBRARY.md sprite, size 0x18c). Hence:
//   0x45d74 is a sprite: 0x45d74 x (+0), 0x45d78 y (+4), 0x45d80 height (+0xc), 0x45d88 counter_2 (+0x14),
//     0x45ee4 state (+0x170).
//   0x3dd10 is a sprite: 0x3de78 = 0x3dd10 + 0x168 curr_frame.
//   0x3a878 + i*0x18c are sprites: +0x170 (0x3a9e8) state, +0 x.
//   0x33dbc is a sprite: 0x33f24 = 0x33dbc + 0x168 (curr_frame), 0x33f2c = 0x33dbc + 0x170 (state).
//   UNCERTAIN: LIBRARY.md lists 0x33f24 among "game arrays" of sprites; here only the arithmetic above is used.
// 0x30bec, 0x30be8, 0x30bf8, 0x60ee4, 0x60bcc, 0x60bc4, 0x30bf4, 0x60a64: address only (0x60a64 holds the
// Timer_Query value stored at 0x16047 and is subtracted at 0x16412).
// Frame (sub esp,0x10): [ebp-0x10] i (loop counter), [ebp-0xc] k (start index of the run), [ebp-8] run
// (current run length), [ebp-4] best (longest run). No address is taken and every slot is written before it
// is read, so they are plain locals.
// Busy-wait note: the loop 0x1640d..0x16422 exits on the BIOS tick (Timer_Query). Its only body call, sub_10050,
// calls dws_MSongStatus / dws_MPlay / dws_DPlay (10050_sub_10050.js), which do not yield, so the loop gets
// `await yieldCpu()`. The outer loop (0x16035) contains that wait loop, so it yields on every pass.
// All dword comparisons signed (jge/jle/jne). No x87 instructions.
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';
import { yieldCpu } from '../runtime/cpu.js';

register(0x15e15, 'sub_15e15', async function sub_15e15() {
  let i;    // [ebp-0x10]
  let k;    // [ebp-0xc]
  let run;  // [ebp-8]
  let best; // [ebp-4]

  k = 0;                                                                      // 0x15e2d
  run = 0;                                                                    // 0x15e34
  best = 0;                                                                   // 0x15e3b
  await F.sub_16c37();                                                        // 0x15e42
  await F.Draw_Sprite_Clip_212c0(0x33918, R32(0x64e7c), 1);                   // 0x15e47..0x15e57
  // 0x15e5c..0x15e8f (mov eax,[ebp-0x10] at 0x15e65 is a dead load, same in every loop below)
  for (i = 0; i < 7; i++) {
    await F.Draw_Sprite_Clip_212c0((0x44010 + Math.imul(i, 0x18c)) | 0, R32(0x64e7c), 1);
  }
  for (i = 0; i < 4; i++) {                                                   // 0x15e91..0x15ec4
    await F.Draw_Sprite_Clip_212c0((0x44ae4 + Math.imul(i, 0x18c)) | 0, R32(0x64e7c), 1);
  }
  for (i = 0; i < 3; i++) {                                                   // 0x15ec6..0x15ef9
    await F.Draw_Sprite_Clip_212c0((0x452a0 + Math.imul(i, 0x18c)) | 0, R32(0x64e7c), 1);
  }
  await F.Draw_Sprite_Clip_212c0(0x33c30, R32(0x64e7c), 1);                   // 0x15efb..0x15f0b
  W32(0x33f2c, 0x2b);                                                         // 0x15f10
  W32(0x33f24, 0xa);                                                          // 0x15f1a
  W32(0x60ee4, 0);                                                            // 0x15f24
  W32(0x30be8, 0x64);                                                         // 0x15f2e
  W32(0x30bf8, 2);                                                            // 0x15f38
  W32(0x45d74, 0);                                                            // 0x15f42
  W32(0x45d78, R32(0x45d80));                                                 // 0x15f4c..0x15f51
  W32(0x45d78, -R32(0x45d78) | 0);                                            // 0x15f56 neg dword
  W32(0x45ee4, 0x21);                                                         // 0x15f5c
  W32(0x45d88, Math.imul(R32(0x30bec), 0xa));                                 // 0x15f66..0x15f6e
  W32(0x3de78, 0);                                                            // 0x15f73
  k = 0;                                                                      // 0x15f7d
  run = 0;                                                                    // 0x15f84
  best = 0;                                                                   // 0x15f8b
  W32(0x60bcc, -1);                                                           // 0x15f92
  // 0x15f9c..0x15ff9: for (i = 0; i < 0x1a; i++)
  for (i = 0; i < 0x1a; i++) {
    if (R32((Math.imul(i, 0x18c) + 0x3a9e8) | 0) === 0) {                     // 0x15fb1..0x15fbf
      run = (run + 1) | 0;                                                    // 0x15fc1..0x15fc4
    } else {
      if (run > best) {                                                       // 0x15fc9..0x15fcf (jle: signed)
        best = run;                                                           // 0x15fd1..0x15fd4
        k = (i - run) | 0;                                                    // 0x15fd7..0x15fdd
        W32(0x60bcc, R32((Math.imul(k, 0x18c) + 0x3a878) | 0));               // 0x15fe0..0x15fed
      }
      run = 0;                                                                // 0x15ff2
    }
  }
  // 0x15ffb..0x16024: same test once more after the loop (i == 0x1a here)
  if (run > best) {                                                           // 0x15ffb..0x16001 (jle: signed)
    best = run;                                                               // 0x16003..0x16006
    k = (i - run) | 0;                                                        // 0x16009..0x1600f
    W32(0x60bcc, R32((Math.imul(k, 0x18c) + 0x3a878) | 0));                   // 0x16012..0x1601f
  }
  run = 0;                                                                    // 0x16024
  W32(0x30bf4, 0x22);                                                         // 0x1602b

  // 0x16035: cmp dword [0x30bf4], 0x22; jne 0x16429
  while (R32(0x30bf4) === 0x22) {
    W32(0x60a64, await F.Timer_Query_235f9());                                // 0x16042..0x16047
    await F.sub_14fba();                                                      // 0x1604c
    await F.Erase_Sprite_Clip_211fc(0x33c30, R32(0x64e7c));                   // 0x16051..0x1605c
    await F.Erase_Sprite_Clip_211fc(0x33dbc, R32(0x64e7c));                   // 0x16061..0x1606c
    await F.Erase_Sprite_Clip_211fc(0x33918, R32(0x64e7c));                   // 0x16071..0x1607c
    await F.Erase_Sprite_Clip_211fc(0x3dd10, R32(0x64e7c));                   // 0x16081..0x1608c
    await F.Erase_Sprite_Clip_211fc(0x33aa4, R32(0x64e7c));                   // 0x16091..0x1609c
    await F.Erase_Sprite_Clip_211fc(0x45d74, R32(0x64e7c));                   // 0x160a1..0x160ac
    for (i = 0; i < 0x1a; i++) {                                              // 0x160b1..0x160df
      await F.Erase_Sprite_Clip_211fc((Math.imul(i, 0x18c) + 0x3a878) | 0, R32(0x64e7c));
    }
    for (i = 0; i < 7; i++) {                                                 // 0x160e1..0x1610f
      await F.Erase_Sprite_Clip_211fc((Math.imul(i, 0x18c) + 0x44010) | 0, R32(0x64e7c));
    }
    for (i = 0; i < 5; i++) {                                                 // 0x16111..0x1613f
      await F.Erase_Sprite_Clip_211fc((Math.imul(i, 0x18c) + 0x44ae4) | 0, R32(0x64e7c));
    }
    for (i = 0; i < 3; i++) {                                                 // 0x16141..0x1616f
      await F.Erase_Sprite_Clip_211fc((Math.imul(i, 0x18c) + 0x452a0) | 0, R32(0x64e7c));
    }
    W32(0x60bc4, 1);                                                          // 0x16171
    await F.sub_18f27();                                                      // 0x1617b
    await F.sub_15788();                                                      // 0x16180
    await F.sub_16837();                                                      // 0x16185
    await F.sub_14425();                                                      // 0x1618a
    await F.Behind_Sprite_Clip_2106f(0x33c30, R32(0x64e7c));                  // 0x1618f..0x1619a
    await F.Behind_Sprite_Clip_2106f(0x33dbc, R32(0x64e7c));                  // 0x1619f..0x161aa
    await F.Behind_Sprite_Clip_2106f(0x33918, R32(0x64e7c));                  // 0x161af..0x161ba
    await F.Behind_Sprite_Clip_2106f(0x3dd10, R32(0x64e7c));                  // 0x161bf..0x161ca
    await F.Behind_Sprite_Clip_2106f(0x45d74, R32(0x64e7c));                  // 0x161cf..0x161da
    await F.Behind_Sprite_Clip_2106f(0x33aa4, R32(0x64e7c));                  // 0x161df..0x161ea
    for (i = 0; i < 0x1a; i++) {                                              // 0x161ef..0x1621d
      await F.Behind_Sprite_Clip_2106f((Math.imul(i, 0x18c) + 0x3a878) | 0, R32(0x64e7c));
    }
    for (i = 0; i < 7; i++) {                                                 // 0x1621f..0x1624d
      await F.Behind_Sprite_Clip_2106f((Math.imul(i, 0x18c) + 0x44010) | 0, R32(0x64e7c));
    }
    for (i = 0; i < 5; i++) {                                                 // 0x1624f..0x1627d
      await F.Behind_Sprite_Clip_2106f((Math.imul(i, 0x18c) + 0x44ae4) | 0, R32(0x64e7c));
    }
    for (i = 0; i < 3; i++) {                                                 // 0x1627f..0x162ad
      await F.Behind_Sprite_Clip_2106f((Math.imul(i, 0x18c) + 0x452a0) | 0, R32(0x64e7c));
    }
    for (i = 0; i < 0x1a; i++) {                                              // 0x162af..0x162e2
      await F.Draw_Sprite_Clip_212c0((0x3a878 + Math.imul(i, 0x18c)) | 0, R32(0x64e7c), 1);
    }
    await F.Draw_Sprite_Clip_212c0(0x3dd10, R32(0x64e7c), 1);                 // 0x162e4..0x162f4
    await F.Draw_Sprite_Clip_212c0(0x45d74, R32(0x64e7c), 1);                 // 0x162f9..0x16309
    await F.Draw_Sprite_Clip_212c0(0x33c30, R32(0x64e7c), 1);                 // 0x1630e..0x1631e
    await F.Draw_Sprite_Clip_212c0(0x33dbc, R32(0x64e7c), 1);                 // 0x16323..0x16333
    await F.Draw_Sprite_Clip_212c0(0x33918, R32(0x64e7c), 1);                 // 0x16338..0x16348
    for (i = 0; i < 7; i++) {                                                 // 0x1634d..0x16380
      await F.Draw_Sprite_Clip_212c0((0x44010 + Math.imul(i, 0x18c)) | 0, R32(0x64e7c), 1);
    }
    for (i = 0; i < 4; i++) {                                                 // 0x16382..0x163b5
      await F.Draw_Sprite_Clip_212c0((0x44ae4 + Math.imul(i, 0x18c)) | 0, R32(0x64e7c), 1);
    }
    for (i = 0; i < 3; i++) {                                                 // 0x163b7..0x163ea
      await F.Draw_Sprite_Clip_212c0((0x452a0 + Math.imul(i, 0x18c)) | 0, R32(0x64e7c), 1);
    }
    await F.Draw_Sprite_Clip_212c0(0x33aa4, R32(0x64e7c), 1);                 // 0x163ec..0x163fc
    await F.Show_Double_Buffer_21531(R32(0x64e7c), 0);                        // 0x16401..0x16408
    // 0x1640d..0x16422: while (Timer_Query() - [0x60a64] < 1) sub_10050();  (cmp eax,1; jge: signed)
    // Busy-wait on the clock; sub_10050 does not yield (see header), so the loop yields.
    while ((((await F.Timer_Query_235f9()) - R32(0x60a64)) | 0) < 1) {
      await F.sub_10050();                                                    // 0x1641d
      await yieldCpu();
    }
  }                                                                           // 0x16424 jmp 0x16035
  await F.sub_15c34();                                                        // 0x16429
  W32(0x60bc4, 0);                                                            // 0x1642e
  await F.sub_1a825();                                                        // 0x16438
});
