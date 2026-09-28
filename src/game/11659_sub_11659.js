// 0x11659  void sub_11659(void)   [Watcom, no args, no return value]
// Size 1489 bytes (0x11659..0x11c29 RET).
// Args: none — EAX/EDX/EBX/ECX are loaded before any read; EBX/ECX/EDX/ESI/EDI/EBP are saved/restored
// (0x11663..0x11668 / 0x11c23..0x11c28). signatures.json: regs 0, stack 0.
// Return: none — EAX at the RET is PCX_Delete's leftover; the only call site (0x1cbf1) is followed by
// 0x1cbf6 `xor eax, eax`, so EAX is not read.
// Summary (facts from the disassembly):
//   PCX_Init/PCX_Load(file, pic, 1) for the pcx_picture structs (LIBRARY.md) 0x329ac ("mainmnb.pcx" 0x300f4),
//   0x3227c ("mainmnb2.pcx" 0x30100), 0x32614 ("mainmnb3.pcx" 0x3010d), 0x32d44 ("mainmnb4.pcx" 0x3011a),
//   0x330dc ("mainmnb5.pcx" 0x30127); Read_Palette(0, 0xff, local palette) right after the first load;
//   Squeeze_Mouse(0, 0, 0, 0x60b50); Squeeze_Mouse(2, 0, 0, 0); [0x33c0c] = 1;
//   Behind_Sprite_Clip(0x33aa4, [0x64e7c]). Then loops until local [ebp-0x1c] == 0x22:
//     [0x60a64] = Timer_Query(); [0x33c2c] = 1;
//     switch on [ebp-0x10] (unsigned, 0..4, jump table 0x11870): PCX_Copy_To_Buffer of 0x3227c / 0x32614 /
//       0x329ac / 0x32d44 / 0x330dc to [0x64e7c]; case 0: [ebp-0x14] = 0, [ebp-0x10]++; cases 1..3:
//       [ebp-0x10]++ if [ebp-0x14] == 0 else [ebp-0x10]--; case 4: [ebp-0x14] = 1, [ebp-0x10]--;
//     Squeeze_Mouse(3, 0x60b48, 0x60b4c, 0x60b50); sprite 0x33aa4 x (+0) = ([0x60b48] sar 1) - 0x10,
//       y (+4, 0x33aa8) = [0x60b4c];
//     [ebp-4]: if 0 and [0x60b50] == 1 -> dws_DPlay(0x61160), [ebp-4] = 1; if 1 and [0x60b50] != 1 -> 0;
//     four rectangle tests on (x, y) (all strict, signed) combined with [0x60b50] == 1 — see below;
//     [ebp-0xc] counter (init 0x168) and [ebp-8] latch with [0x64fe8]; the block calling sub_1128e;
//     sub_14fba(); Draw_Sprite_Clip(0x33aa4, [0x64e7c], 1); Show_Double_Buffer([0x64e7c], 0);
//     waits until Timer_Query() - [0x60a64] >= 2 calling sub_10050();
//   After the loop: PCX_Delete of the five pcx_picture structs.
// Evidence: 0x33aa4 is the sprite* of Behind/Draw_Sprite_Clip (LIBRARY.md sprite: x +0, y +4). 0x60b48 /
// 0x60b4c / 0x60b50 are the x / y / buttons pointers of Squeeze_Mouse cmd 3 (230df_Squeeze_Mouse.js).
// [0x64e7c] = double_buffer (LIBRARY.md). [0x64fe8] = keyboard_state[0x39] (Space), LIBRARY.md "Game-side use
// of keyboard_state". 0x61160 / 0x61180: passed as dws_DPLAY* to dws_DPlay (LIBRARY.md).
// 0x31ee4: pcx_picture passed to PCX_Init/PCX_Load ("blank.pcx" 0x30134 / "howto.pcx" 0x3013e).
// 0x33c0c, 0x33c2c, 0x30be4, 0x60a64: address only.
// Frame (sub esp,0x328), one emulated block laid out like the original:
//   [ebp-0x328] switch value (copy of [ebp-0x10]); [ebp-0x324] RGB_palette (LIBRARY.md: start +0, end +4,
//   colors +8; Read_Palette(0, 0xff) writes up to +0x307, i.e. up to [ebp-0x1d]); [ebp-0x1c] loop-exit value;
//   [ebp-0x18] written once (0), never read; [ebp-0x14], [ebp-0x10], [ebp-0xc], [ebp-8], [ebp-4] as above.
//   The palette's address is passed to Read_Palette / Write_Palette, so the whole frame lives in memory.
// Busy-wait notes: the loop at 0x11b1e exits on the BIOS tick (Timer_Query) and the loop at 0x11bb0 on
// [0x64fe8] (written by the keyboard ISR 0x22b04, LIBRARY.md). Their only body call, sub_10050, calls
// dws_MSongStatus / dws_MPlay / dws_DPlay, which are synchronous (10050_sub_10050.js, lib ports) and do not
// yield, so both loops get `await yieldCpu()`.
// All dword comparisons signed (jle/jl/jg/jge) except the switch bound (ja). No x87 instructions.
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';
import { stackAlloc, stackFree } from '../runtime/stack.js';
import { yieldCpu } from '../runtime/cpu.js';
import { KEY, SPRITE, doubleBuffer, frameStartTime, gameState, gunSight, keyboardState, mainMenuPcx, mainMenuPcx2, mainMenuPcx3, mainMenuPcx4, mainMenuPcx5, mouseButtons, mouseX, mouseY, pcxScratch, sndClick, sndDoubleClick } from './data.js';

