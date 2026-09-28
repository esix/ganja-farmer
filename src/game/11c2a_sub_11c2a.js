// 0x11c2a  void sub_11c2a(void)   [Watcom, no args, no return value]  (code 0x11c2a..0x1212f RET)
// No register arguments: after `push 0x54; call __CHK` it pushes EBX/ECX/EDX/ESI/EDI/EBP and writes every
// register before reading it (signatures.json regs 0). Return value: none — EAX at RET is a leftover (the last
// `imul`/`mov` of the loop tail); the only call site 0x19688 is followed by `cmp dword [0x60ee8], 0x36`
// (EAX not read); signatures.json returns=false.
//
// Table at 0x5ff20, stride 0x30, entries 0..0x3a (loop ends when the index reaches 0x3b). Per entry e = i*0x30:
//   0x5ff20+e, 0x5ff24+e, 0x5ff28+e: passed as x, y, color to Write_Pixel_DB (0x11ca5; LIBRARY.md / lib port
//     22219); 0x5ff28+e is assigned from Read_Pixel_DB(0x5ff20+e, 0x5ff24+e) (0x120e5).
//   0x5ff2c+e: an entry is picked only if this is 0, and is set to 1 when picked (0x120f8).
//   0x5ff30+e, 0x5ff34+e: int32; 0x5ff40+e, 0x5ff48+e: double. (Meanings not claimed.)
// Sprites (sprite struct, LIBRARY.md "Structures"; evidence in 1977e_sub_1977e.js header: decompiled.c:426
// Behind_Sprite_Clip(&DAT_00033aa4,..), decompiled.c:2493 Erase_Sprite_Clip(&DAT_00033dbc,..)):
//   0x33aa4 x, 0x33aa8 y; 0x33dbc x, 0x33dc0 y. Other globals (0x33f24, 0x60a68, 0x61660) by address only.
//
// Summary: finds the first entry i (0..0x3a) with [0x5ff2c+e] == 0 (entries with flag != 0 are skipped via
// jne 0x12109 without other accesses). For that entry: Write_Pixel_DB(x, y, color) unless x == 1 or y == 1;
// up to two atan/cos/sin computations and two constant overrides of the doubles at +0x40/+0x48
// (depending on the relative sprite positions), then +0x30/+0x34 from the
// doubles, x/y set from 0x33dbc/0x33dc0 by [0x33f24] in {1,3,5,7,9}, color = Read_Pixel_DB(x, y) if
// 0 <= y <= 0xc8 and 0 <= x <= 0x140, flag = 1, loop ends. Afterwards (always) [0x60a68]--.
//
// Floating point: atan_st0 / cos_st0 / sin_st0 return Ext (lib/crt.js). atan result: `fstp qword [0x61660]`
// (x87.toDouble). The sin result is stored `fstp qword [ebp-0x38]` (x87.toDouble) before use; the cos
// result stays in ST0 and is multiplied `fmul qword` by a double constant (x87.fmul -> double).
// Constants (flat.bin): [0x3014c] = 5.0, [0x30154] = -5.0, [0x3015c] = 0.1, [0x30164] = -5.0, [0x3016c] = 0.1.
// fild of int32 values is exact; fdiv/fsub/fmul of doubles round once to double like JS (PC=53, PORTING.md;
// except subnormal results, which the x87 rounds twice — LATENT, values here are >= ~0.1 or 0).
// Float->int: `call __CHP` (0x222a4, truncation -> integral value) then `fistp dword` (fistp32 below: an
// integral value in int32 range is stored exactly; anything else — out of range, NaN, or an Ext too wide for a
// double — stores the integer indefinite 0x80000000, since CW 0x127F masks the invalid-operation exception).
// With the constants above the operands are bounded (|v| <= 5, |v/0.1 - 10*trunc(v)| < 60), so only the exact
// case occurs in the game; a -0 from __CHP stores 0.
// Difftest caveat (audit round1 F-risky F2): unicorn's FPATAN/FSIN/FCOS are 53-bit and wrong on realistic
// inputs (last bit of 0x61660/0x5ff40/0x5ff48, and integer results at 4:3 ratios), so on the trig paths a
// difftest PASS/FAIL says nothing about the last bits. The port there is confirmed by two independent 64-bit
// x87 models agreeing bit for bit (re/audit/round1/F-risky/x87/cmp2.mjs: 20000 random states per function,
// 0 differ; prim.mjs: 100000 primitive inputs, 0 differ), not by the difftest. Correctly rounded vs a real
// FPU's faithful trig changes no integer output here (PORTING.md "Floating point", x87.js note above GUARD).
import { F, register } from '../runtime/registry.js';
import { R32, W32, RF64, WF64 } from '../runtime/mem.js';
import * as x87 from '../runtime/x87.js';
import { BULLETS_FIELD, SPRITE, aimAngle, bullets, gunSight, rasta, score } from './data.js';
// fistp dword of an integral ST0 (see header). NaN, out-of-range, and an Ext argument (x87.chp returns Ext only when
// |v| needs > 53 bits, i.e. far outside int32; the object compares as NaN here) all give 0x80000000 (masked invalid).
const fistp32 = (v) => (v >= -2147483648 && v <= 2147483647 ? v | 0 : -2147483648);

