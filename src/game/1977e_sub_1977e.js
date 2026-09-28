// 0x1977e  void sub_1977e(void)   [Watcom, no args, no return value]  (code 0x1977e..0x19add RET)
// No register arguments: after `push 0x38; call __CHK` the function pushes EBX/ECX/EDX/ESI/EDI/EBP and
// writes every register before reading it. Return value: none — EAX at RET is the leftover of
// `mov eax,[ebp-4]` (0x19aba); the only call site (decompiled.c:3826, inside FUN at the 0x60ee8 == 0x38 /
// 0x60ef4 == 0x3c branch) does not use it; signatures.json returns=false.
//
// Structures (sprite struct, stride 0x18c, LIBRARY.md "Structures"):
//   0x33aa4 and 0x33dbc are sprites (decompiled.c:426 Behind_Sprite_Clip(&DAT_00033aa4,..),
//   decompiled.c:2493 Erase_Sprite_Clip(&DAT_00033dbc,..)): 0x33aa4 x, 0x33aa8 y; 0x33dbc x, 0x33dc0 y.
//   0x4c518 + i*0x18c is a sprite array (decompiled.c:2828 Erase_Sprite_Clip(&DAT_0004c518 + i*0x18c,..)):
//   0x4c518 x, 0x4c51c y, 0x4c528 counter_1 (+0x10), 0x4c52c counter_2 (+0x14), 0x4c688 state (+0x170).
//   (Only the struct offsets are cited; what the fields mean to the game is not claimed.)
//
// Summary: scans entries i = 0..198 of the 0x4c518 array; for up to 3 entries whose state == 0 it sets
// counter_1/counter_2 (default 0 / -7, then overridden by up to four position tests between the two
// sprites 0x33aa4 and 0x33dbc, two of which use atan/cos/sin), x = 0x33dbc.x + 12, y = 0x33dbc.y + 7,
// state = 1.
//
// Floating point: atan_st0 / cos_st0 / sin_st0 return Ext (lib/crt.js); [0x61660] gets `fstp qword`
// (x87.toDouble). The Ext cos/sin results are multiplied by a double constant with `fmul qword`
// (x87.fmul -> double). The following faddp/fsubrp operate on doubles (PC=53, plain JS is exact).
// Constants (flat.bin): [0x30184] = 7.0, [0x3018c] = -7.0, [0x30194] = -7.0.
// Float->int: `call __CHP` (0x222a4, truncation) then `fistp dword`; the __CHP result is integral and
// |value| <= 8 (rand()%2 in {0,1}, |cos/sin * 7| <= 7), so the fistp is exact and `| 0` reproduces it.
// All `% 2` are `cdq`-style `sar edx,31; idiv ecx` remainders (imod).
// Difftest caveat (audit round1 F-risky F2): unicorn's FPATAN/FSIN/FCOS are 53-bit and wrong on realistic
// inputs (last bit of 0x61660/0x5ff40/0x5ff48, and integer results at 4:3 ratios), so on the trig paths a
// difftest PASS/FAIL says nothing about the last bits. The port there is confirmed by two independent 64-bit
// x87 models agreeing bit for bit (re/audit/round1/F-risky/x87/cmp2.mjs: 20000 random states per function,
// 0 differ; prim.mjs: 100000 primitive inputs, 0 differ), not by the difftest. Correctly rounded vs a real
// FPU's faithful trig changes no integer output here (PORTING.md "Floating point", x87.js note above GUARD).
import { F, register } from '../runtime/registry.js';
import { R32, W32, RF64, WF64 } from '../runtime/mem.js';
import { imod } from '../runtime/cpu.js';
import * as x87 from '../runtime/x87.js';

