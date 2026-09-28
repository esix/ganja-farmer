// 0x18a58  void sub_18a58(void)   [Watcom, no args, no return value]
// Args: none — the prologue pushes EBX/ECX/EDX/ESI/EDI (all saved, none read before being written);
// signatures.json regs 0 / stack 0. Only caller: 0x1d680 (`call 0x18a58`, followed by `call 0x14fba`, EAX not
// read). Return: none — EAX at the RET (0x18f26) is a leftover (last callee result / arithmetic).
// Per-call update of the sprite at 0x4c38c (0x4c38c is a sprite: decompiled.c line 2841
// `Erase_Sprite_Clip(&DAT_0004c38c, ...)`; field names from the sprite struct in LIBRARY.md):
//   0x4c38c x, 0x4c390 y, 0x4c394 width, 0x4c398 height, 0x4c39c counter_1, 0x4c3a0 counter_2,
//   0x4c3a4 counter_3, 0x4c3ac threshold_2, 0x4c4f4 curr_frame, 0x4c4fc state.
// and of the 26-entry sprite array at 0x3a878 (stride 0x18c; see 14425_sub_14425.js header):
//   0x3a878 x, 0x3a880 width, 0x3a9e0 curr_frame, 0x3a9e8 state.
// Steps: DAC entry 0xa5 := 3 bytes rand()%63 (Write_Color_Reg); height = 0x22; curr_frame toggles 0/1;
// then a state machine on [0x4c4fc] (values 0, 0x3d, 0x3e, 0x3f, 0x1b, 0x1c, 0x40) moving x/y, selecting an
// index into the 0x3a878 array ([0x60bd0]), and calling dws_DPlay / dws_DDiscard / dws_DSoundStatus on the
// dws_DPLAY structs at 0x61620 and 0x61640 (+0xA soundnum, LIBRARY.md).
// Local [ebp-4..ebp-2] (3 bytes, address passed to Write_Color_Reg as RGB_color* (LIBRARY.md)) is
// address-taken -> emulated stack. [ebp-8] (running minimum) and [ebp-0xc] (loop counter) are plain locals.
import { F, register } from '../runtime/registry.js';
import { R16, R32, W8, W32, R8 } from '../runtime/mem.js';
import { imod } from '../runtime/cpu.js';
import { stackAlloc, stackFree } from '../runtime/stack.js';

