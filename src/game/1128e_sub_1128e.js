// 0x1128e  void sub_1128e(void)   [Watcom, no args, no return value]
// Size 611 bytes (0x1128e..0x114f0).
// Args: none — EAX/EDX/EBX/ECX are loaded before any read; EBX/ECX/EDX/ESI/EDI/EBP are saved/restored
// (0x11298..0x1129d / 0x114e8..0x114ef).
// Return: none — EAX at the RET is Fill_Screen's leftover; the only call site (0x11aaa) is followed by
// 0x11aaf `xor eax, eax`, so EAX is not read.
// Summary (facts from the disassembly):
//   PCX_Init / PCX_Load("hiscore.pcx" 0x300cc, 0x31ee4, 1) / PCX_Copy_To_Buffer(.., [0x64e7c]) / PCX_Delete on the
//   pcx_picture at 0x31ee4 (LIBRARY.md); sprite 0x45d74: x (+0) = 0xfa, y (+4) = 10, Behind_Sprite_Clip;
//   [0x45d90] = 4 - rand() % 8, [0x45d94] = 3 - rand() % 6 (idiv remainders, 0x11321 / 0x11340); sub_107ce()
//   (draws the "scores.dat" table, see 107ce_sub_107ce.js); then loops until `done`:
//     dx/dy ([0x45d90]/[0x45d94]) forced from 0 to 1; x += dx, y += dy;
//     if x + width [0x45d7c] > 0x140 and dx > 0: dx = (-rand()) % 5;  if x < 0 and dx < 0: dx = rand() % 5;
//     if y + height [0x45d80] > 200 and dy > 0: dy = (-rand()) % 4;   if y < 0 and dy < 0: dy = rand() % 4;
//     sub_14fba(); Erase / Behind / Draw_Sprite_Clip(0x45d74, [0x64e7c](, 1)); Show_Double_Buffer([0x64e7c], 0);
//     sub_10050(); Time_Delay(1); counter--; done = 1 if counter < 0, or if counter < 0x122 and Space
//     [0x64fe8] != 0.
//   After the loop: Fill_Screen(0).
// Evidence: 0x45d74 is a sprite struct (x +0, y +4, width +8 = 0x45d7c, height +0xc = 0x45d80, LIBRARY.md
// sprite; passed as sprite* to Behind/Erase/Draw_Sprite_Clip here and in 16837_sub_16837.js). 0x31ee4 is the
// pcx_picture passed to PCX_Init/PCX_Load (LIBRARY.md). [0x64e7c] = double_buffer (LIBRARY.md).
// [0x64fe8] = keyboard_state[0x39] (Space), LIBRARY.md "Game-side use of keyboard_state".
// 0x45d90 / 0x45d94: address only (used as the per-iteration x / y increments here).
// Locals (sub esp,8): [ebp-8] counter (init 0x12c), [ebp-4] done flag — never address-taken, plain lets.
// All comparisons signed (jle/jg/jge/jl). No x87 instructions.
// Busy-wait note: the loop exit depends on [0x64fe8] (written by the keyboard ISR 0x22b04, LIBRARY.md) and on
// the iteration counter; its body awaits Time_Delay(1), which yields while waiting for the BIOS tick
// (20404_Time_Delay.js), so no extra yieldCpu is added (same reasoning as 1098f_sub_1098f.js).
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';
import { imod } from '../runtime/cpu.js';