register(0x1977e, 'sub_1977e', async function sub_1977e() {
  let n; // [ebp-8]: entries set up so far (loop runs while < 3)
  let i; // [ebp-4]: index into the 0x4c518 array
  let r; // [ebp-0x1c] as rand()%2 (fild operand)
  let y; // [ebp-0x18] (double)
  let x; // [ebp-0x10] (double)

  n = 0;                                                                        // 19796
  i = 0;                                                                        // 1979d
  while (n < 3) {                                                               // 197a4..197a8
    if (R32(0x4c688 + i * 0x18c) === 0) {                                       // 197ae..197bc
      W32(0x4c528 + i * 0x18c, 0);                                              // 197c2..197c9
      W32(0x4c52c + i * 0x18c, -7);                                             // 197d3..197da

      // 197e4..19808: if (0x33aa4.x - 0x14 - 0x33dbc.x + 0xd) > 0 && (0x33dc0 - 0x33aa8) > 0
      if (((((R32(0x33aa4) - 0x14) | 0) - R32(0x33dbc) + 0xd) | 0) > 0 &&
          ((R32(0x33dc0) - R32(0x33aa8)) | 0) > 0) {
        y = (R32(0x33dc0) - R32(0x33aa8)) | 0;                                  // 1980d..1981e fild; fstp qword
        x = (((R32(0x33aa4) - 0x14) | 0) - R32(0x33dbc) + 0xd) | 0;            // 19821..19838 fild; fstp qword
        WF64(0x61660, x87.toDouble(await F.atan_st0_23686(y / x)));            // 1983b..19846 fld; fdiv; atan; fstp
        r = imod(await F.rand_232c7(), 2);                                      // 1984c..1985f
        W32(0x4c528 + i * 0x18c,                                                // 19862..1988a
          (await F.__CHP_222a4(r + x87.fmul(await F.cos_st0_236cc(RF64(0x61660)), RF64(0x30184)))) | 0); // faddp st(1): st1 + st0
        r = imod(await F.rand_232c7(), 2);                                      // 19890..198a3
        W32(0x4c52c + i * 0x18c,                                                // 198a6..198ce
          (await F.__CHP_222a4(x87.fmul(await F.sin_st0_236d6(RF64(0x61660)), RF64(0x3018c)) - r)) | 0); // fsubrp st(1): st0 - st1
      }

      // 198d4..198f8: if (0x33dbc.x + 0xd - 0x33aa4.x - 0x14) > 0 && (0x33dc0 - 0x33aa8) > 0
      if (((((R32(0x33dbc) + 0xd) | 0) - R32(0x33aa4) - 0x14) | 0) > 0 &&
          ((R32(0x33dc0) - R32(0x33aa8)) | 0) > 0) {
        y = (((R32(0x33dc0) - R32(0x33aa8)) | 0) - 0x14) | 0;                  // 198fd..19911
        x = (((R32(0x33dbc) + 0xd) | 0) - R32(0x33aa4) - 0x14) | 0;            // 19914..1992b
        WF64(0x61660, x87.toDouble(await F.atan_st0_23686(y / x)));            // 1992e..19939
        r = imod(await F.rand_232c7(), 2);                                      // 1993f..19952
        W32(0x4c528 + i * 0x18c,                                                // 19955..1997d
          (await F.__CHP_222a4(x87.fmul(await F.cos_st0_236cc(RF64(0x61660)), RF64(0x30194)) - r)) | 0); // fsubrp st(1): st0 - st1
        r = imod(await F.rand_232c7(), 2);                                      // 19983..19996
        W32(0x4c52c + i * 0x18c,                                                // 19999..199c1
          (await F.__CHP_222a4(x87.fmul(await F.sin_st0_236d6(RF64(0x61660)), RF64(0x30194)) - r)) | 0); // fsubrp st(1): st0 - st1
      }

      // 199c7..199e7: if 0x33aa4.x + 6 > 0x33dbc.x && 0x33aa8 + 6 > 0x33dc0
      if (((R32(0x33aa4) + 6) | 0) > R32(0x33dbc) &&
          ((R32(0x33aa8) + 6) | 0) > R32(0x33dc0)) {
        W32(0x4c528 + i * 0x18c, (imod(await F.rand_232c7(), 2) + 7) | 0);    // 199e9..19a06
        W32(0x4c52c + i * 0x18c, 0);                                            // 19a0c..19a13
      }

      // 19a1d..19a3d: if 0x33aa4.x + 6 < 0x33dbc.x && 0x33aa8 + 6 > 0x33dc0
      if (((R32(0x33aa4) + 6) | 0) < R32(0x33dbc) &&
          ((R32(0x33aa8) + 6) | 0) > R32(0x33dc0)) {
        W32(0x4c528 + i * 0x18c, (-7 - imod(await F.rand_232c7(), 2)) | 0);   // 19a3f..19a60
        W32(0x4c52c + i * 0x18c, 0);                                            // 19a66..19a6d
      }

      W32(0x4c518 + i * 0x18c, (R32(0x33dbc) + 0xc) | 0);                       // 19a77..19a87
      W32(0x4c51c + i * 0x18c, (R32(0x33dc0) + 7) | 0);                         // 19a8d..19a9d
      W32(0x4c688 + i * 0x18c, 1);                                              // 19aa3..19aaa
      n++;                                                                      // 19ab4..19ab7
    }
    i++;                                                                        // 19aba..19abd
    if (!(i < 0xc7)) n = 3;                                                     // 19ac0..19ac9
  }
});