register(0x11659, 'sub_11659', async function sub_11659() {
  const frame = stackAlloc(0x328);             // 0x1166b sub esp, 0x328
  const L = (off) => frame + 0x328 - off;      // address of [ebp - off]
  const V328 = L(0x328);                       // [ebp-0x328]: switch value
  const PAL = L(0x324);                        // [ebp-0x324]: RGB_palette (address passed to Read/Write_Palette)
  const V1C = L(0x1c);                         // [ebp-0x1c]
  const V18 = L(0x18);                         // [ebp-0x18]
  const V14 = L(0x14);                         // [ebp-0x14]
  const V10 = L(0x10);                         // [ebp-0x10]
  const V0C = L(0xc);                          // [ebp-0xc]
  const V08 = L(8);                            // [ebp-8]
  const V04 = L(4);                            // [ebp-4]

  W32(V18, 0);                                                              // 0x11671
  W32(V1C, 0);                                                              // 0x11678
  W32(V04, 0);                                                              // 0x1167f
  W32(V14, 0);                                                              // 0x11686
  W32(V10, 0);                                                              // 0x1168d
  W32(V0C, 0x168);                                                          // 0x11694
  W32(V08, 0);                                                              // 0x1169b
  F.PCX_Init_207a0(mainMenuPcx);                                          // 0x116a2..0x116a7
  F.PCX_Load_20806(0x300f4 /* "mainmnb.pcx" */, mainMenuPcx, 1);          // 0x116ac..0x116bb
  F.Read_Palette_20618(0, 0xff, PAL);                                 // 0x116c0..0x116cd
  F.PCX_Init_207a0(mainMenuPcx2);                                          // 0x116d2..0x116d7
  F.PCX_Load_20806(0x30100 /* "mainmnb2.pcx" */, mainMenuPcx2, 1);         // 0x116dc..0x116eb
  F.PCX_Init_207a0(mainMenuPcx3);                                          // 0x116f0..0x116f5
  F.PCX_Load_20806(0x3010d /* "mainmnb3.pcx" */, mainMenuPcx3, 1);         // 0x116fa..0x11709
  F.PCX_Init_207a0(mainMenuPcx4);                                          // 0x1170e..0x11713
  F.PCX_Load_20806(0x3011a /* "mainmnb4.pcx" */, mainMenuPcx4, 1);         // 0x11718..0x11727
  F.PCX_Init_207a0(mainMenuPcx5);                                          // 0x1172c..0x11731
  F.PCX_Load_20806(0x30127 /* "mainmnb5.pcx" */, mainMenuPcx5, 1);         // 0x11736..0x11745
  F.Squeeze_Mouse_230df(0, 0, 0, mouseButtons);                            // 0x1174a..0x11755
  F.Squeeze_Mouse_230df(2, 0, 0, 0);                                  // 0x1175a..0x11765
  W32((gunSight + SPRITE.currFrame), 1);                                                          // 0x1176a
  F.Behind_Sprite_Clip_2106f(gunSight, R32(doubleBuffer));                  // 0x11774..0x1177f

  while ((R32(V1C) | 0) !== 0x22) {                                         // 0x11784 cmp [ebp-0x1c],0x22; je 0x11bef
    W32(frameStartTime, F.Timer_Query_235f9());                              // 0x1178e..0x11793
    W32((gunSight + SPRITE.visible), 1);                                                        // 0x11798
    W32(V328, R32(V10));                                                    // 0x117a2..0x117a5
    // 0x11884: cmp [ebp-0x328],4; ja 0x1186d (unsigned) -> jmp 0x1189c; else jmp [eax*4 + 0x11870]
    // (table: 0x117b0, 0x117d2, 0x117fc, 0x11826, 0x1184d). `mov eax,[ebp-0x10]` before each inc/add is dead.
    switch (R32(V328) >>> 0) {
      case 0:                                                               // 0x117b0
        F.PCX_Copy_To_Buffer_20bd7(mainMenuPcx2, R32(doubleBuffer));
        W32(V14, 0);                                                        // 0x117c0
        W32(V10, R32(V10) + 1);                                             // 0x117ca inc
        break;
      case 1:                                                               // 0x117d2
        F.PCX_Copy_To_Buffer_20bd7(mainMenuPcx3, R32(doubleBuffer));
        if (R32(V14) === 0) W32(V10, R32(V10) + 1);                         // 0x117e2..0x117eb
        else W32(V10, R32(V10) - 1);                                        // 0x117f3 add -1
        break;
      case 2:                                                               // 0x117fc
        F.PCX_Copy_To_Buffer_20bd7(mainMenuPcx, R32(doubleBuffer));
        if (R32(V14) === 0) W32(V10, R32(V10) + 1);                         // 0x1180c..0x11815
        else W32(V10, R32(V10) - 1);                                        // 0x1181d
        break;
      case 3:                                                               // 0x11826
        F.PCX_Copy_To_Buffer_20bd7(mainMenuPcx4, R32(doubleBuffer));
        if (R32(V14) === 0) W32(V10, R32(V10) + 1);                         // 0x11836..0x1183f
        else W32(V10, R32(V10) - 1);                                        // 0x11847
        break;
      case 4:                                                               // 0x1184d
        F.PCX_Copy_To_Buffer_20bd7(mainMenuPcx5, R32(doubleBuffer));
        W32(V14, 1);                                                        // 0x1185d
        W32(V10, R32(V10) - 1);                                             // 0x11867
        break;
      default:                                                              // 0x1186d jmp 0x1189c
        break;
    }

    F.Squeeze_Mouse_230df(3, mouseX, mouseY, mouseButtons);              // 0x1189c..0x118b0
    W32(gunSight, ((R32(mouseX) >> 1) - 0x10) | 0);                         // 0x118b5..0x118bf sar; sub
    W32((gunSight + SPRITE.y), R32(mouseY));                                             // 0x118c4..0x118c9

    // 0x118ce..0x118db: [ebp-4] == 0 && [0x60b50] == 1
    if (R32(V04) === 0 && R32(mouseButtons) === 1) {
      F.dws_DPlay_1eff8(sndClick);                                     // 0x118df..0x118ea (cdecl)
      W32(V04, 1);                                                          // 0x118ed
    }
    // 0x118f4..0x11901: [ebp-4] == 1 && [0x60b50] != 1
    if (R32(V04) === 1 && R32(mouseButtons) !== 1) {
      W32(V04, 0);                                                          // 0x11905
    }

    // 0x1190c..0x1193d: 0xf < x < 0x7e && 9 < y < 0x34 && [0x60b50] == 1
    if ((R32(gunSight) | 0) > 0xf && (R32(gunSight) | 0) < 0x7e &&
        (R32((gunSight + SPRITE.y)) | 0) > 9 && (R32((gunSight + SPRITE.y)) | 0) < 0x34 && R32(mouseButtons) === 1) {
      W32(gameState, 0x22);                                                   // 0x11941
      W32(V1C, 0x22);                                                       // 0x1194b
      F.dws_DPlay_1eff8(sndDoubleClick);                                     // 0x11952..0x1195d
    }
    // 0x11960..0x1199d: 0xca < x < 0x132 && 0x93 < y < 0xb5 && [0x60b50] == 1
    if ((R32(gunSight) | 0) > 0xca && (R32(gunSight) | 0) < 0x132 &&
        (R32((gunSight + SPRITE.y)) | 0) > 0x93 && (R32((gunSight + SPRITE.y)) | 0) < 0xb5 && R32(mouseButtons) === 1) {
      W32(gameState, 0x25);                                                   // 0x119a1
      W32(V1C, 0x22);                                                       // 0x119ab
      F.dws_DPlay_1eff8(sndDoubleClick);                                     // 0x119b2..0x119bd
    }
    // 0x119c0..0x119f7: 0xca < x < 0x132 && 0xc < y < 0x2b && [0x60b50] == 1
    if ((R32(gunSight) | 0) > 0xca && (R32(gunSight) | 0) < 0x132 &&
        (R32((gunSight + SPRITE.y)) | 0) > 0xc && (R32((gunSight + SPRITE.y)) | 0) < 0x2b && R32(mouseButtons) === 1) {
      F.Fill_Screen_20768(0);                                         // 0x119fb..0x119fd
      F.PCX_Init_207a0(pcxScratch);                                      // 0x11a02..0x11a07
      F.PCX_Load_20806(0x30134 /* "blank.pcx" */, pcxScratch, 1);        // 0x11a0c..0x11a1b
      F.PCX_Copy_To_Buffer_20bd7(pcxScratch, R32(doubleBuffer));              // 0x11a20..0x11a2b
      F.PCX_Delete_20b69(pcxScratch);                                    // 0x11a30..0x11a35
      await F.sub_10cac();                                                  // 0x11a3a
      F.Fill_Screen_20768(0);                                         // 0x11a3f..0x11a41
      F.Write_Palette_2069f(0, 0xff, PAL);                            // 0x11a46..0x11a53
      W32((gunSight + SPRITE.currFrame), 1);                                                      // 0x11a58
      F.dws_DPlay_1eff8(sndDoubleClick);                                     // 0x11a62..0x11a6d
    }

    // 0x11a70..0x11a7d: [0x64fe8] == 0 && [ebp-8] == 1
    if (R32((keyboardState + 4 * KEY.space)) === 0 && R32(V08) === 1) {
      W32(V08, 0);                                                          // 0x11a81
    }
    W32(V0C, R32(V0C) - 1);                                                 // 0x11a88 add [ebp-0xc], -1
    // 0x11a8c..0x11a9f: [ebp-0xc] < 0 (jl) || ([0x64fe8] != 0 && [ebp-8] == 0)
    if ((R32(V0C) | 0) < 0 || (R32((keyboardState + 4 * KEY.space)) !== 0 && R32(V08) === 0)) {
      F.Fill_Screen_20768(0);                                         // 0x11aa3..0x11aa5
      await F.sub_1128e();                                                  // 0x11aaa
      F.Fill_Screen_20768(0);                                         // 0x11aaf..0x11ab1
      await F.Time_Delay_20404(1);                                          // 0x11ab6..0x11abb
      F.Write_Palette_2069f(0, 0xff, PAL);                            // 0x11ac0..0x11acd
      W32((gunSight + SPRITE.currFrame), 1);                                                      // 0x11ad2
      F.dws_DPlay_1eff8(sndDoubleClick);                                     // 0x11adc..0x11ae7
      W32(V0C, 0x168);                                                      // 0x11aea
      W32(V08, 1);                                                          // 0x11af1
    }

    F.sub_14fba();                                                    // 0x11af8
    F.Draw_Sprite_Clip_212c0(gunSight, R32(doubleBuffer), 1);               // 0x11afd..0x11b0d
    F.Show_Double_Buffer_21531(R32(doubleBuffer), 0);                      // 0x11b12..0x11b19

    // 0x11b1e..0x11b33: while (Timer_Query() - [0x60a64] < 2 (jge exits)) sub_10050();
    // Busy-wait on the clock; sub_10050 does not yield (see header), so the loop yields.
    while ((((F.Timer_Query_235f9()) - R32(frameStartTime)) | 0) < 2) {
      F.sub_10050();                                                  // 0x11b2e
      await yieldCpu();
    }

    // 0x11b35..0x11b6c: 0x17 < x < 0x78 && 0x93 < y < 0xb5 && [0x60b50] == 1
    if ((R32(gunSight) | 0) > 0x17 && (R32(gunSight) | 0) < 0x78 &&
        (R32((gunSight + SPRITE.y)) | 0) > 0x93 && (R32((gunSight + SPRITE.y)) | 0) < 0xb5 && R32(mouseButtons) === 1) {
      F.dws_DPlay_1eff8(sndDoubleClick);                                     // 0x11b73..0x11b7e
      F.Fill_Screen_20768(0);                                         // 0x11b81..0x11b83
      F.PCX_Init_207a0(pcxScratch);                                      // 0x11b88..0x11b8d
      F.PCX_Load_20806(0x3013e /* "howto.pcx" */, pcxScratch, 1);        // 0x11b92..0x11ba1
      F.PCX_Show_Buffer_20b9b(pcxScratch);                               // 0x11ba6..0x11bab
      // 0x11bb0..0x11bbe: while ([0x64fe8] == 0) sub_10050();
      // Busy-wait on keyboard_state written by the ISR 0x22b04 (LIBRARY.md); sub_10050 does not yield.
      while (R32((keyboardState + 4 * KEY.space)) === 0) {
        F.sub_10050();                                                // 0x11bb9
        await yieldCpu();
      }
      F.PCX_Delete_20b69(pcxScratch);                                    // 0x11bc0..0x11bc5
      F.Fill_Screen_20768(0);                                         // 0x11bca..0x11bcc
      W32(V08, 1);                                                          // 0x11bd1
      F.Write_Palette_2069f(0, 0xff, PAL);                            // 0x11bd8..0x11be5
    }
  }                                                                         // 0x11bea jmp 0x11784

  F.PCX_Delete_20b69(mainMenuPcx);                                        // 0x11bef..0x11bf4
  F.PCX_Delete_20b69(mainMenuPcx2);                                        // 0x11bf9..0x11bfe
  F.PCX_Delete_20b69(mainMenuPcx3);                                        // 0x11c03..0x11c08
  F.PCX_Delete_20b69(mainMenuPcx4);                                        // 0x11c0d..0x11c12
  F.PCX_Delete_20b69(mainMenuPcx5);                                        // 0x11c17..0x11c1c
  stackFree(0x328);                                                         // 0x11c21 epilogue
});