register(0x1128e, 'sub_1128e', async function sub_1128e() {
  let counter; // [ebp-8]
  let done;    // [ebp-4]

  counter = 0x12c;                                                          // 0x112a6
  done = 0;                                                                 // 0x112ad
  await F.PCX_Init_207a0(0x31ee4);                                          // 0x112b4..0x112b9
  await F.PCX_Load_20806(0x300cc /* "hiscore.pcx" */, 0x31ee4, 1);          // 0x112be..0x112cd
  await F.PCX_Copy_To_Buffer_20bd7(0x31ee4, R32(0x64e7c));                  // 0x112d2..0x112dd
  await F.PCX_Delete_20b69(0x31ee4);                                        // 0x112e2..0x112e7
  W32(0x45d74, 0xfa);                                                       // 0x112ec
  W32(0x45d78, 0xa);                                                        // 0x112f6
  await F.Behind_Sprite_Clip_2106f(0x45d74, R32(0x64e7c));                  // 0x11300..0x1130b
  // 0x11310..0x1132a: idiv ebx(8); eax = 4 - edx (remainder)
  W32(0x45d90, (4 - imod(await F.rand_232c7(), 8)) | 0);
  // 0x1132f..0x11349: idiv ebx(6); eax = 3 - edx (remainder)
  W32(0x45d94, (3 - imod(await F.rand_232c7(), 6)) | 0);
  await F.sub_107ce();                                                      // 0x1134e

  while (done === 0) {                                                      // 0x11353: cmp [ebp-4],0; jne 0x114e1
    if (R32(0x45d90) === 0) {                                               // 0x1135d
      W32(0x45d90, (R32(0x45d90) + 1) | 0);                                 // 0x11366 inc
    }
    if (R32(0x45d94) === 0) {                                               // 0x1136c
      W32(0x45d94, (R32(0x45d94) + 1) | 0);                                 // 0x11375 inc
    }
    W32(0x45d74, (R32(0x45d74) + R32(0x45d90)) | 0);                        // 0x1137b..0x11380
    W32(0x45d78, (R32(0x45d78) + R32(0x45d94)) | 0);                        // 0x11386..0x1138b

    // 0x11391..0x113aa: x + width > 0x140 (jle) && dx > 0 (jg)
    if (((R32(0x45d74) + R32(0x45d7c)) | 0) > 0x140 && R32(0x45d90) > 0) {
      // 0x113ae..0x113c3: neg; idiv ecx(5); store edx (remainder)
      W32(0x45d90, imod((-(await F.rand_232c7())) | 0, 5));
    }
    // 0x113c9..0x113d9: x < 0 (jge) && dx < 0 (jl)
    if (R32(0x45d74) < 0 && R32(0x45d90) < 0) {
      W32(0x45d90, imod(await F.rand_232c7(), 5));                          // 0x113dd..0x113f0
    }
    // 0x113f6..0x1140f: y + height > 0xc8 (jle) && dy > 0 (jg)
    if (((R32(0x45d78) + R32(0x45d80)) | 0) > 0xc8 && R32(0x45d94) > 0) {
      // 0x11413..0x11428: neg; idiv ecx(4); store edx (remainder)
      W32(0x45d94, imod((-(await F.rand_232c7())) | 0, 4));
    }
    // 0x1142e..0x1143e: y < 0 (jge) && dy < 0 (jl)
    if (R32(0x45d78) < 0 && R32(0x45d94) < 0) {
      W32(0x45d94, imod(await F.rand_232c7(), 4));                          // 0x11442..0x11455
    }

    await F.sub_14fba();                                                    // 0x1145b
    await F.Erase_Sprite_Clip_211fc(0x45d74, R32(0x64e7c));                 // 0x11460..0x1146b
    await F.Behind_Sprite_Clip_2106f(0x45d74, R32(0x64e7c));                // 0x11470..0x1147b
    await F.Draw_Sprite_Clip_212c0(0x45d74, R32(0x64e7c), 1);               // 0x11480..0x11490
    await F.Show_Double_Buffer_21531(R32(0x64e7c), 0);                      // 0x11495..0x1149c
    await F.sub_10050();                                                    // 0x114a1
    await F.Time_Delay_20404(1);                                            // 0x114a6..0x114ab

    counter = (counter - 1) | 0;                                            // 0x114b0 add [ebp-8], -1
    if (counter < 0) {                                                      // 0x114b4 jge
      done = 1;                                                             // 0x114ba
    }
    // 0x114c1..0x114d1: counter < 0x122 (jge) && [0x64fe8] != 0 (jne)
    if (counter < 0x122 && R32(0x64fe8) !== 0) {
      done = 1;                                                             // 0x114d5
    }
  }                                                                         // 0x114dc jmp 0x11353
  await F.Fill_Screen_20768(0);                                             // 0x114e1..0x114e3
});
