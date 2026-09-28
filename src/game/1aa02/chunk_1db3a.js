// Chunk G3 of main (0x1aa02): range [0x1db3a, 0x1dffd).
// Entry 0x1db3a, single exit 0x1dffd (the `jmp 0x1d0b4` of loop C, handled by the skeleton).
// No live registers/locals at either end (MAIN_PLAN.md §2). Local: [ebp-8] (chunk-local let).
// Contents: Draw_Sprite_Clip over sprite-struct arrays (stride 0x18c) and single structs, conditional draws
// (0x1dca2, 0x1dccf loop, 0x1dd6f, 0x1dd8d, 0x1ddba loop, 0x1ddff loop), loop 0x1de71 over the 0x30-stride
// table at 0x5ff20 with signed bounds tests and Write_Pixel_DB, Draw_Sprite_Clip(0x33aa4),
// Show_Double_Buffer, sub_10050, the tick busy-wait 0x1dfc2..0x1dfd7, sub_15c7d, and the [0x60bc0] == 1 block.
// Callees: Draw_Sprite_Clip_212c0 x23 call sites, Write_Pixel_DB_22219, Show_Double_Buffer_21531,
// sub_10050 x2 call sites, Timer_Query_235f9, sub_15c7d, sub_16b96, Fill_Screen_20768.
// Draw_Sprite_Clip(EAX = sprite, EDX = [0x64e7c], EBX = 1) at every site. The `mov eax,[ebp-8]` before every
// `inc [ebp-8]` is a dead read and produces nothing.
// Busy-wait: 0x1dfc2..0x1dfd7 exits only on Timer_Query() (BIOS tick 0x46C, lib/235f9_Timer_Query.js);
// sub_10050 (its body call) does not yield, so the loop body does `await yieldCpu()` (PORTING.md).
import { F } from '../../runtime/registry.js';
import { R32, W32 } from '../../runtime/mem.js';
import { yieldCpu } from '../../runtime/cpu.js';