register(0x18a58, 'sub_18a58', async function sub_18a58() {
  let best; // [ebp-8]
  let i;    // [ebp-0xc]
  let a, c;
  const col = stackAlloc(4); // [ebp-4] (dword slot; bytes +0..+2 used)

  best = 0x17c;                                                        // 18a70
  // 18a77..18a81: movsw; movsb — copy 3 bytes from 0x64e78 into [ebp-4]
  W8(col, R8(0x64e78)); W8(col + 1, R8(0x64e79)); W8(col + 2, R8(0x64e7a));
  W8(col, imod(await F.rand_232c7(), 0x3f) & 0xff);                    // 18a82..18a95: mov [ebp-4], dl
  W8(col + 1, imod(await F.rand_232c7(), 0x3f) & 0xff);                // 18a98..18aab: mov [ebp-3], dl
  W8(col + 2, imod(await F.rand_232c7(), 0x3f) & 0xff);                // 18aae..18ac1: mov [ebp-2], dl
  await F.Write_Color_Reg_20541(0xa5, col);                            // 18ac4..18acc
  W32(0x4c398, 0x22);                                                  // 18ad1: height = 0x22
  W32(0x4c4f4, (R32(0x4c4f4) + 1) | 0);                                // 18adb: inc curr_frame
  if (R32(0x4c4f4) > 1) W32(0x4c4f4, 0);                               // 18ae1: jle (signed)

  if (R32(0x4c4fc) === 0x3d) W32(0x4c390, (R32(0x4c390) - 3) | 0);    // 18af4..18afd

  if (R32(0x4c4fc) === 0) {                                            // 18b04
    W32(0x4c390, (-0x50 - imod(await F.rand_232c7(), 0xc8)) | 0);      // 18b0d..18b27: ecx=0xffffffb0; sub ecx,edx
    if (R32(0x60bbc) === 0) {                                          // 18b2d
      W32(0x4c4fc, 0x3e);                                              // 18b36
      W32(0x4c38c, imod(await F.rand_232c7(), 0x10e));                 // 18b40..18b53
      W32(0x4c39c, imod(await F.rand_232c7(), 0x24));                  // 18b59..18b6c
      W32(0x4c3a0, 2);                                                 // 18b72
      W32(0x4c3ac, 0x1e);                                              // 18b7c
    }
  }

  if (R32(0x4c4fc) === 0x3f) {                                         // 18b86
    W32(0x4c390, (R32(0x4c390) - 5) | 0);                              // 18b8f
    if (R32(0x4c390) < -0x50) {                                        // 18b96: jge (signed)
      W32(0x4c4fc, 0x3e);                                              // 18b9f
      W32(0x4c38c, imod(await F.rand_232c7(), 0x10e));                 // 18ba9..18bbc
      W32(0x4c39c, imod(await F.rand_232c7(), 0x24));                  // 18bc2..18bd5
      W32(0x4c3a0, 2);                                                 // 18bdb
    }
  }

  if (R32(0x4c4fc) === 0x3e) {                                         // 18be5
    W32(0x4c390, (R32(0x4c390) + 3) | 0);                              // 18bf2
    W32(0x4c39c, (R32(0x4c39c) - 1) | 0);                              // 18bf9
    if (R32(0x4c39c) < 0) {                                            // 18bff: jge (signed)
      if (R32(0x4c3a0) >= 0) {                                         // 18c08: jl (signed)
        W32(0x4c3a0, imod((-(await F.rand_232c7())) | 0, 5));          // 18c11..18c26: neg edx; idiv 5
      } else {
        W32(0x4c3a0, imod(await F.rand_232c7(), 5));                   // 18c2e..18c41
      }
      W32(0x4c39c, imod(await F.rand_232c7(), 0x24));                  // 18c47..18c5a
    }
    if (R32(0x4c390) > 0x6c) {                                         // 18c60: jle (signed)
      for (i = 0; i < 0x1a; i++) {                                     // 18c6d..18c80, 18c76 (mov eax,[ebp-0xc] dead)
        if (R32(0x3a9e8 + Math.imul(i, 0x18c)) === 1) {                // 18c82..18c90
          a = R32(0x4c394);                                            // 18c92..18ca2: (w - (w >> 31)) >> 1
          a = ((a - (a >> 31)) | 0) >> 1;
          // 18ca4..18cbb: abs(x + width/2 - X[i])
          if ((await F.abs_2377c((((R32(0x4c38c) + a) | 0) - R32(0x3a878 + Math.imul(i, 0x18c))) | 0)) < best) { // 18cc0: jge (signed)
            // 18cc5..18cdc: best = abs(x - X[i]) — note: without the width/2 term used in the comparison above
            best = await F.abs_2377c((R32(0x4c38c) - R32(0x3a878 + Math.imul(i, 0x18c))) | 0);
            W32(0x60bd0, i);                                           // 18cdf..18ce2
          }
        }
      }
      a = R32(0x4c394);                                                // 18ce9..18cf9
      a = ((a - (a >> 31)) | 0) >> 1;
      // 18cfb..18d13: x + width/2 > X[[0x60bd0]] (signed)
      if (((R32(0x4c38c) + a) | 0) > R32((0x3a878 + Math.imul(R32(0x60bd0), 0x18c)) | 0)) {
        W32(0x4c4fc, 0x1b);                                            // 18d15
      } else {
        W32(0x4c4fc, 0x1c);                                            // 18d21
      }
    }
    W32(0x4c38c, (R32(0x4c38c) + R32(0x4c3a0)) | 0);                   // 18d2b..18d30
    // 18d36..18d63: negate counter_2 if (x < 0 && counter_2 < 0) || (x + width > 0x140 && counter_2 > 0)
    if ((R32(0x4c38c) < 0 && R32(0x4c3a0) < 0) ||
        (((R32(0x4c38c) + R32(0x4c394)) | 0) > 0x140 && R32(0x4c3a0) > 0)) {
      W32(0x4c3a0, Math.imul(R32(0x4c3a0), -1));                       // 18d65: imul eax,[0x4c3a0],-1
    }
  }

  if (R32(0x4c4fc) === 0x1c) {                                         // 18d71
    W32(0x4c38c, (R32(0x4c38c) + 3) | 0);                              // 18d7a
    a = R32((0x3a880 + Math.imul(R32(0x60bd0), 0x18c)) | 0);           // 18d81..18d9c: W[j]/2
    a = ((a - (a >> 31)) | 0) >> 1;
    c = (R32((0x3a878 + Math.imul(R32(0x60bd0), 0x18c)) | 0) + a) | 0; // 18d9e..18dae: ecx = X[j] + W[j]/2
    a = R32(0x4c394);                                                  // 18db0..18dc2: width/2 + x
    a = ((((a - (a >> 31)) | 0) >> 1) + R32(0x4c38c)) | 0;
    if (a >= c) {                                                      // 18dc8: jl (signed)
      W32(0x4c4fc, 0x40);                                              // 18dcc
      W32(0x4c3a4, 0x28);                                              // 18dd6
    }
  }

  if (R32(0x4c4fc) === 0x1b) {                                         // 18de0
    W32(0x4c38c, (R32(0x4c38c) - 3) | 0);                              // 18ded
    a = R32((0x3a880 + Math.imul(R32(0x60bd0), 0x18c)) | 0);           // 18df4..18e0f
    a = ((a - (a >> 31)) | 0) >> 1;
    c = (R32((0x3a878 + Math.imul(R32(0x60bd0), 0x18c)) | 0) + a) | 0; // 18e11..18e21
    a = R32(0x4c394);                                                  // 18e23..18e35
    a = ((((a - (a >> 31)) | 0) >> 1) + R32(0x4c38c)) | 0;
    if (a <= c) {                                                      // 18e3b: jg (signed)
      W32(0x4c4fc, 0x40);                                              // 18e3f
      W32(0x4c3a4, (0x37 - R32(0x30bec)) | 0);                         // 18e49..18e55
      await F.dws_DPlay_1eff8(0x61620);                                // 18e5b..18e66 (cdecl)
    }
  }

  if (R32(0x4c4fc) === 0x40) {                                         // 18e69
    W32(0x4c398, 0x43);                                                // 18e72: height = 0x43
    W32(0x4c3a4, (R32(0x4c3a4) - 1) | 0);                              // 18e7c: dec counter_3
    if (R32(0x4c3a4) < 0) {                                            // 18e82: jge (signed)
      W32(0x4c4fc, 0x3f);                                              // 18e8b
      await F.dws_DDiscard_1f770(R16(0x6162a));                        // 18e95..18ea3: zero-extended word soundnum of 0x61620
      W32((0x3a9e8 + Math.imul(R32(0x60bd0), 0x18c)) | 0, 0);          // 18ea6..18eb0: state[j] = 0
      W32((0x3a9e0 + Math.imul(R32(0x60bd0), 0x18c)) | 0, 7);          // 18eba..18ec4: curr_frame[j] = 7
    }
  }

  // 18ece..18ee2: dws_DSoundStatus(zero-extended word [0x6164a] (soundnum of 0x61640), 0x60f18) (cdecl)
  await F.dws_DSoundStatus_1f348(R16(0x6164a), 0x60f18);

  // 18ee5..18f16: skip if y <= -0x3c, state == 0, state == 0x40 or word [0x60f18] != 0
  if (!(R32(0x4c390) <= -0x3c || R32(0x4c4fc) === 0 || R32(0x4c4fc) === 0x40 || R16(0x60f18) !== 0)) {
    await F.dws_DPlay_1eff8(0x61640);                                  // 18f10..18f1b (cdecl)
  }

  stackFree(4);
});