register(0x11c2a, 'sub_11c2a', function sub_11c2a() {
  let done; // [ebp-0x14]
  let i; // [ebp-0xc]
  let t; // [ebp-0x10]: __CHP result stored by fistp
  let y; // [ebp-0x1c] (double)
  let x; // [ebp-0x2c] (double)
  let c; // cos result (Ext), left in ST1 across the sin call
  let s; // [ebp-0x38] (double): sin result
  let e; // i * 0x30 (imul eax, [ebp-0xc], 0x30 — recomputed from the local [ebp-0xc] at every use)

  done = 0;                                                                   // 11c42
  i = 0;                                                                      // 11c49
  while (done === 0) {                                                        // 11c50: cmp [ebp-0x14],0; jne 12121
    e = Math.imul(i, 0x30);
    if (R32((bullets + BULLETS_FIELD.active) + e) === 0) {                                             // 11c5e: cmp ..,0; jne 12109
      // 11c6f..11c83: skip the call if x == 1 or y == 1
      if (!(R32(bullets + e) === 1 || R32((bullets + BULLETS_FIELD.y) + e) === 1)) {
        F.Write_Pixel_DB_22219(R32(bullets + e), R32((bullets + BULLETS_FIELD.y) + e), R32((bullets + BULLETS_FIELD.savedPixel) + e)); // 11c87..11ca5 (eax, edx, ebx)
      }

      // 11caa..11ccc: if ([0x33aa4] - 0x14 - [0x33dbc] + 0xd) > 0 && ([0x33dc0] - [0x33aa8]) > 0
      if (((((R32(gunSight) - 0x14) | 0) - R32(rasta) + 0xd) | 0) > 0 &&
          ((R32((rasta + SPRITE.y)) - R32((gunSight + SPRITE.y))) | 0) > 0) {
        y = (R32((rasta + SPRITE.y)) - R32((gunSight + SPRITE.y))) | 0;                                // 11cd3..11ce4 fild; fstp qword
        x = ((((R32(gunSight) - 0x14) | 0) - R32(rasta) + 0xd) | 0);          // 11ce7..11cfe fild; fstp qword
        WF64(aimAngle, x87.toDouble(F.atan_st0_23686(y / x)));            // 11d01..11d0c fld; fdiv; atan; fstp
        c = F.cos_st0_236cc(RF64(aimAngle));                              // 11d12..11d18
        s = x87.toDouble(F.sin_st0_236d6(RF64(aimAngle)));                // 11d1d..11d28 (fstp qword [ebp-0x38])
        WF64((bullets + BULLETS_FIELD.vx) + e, x87.fmul(c, RF64(0x3014c)));                         // 11d2b..11d35 fmul; fstp
        WF64((bullets + BULLETS_FIELD.vy) + e, s * RF64(0x30154));                                  // 11d3b..11d48 fld; fmul; fstp
        t = fistp32(F.__CHP_222a4(RF64((bullets + BULLETS_FIELD.vx) + e)));                      // 11d4e..11d5d fld; __CHP; fistp
        // 11d64..11d8b: fld [+0x48]; fdiv [0x3015c]; fild t*10; fsubp st(1) (st1 - st0); __CHP; fistp
        W32((bullets + BULLETS_FIELD.xStepTenths) + e, fistp32(F.__CHP_222a4(RF64((bullets + BULLETS_FIELD.vx) + e) / RF64(0x3015c) - Math.imul(t, 0xa))));
        t = fistp32(F.__CHP_222a4(RF64((bullets + BULLETS_FIELD.vy) + e)));                      // 11d91..11da0
        // 11da7..11dd0: fld [+0x40]; fdiv [0x3015c]; fild t*10; fsubp st(1); fchs; __CHP; fistp
        W32((bullets + BULLETS_FIELD.yStepTenths) + e, fistp32(F.__CHP_222a4(-(RF64((bullets + BULLETS_FIELD.vy) + e) / RF64(0x3015c) - Math.imul(t, 0xa)))));
      }

      // 11dd6..11df8: if ([0x33dbc] + 0xd - [0x33aa4] - 0x14) > 0 && ([0x33dc0] - [0x33aa8]) > 0
      if (((((R32(rasta) + 0xd) | 0) - R32(gunSight) - 0x14) | 0) > 0 &&
          ((R32((rasta + SPRITE.y)) - R32((gunSight + SPRITE.y))) | 0) > 0) {
        y = (((R32((rasta + SPRITE.y)) - R32((gunSight + SPRITE.y))) | 0) - 0x14) | 0;                 // 11dff..11e13
        x = ((((R32(rasta) + 0xd) | 0) - R32(gunSight) - 0x14) | 0);          // 11e16..11e2d
        WF64(aimAngle, x87.toDouble(F.atan_st0_23686(y / x)));            // 11e30..11e3b
        c = F.cos_st0_236cc(RF64(aimAngle));                              // 11e41..11e47
        s = x87.toDouble(F.sin_st0_236d6(RF64(aimAngle)));                // 11e4c..11e57
        WF64((bullets + BULLETS_FIELD.vx) + e, x87.fmul(c, RF64(0x30164)));                         // 11e5a..11e64
        WF64((bullets + BULLETS_FIELD.vy) + e, s * RF64(0x30164));                                  // 11e6a..11e77
        t = fistp32(F.__CHP_222a4(RF64((bullets + BULLETS_FIELD.vx) + e)));                      // 11e7d..11e8c
        W32((bullets + BULLETS_FIELD.xStepTenths) + e, fistp32(F.__CHP_222a4(RF64((bullets + BULLETS_FIELD.vx) + e) / RF64(0x3016c) - Math.imul(t, 0xa)))); // 11e93..11eba
        t = fistp32(F.__CHP_222a4(RF64((bullets + BULLETS_FIELD.vy) + e)));                      // 11ec0..11ecf
        W32((bullets + BULLETS_FIELD.yStepTenths) + e, fistp32(F.__CHP_222a4(-(RF64((bullets + BULLETS_FIELD.vy) + e) / RF64(0x3016c) - Math.imul(t, 0xa))))); // 11ed6..11eff (fchs)
      }

      // 11f05..11f23: if [0x33aa4] + 6 > [0x33dbc] && [0x33aa8] + 6 > [0x33dc0]
      if (((R32(gunSight) + 6) | 0) > R32(rasta) &&
          ((R32((gunSight + SPRITE.y)) + 6) | 0) > R32((rasta + SPRITE.y))) {
        W32((bullets + BULLETS_FIELD.vx) + e, 0);                                                  // 11f2b: +0x48 = 5.0 (lo dword)
        W32((bullets + 0x2c) + e, 0x40140000);                                         // 11f35: (hi dword)
        W32((bullets + BULLETS_FIELD.vy) + e, 0);                                                  // 11f43: +0x40 = 0.0
        W32((bullets + 0x24) + e, 0);                                                  // 11f4d
      }

      // 11f57..11f75: if [0x33aa4] + 6 < [0x33dbc] && [0x33aa8] + 6 > [0x33dc0]
      if (((R32(gunSight) + 6) | 0) < R32(rasta) &&
          ((R32((gunSight + SPRITE.y)) + 6) | 0) > R32((rasta + SPRITE.y))) {
        W32((bullets + BULLETS_FIELD.vx) + e, 0);                                                  // 11f7d: +0x48 = -5.0 (lo dword)
        W32((bullets + 0x2c) + e, 0xc0140000 | 0);                                     // 11f87: (hi dword)
        W32((bullets + BULLETS_FIELD.vy) + e, 0);                                                  // 11f95: +0x40 = 0.0
        W32((bullets + 0x24) + e, 0);                                                  // 11f9f
      }

      if (R32((rasta + SPRITE.currFrame)) === 1) {                                               // 11fa9
        W32(bullets + e, (R32(rasta) + 0xe) | 0);                           // 11fb2..11fbf
        W32((bullets + BULLETS_FIELD.y) + e, (R32((rasta + SPRITE.y)) + 3) | 0);                             // 11fc5..11fd2
      }
      if (R32((rasta + SPRITE.currFrame)) === 3) {                                               // 11fd8
        W32(bullets + e, (R32(rasta) + 0x14) | 0);                          // 11fe1..11fee
        W32((bullets + BULLETS_FIELD.y) + e, (R32((rasta + SPRITE.y)) + 4) | 0);                             // 11ff4..12001
      }
      if (R32((rasta + SPRITE.currFrame)) === 5) {                                               // 12007
        W32(bullets + e, (R32(rasta) + 8) | 0);                             // 12010..1201d
        W32((bullets + BULLETS_FIELD.y) + e, (R32((rasta + SPRITE.y)) + 4) | 0);                             // 12023..12030
      }
      if (R32((rasta + SPRITE.currFrame)) === 7) {                                               // 12036
        W32(bullets + e, (R32(rasta) + 0x1c) | 0);                          // 1203f..1204c
        W32((bullets + BULLETS_FIELD.y) + e, (R32((rasta + SPRITE.y)) + 9) | 0);                             // 12052..1205f
      }
      if (R32((rasta + SPRITE.currFrame)) === 9) {                                               // 12065
        W32(bullets + e, R32(rasta));                                       // 1206e..12078
        W32((bullets + BULLETS_FIELD.y) + e, (R32((rasta + SPRITE.y)) + 9) | 0);                             // 1207e..1208b
      }

      // 12091..120cd: only if 0 <= y <= 0xc8 and 0 <= x <= 0x140 (signed)
      if (!(R32((bullets + BULLETS_FIELD.y) + e) < 0) && R32((bullets + BULLETS_FIELD.y) + e) <= 0xc8 &&
          R32(bullets + e) >= 0 && R32(bullets + e) <= 0x140) {
        W32((bullets + BULLETS_FIELD.savedPixel) + e, F.Read_Pixel_DB_2225c(R32(bullets + e), R32((bullets + BULLETS_FIELD.y) + e))); // 120d1..120ee (eax, edx)
      }
      W32((bullets + BULLETS_FIELD.active) + e, 1);                                                    // 120f8
      done = 1;                                                               // 12102
    }
    i++;                                                                      // 12109..1210c
    if (!(i < 0x3b)) done = 1;                                                // 1210f..12115
  }
  W32(score, (R32(score) - 1) | 0);                                       // 12121: dec dword [0x60a68]
});