export async function chunk_1db3a() {
  let i; // [ebp-8]

  for (i = 0; i < 0x1a; i++) {                                                  // 0x1db3a..0x1db4d, 0x1db6d
    F.Draw_Sprite_Clip_212c0((0x3a878 + Math.imul(i, 0x18c)) | 0, R32(0x64e7c), 1); // 0x1db4f..0x1db68
  }
  for (i = 0; i < 3; i++) {                                                     // 0x1db6f..0x1db82, 0x1dba2
    F.Draw_Sprite_Clip_212c0((0x3d86c + Math.imul(i, 0x18c)) | 0, R32(0x64e7c), 1); // 0x1db84..0x1db9d
  }
  for (i = 0; i < 0x3f; i++) {                                                  // 0x1dba4..0x1dbb7, 0x1dbd7
    F.Draw_Sprite_Clip_212c0((0x3de9c + Math.imul(i, 0x18c)) | 0, R32(0x64e7c), 1); // 0x1dbb9..0x1dbd2
  }
  for (i = 0; i < 1; i++) {                                                     // 0x1dbd9..0x1dbec, 0x1dc0c
    F.Draw_Sprite_Clip_212c0((0x3d0b0 + Math.imul(i, 0x18c)) | 0, R32(0x64e7c), 1); // 0x1dbee..0x1dc07
  }
  for (i = 0; i < 4; i++) {                                                     // 0x1dc0e..0x1dc21, 0x1dc41
    F.Draw_Sprite_Clip_212c0((0x3d23c + Math.imul(i, 0x18c)) | 0, R32(0x64e7c), 1); // 0x1dc23..0x1dc3c
  }
  for (i = 0; i < 5; i++) {                                                     // 0x1dc43..0x1dc56, 0x1dc76
    F.Draw_Sprite_Clip_212c0((0x33f48 + Math.imul(i, 0x18c)) | 0, R32(0x64e7c), 1); // 0x1dc58..0x1dc71
  }
  F.Draw_Sprite_Clip_212c0(0x4c38c, R32(0x64e7c), 1);                     // 0x1dc78..0x1dc88
  F.Draw_Sprite_Clip_212c0(0x45d74, R32(0x64e7c), 1);                     // 0x1dc8d..0x1dc9d
  if (R32(0x5fbe8) === 1) {                                                     // 0x1dca2..0x1dca9 jne 0x1dcc0
    F.Draw_Sprite_Clip_212c0(0x5fa78, R32(0x64e7c), 1);                   // 0x1dcab..0x1dcbb
  }
  for (i = 0; i < 0xd; i++) {                                                   // 0x1dcc0..0x1dcd3, 0x1dd03
    if (R32((0x34874 + Math.imul(i, 0x18c)) | 0) === 1) {                       // 0x1dcd5..0x1dce3 jne 0x1dd03
      F.Draw_Sprite_Clip_212c0((0x34704 + Math.imul(i, 0x18c)) | 0, R32(0x64e7c), 1); // 0x1dce5..0x1dcfe
    }
  }
  for (i = 0; i < 0x19; i++) {                                                  // 0x1dd05..0x1dd18, 0x1dd38
    F.Draw_Sprite_Clip_212c0((0x381cc + Math.imul(i, 0x18c)) | 0, R32(0x64e7c), 1); // 0x1dd1a..0x1dd33
  }
  for (i = 0; i < 0x19; i++) {                                                  // 0x1dd3a..0x1dd4d, 0x1dd6d
    F.Draw_Sprite_Clip_212c0((0x35b20 + Math.imul(i, 0x18c)) | 0, R32(0x64e7c), 1); // 0x1dd4f..0x1dd68
  }
  if (R32(0x46070) === 1) {                                                     // 0x1dd6f..0x1dd76 jne 0x1dd8d
    F.Draw_Sprite_Clip_212c0(0x45f00, R32(0x64e7c), 1);                   // 0x1dd78..0x1dd88
  }
  if (R32(0x461fc) === 1) {                                                     // 0x1dd8d..0x1dd94 jne 0x1ddab
    F.Draw_Sprite_Clip_212c0(0x4608c, R32(0x64e7c), 1);                   // 0x1dd96..0x1dda6
  }
  for (i = 0; i < 0x3f; i++) {                                                  // 0x1ddab..0x1ddbe, 0x1ddee
    if (R32((0x46388 + Math.imul(i, 0x18c)) | 0) === 1) {                       // 0x1ddc0..0x1ddce jne 0x1ddee
      F.Draw_Sprite_Clip_212c0((0x46218 + Math.imul(i, 0x18c)) | 0, R32(0x64e7c), 1); // 0x1ddd0..0x1dde9
    }
  }
  for (i = 0; i < 0xc8; i++) {                                                  // 0x1ddf0..0x1de06, 0x1de36
    if (R32((0x4c688 + Math.imul(i, 0x18c)) | 0) === 1) {                       // 0x1de08..0x1de16 jne 0x1de36
      F.Draw_Sprite_Clip_212c0((0x4c518 + Math.imul(i, 0x18c)) | 0, R32(0x64e7c), 1); // 0x1de18..0x1de31
    }
  }
  F.Draw_Sprite_Clip_212c0(0x33c30, R32(0x64e7c), 1);                     // 0x1de38..0x1de48
  F.Draw_Sprite_Clip_212c0(0x33dbc, R32(0x64e7c), 1);                     // 0x1de4d..0x1de5d

  for (i = 0; i < 0x3c; i++) {                                                  // 0x1de62..0x1de75, 0x1dee6
    const e = Math.imul(i, 0x30);                                               // imul eax,[ebp-8],0x30 (recomputed at each use)
    // 0x1de7b..0x1deb7: skip (-> 0x1dee6) if [e+0x5ff20] < 0 (jl) or > 0x140 (jle not taken),
    // or [e+0x5ff24] < 0 (jge not taken) or > 0xc8 (jle not taken). All compares signed.
    if (R32(e + 0x5ff20) < 0) continue;                                         // 0x1de7b..0x1de86 jl 0x1de98 -> 0x1dea7 -> 0x1deb9 -> 0x1dee6
    if (R32(e + 0x5ff20) > 0x140) continue;                                     // 0x1de88..0x1de98
    if (R32(e + 0x5ff24) < 0) continue;                                         // 0x1de9a..0x1dea7
    if (R32(e + 0x5ff24) > 0xc8) continue;                                      // 0x1dea9..0x1deb9
    if (R32(e + 0x5ff2c) === 1) {                                               // 0x1debb..0x1dec6 jne 0x1dee6
      // 0x1dec8 ebx=0xe0; 0x1decd..0x1ded1 edx=[e+0x5ff24]; 0x1ded7..0x1dedb eax=[e+0x5ff20]
      const y = R32(e + 0x5ff24);
      const x = R32(e + 0x5ff20);
      F.Write_Pixel_DB_22219(x, y, 0xe0);                                 // 0x1dee1
    }
  }

  F.Draw_Sprite_Clip_212c0(0x33918, R32(0x64e7c), 1);                     // 0x1dee8..0x1def8
  for (i = 0; i < 7; i++) {                                                     // 0x1defd..0x1df10, 0x1df30
    F.Draw_Sprite_Clip_212c0((0x44010 + Math.imul(i, 0x18c)) | 0, R32(0x64e7c), 1); // 0x1df12..0x1df2b
  }
  for (i = 0; i < 4; i++) {                                                     // 0x1df32..0x1df45, 0x1df65
    F.Draw_Sprite_Clip_212c0((0x44ae4 + Math.imul(i, 0x18c)) | 0, R32(0x64e7c), 1); // 0x1df47..0x1df60
  }
  for (i = 0; i < 3; i++) {                                                     // 0x1df67..0x1df7a, 0x1df9a
    F.Draw_Sprite_Clip_212c0((0x452a0 + Math.imul(i, 0x18c)) | 0, R32(0x64e7c), 1); // 0x1df7c..0x1df95
  }
  F.Draw_Sprite_Clip_212c0(0x33aa4, R32(0x64e7c), 1);                     // 0x1df9c..0x1dfac
  F.Show_Double_Buffer_21531(R32(0x64e7c), 0);                            // 0x1dfb1..0x1dfb8 (xor edx,edx)
  F.sub_10050();                                                          // 0x1dfbd

  // 0x1dfc2..0x1dfd7: while (Timer_Query() - [0x60a64] < 1) sub_10050();  (sub; cmp eax,1; jge: signed)
  // [0x60a64] is written at 0x1d0c6 (chunk G1). Busy-wait on the clock; sub_10050 does not yield.
  while ((((F.Timer_Query_235f9()) - R32(0x60a64)) | 0) < 1) {
    F.sub_10050();                                                        // 0x1dfd2
    await yieldCpu();
  }

  await F.sub_15c7d();                                                          // 0x1dfd9
  if (R32(0x60bc0) === 1) {                                                     // 0x1dfde..0x1dfe5 jne 0x1dffd
    await F.sub_16b96();                                                        // 0x1dfe7
    F.Fill_Screen_20768(0);                                               // 0x1dfec..0x1dfee (xor eax,eax)
    W32(0x30be4, 0x1c);                                                         // 0x1dff3
  }
}
