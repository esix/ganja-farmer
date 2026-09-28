// 0x102d1  void sub_102d1(char *file, int delay, int effect)
//          [Watcom: file=EAX (-> [ebp-0x18]), delay=EDX (-> [ebp-0x10]), effect=EBX (-> [ebp-0xc]);
//           no stack args; RET without setting EAX. Two callers (0x1cbbf, 0x1cbd5) pass
//           (0x30476 "xlogo.pcx" / 0x30480 "evilx.pcx", 0x3c, 0) — decompiled.c line 4834/4837.]
// Fill_Screen(0); PCX_Init(0x31ee4); PCX_Load(file, 0x31ee4, 1).
// Clears six dwords (+0x20..+0x37) of the 0x38-byte records at 0x61670 + i*0x38, i = 1..254.
// 20 times: for i = 1..254: Read_Color_Reg(i, record i) (bytes +0,+1,+2), then stores the doubles
//   +8/+0x10/+0x18 = byte +0/+1/+2 divided by [0x30004] (= 20.0 in flat.bin).
// A 3-byte local color c = {0,0,0}; 20 times: for i = 1..254: Write_Color_Reg(i, &c).
// PCX_Show_Buffer(0x31ee4).
// 20 times: for i = 1..254: Read_Color_Reg(i, &c); for each component n (0,1,2):
//   if c[n] > byte[n] - step[n] (x87 compare, ja): c[n] = byte[n]
//   else: acc[n] += step[n]; c[n] = low byte of fistp(__CHP(acc[n]));
//   Write_Color_Reg(i, &c). After each pass: Time_Delay(1).
// Time_Delay(delay); PCX_Delete(0x31ee4); if effect != 0x34: Screen_Transition(effect).
// 0x31ee4 is used as the pcx_picture argument of PCX_Init/PCX_Load/PCX_Show_Buffer/PCX_Delete (LIBRARY.md).
// Record layout at 0x61670 (stride 0x38), from this function only: +0..+2 bytes filled by Read_Color_Reg
// (r, g, b per RGB_color, LIBRARY.md); +8/+0x10/+0x18 doubles = component / 20.0; +0x20/+0x28/+0x30 doubles
// accumulated by those steps.
//
// Floating point: fild of a byte value (0..255, loaded via `fild word` of a zero-extended dword — exact),
// fdiv / fsub / fadd by double memory operands: one rounding each under PC=53 -> plain JS doubles are exact
// (subnormal results would be rounded twice by the x87 — LATENT: bytes 0..255 / 20.0 are never subnormal).
// fcompp + `ja`: taken only if ST0 > ST1 (ordered); an unordered (NaN) result does not jump, as JS `>`.
// Float->int: `call __CHP` (0x222a4: frndint with chop) then `fistp dword` (CW 0x127F: all exceptions
// masked, so an out-of-range/NaN value stores the integer indefinite 0x80000000); only the low byte is kept.
// UNCERTAIN: if a quotient is NaN (0/0), the x87 stores its default NaN 0xFFF8000000000000 while JS stores
// 0x7FF8000000000000. Only possible if [0x30004] were 0/inf/NaN: the binary's only references to 0x30004 are
// the three fdiv reads here (disasm sweep of 0x10000..), so it stays 20.0 and bytes 0..255 give finite values.
import { F, register } from '../runtime/registry.js';
import { R8, W8, W32, RF64, WF64 } from '../runtime/mem.js';
import { stackAlloc, stackFree } from '../runtime/stack.js';

// fistp dword of an integral value already in ST0 (__CHP output): in range -> the value, else 0x80000000.
function fistp32(v) {
  if (v >= -2147483648 && v <= 2147483647) return v | 0;
  return -2147483648; // integer indefinite (also for NaN, where both comparisons are false)
}

register(0x102d1, 'sub_102d1', async function sub_102d1(file, delay, effect) {
  let i; // [ebp-8]
  let k; // [ebp-0x14]
  let r, g, b; // [ebp-0x28], [ebp-0x20], [ebp-0x30] (doubles)
  let t; // [ebp-0x34] / [ebp-0x38]: fild / fistp scratch
  const c = stackAlloc(4); // [ebp-4..ebp-1]: color bytes at [ebp-4], [ebp-3], [ebp-2] (address passed to callees)

  F.Fill_Screen_20768(0); // 102f0..102f2
  F.PCX_Init_207a0(0x31ee4); // 102f7..102fc
  F.PCX_Load_20806(file, 0x31ee4, 1); // 10301..1030e

  // 10313..10373
  for (i = 1; i < 0xff; i++) {
    W32(i * 0x38 + 0x616a0, 0);
    W32(i * 0x38 + 0x616a4, 0);
    W32(i * 0x38 + 0x61698, 0);
    W32(i * 0x38 + 0x6169c, 0);
    W32(i * 0x38 + 0x61690, 0);
    W32(i * 0x38 + 0x61694, 0);
  }

  // 10375..1043a
  for (k = 0; k < 0x14; k++) {
    for (i = 1; i < 0xff; i++) {
      F.Read_Color_Reg_205a8(i, (i * 0x38 + 0x61670) | 0); // 103aa..103b8
      t = R8(i * 0x38 + 0x61670); // 103bd..103c9
      r = t; // 103cc..103cf: fild word; fstp qword [ebp-0x28]
      t = R8(i * 0x38 + 0x61671); // 103d2..103de
      g = t; // 103e1..103e4: [ebp-0x20]
      t = R8(i * 0x38 + 0x61672); // 103e7..103f3
      b = t; // 103f6..103f9: [ebp-0x30]
      WF64(i * 0x38 + 0x61678, r / RF64(0x30004)); // 103fc..10409
      WF64(i * 0x38 + 0x61680, g / RF64(0x30004)); // 1040f..1041c
      WF64(i * 0x38 + 0x61688, b / RF64(0x30004)); // 10422..1042f
    }
  }

  // 1043f..10447
  W8(c, 0);
  W8(c + 1, 0);
  W8(c + 2, 0);

  // 1044b..10485
  for (k = 0; k < 0x14; k++) {
    for (i = 1; i < 0xff; i++) {
      F.Write_Color_Reg_20541(i, c); // 10478..1047e
    }
  }

  F.PCX_Show_Buffer_20b9b(0x31ee4); // 10487..1048c

  // 10491..1064a
  for (k = 0; k < 0x14; k++) {
    for (i = 1; i < 0xff; i++) {
      F.Read_Color_Reg_205a8(i, c); // 104c6..104cc

      // 104d1..104fd: ST1 = byte[+0] - [+8]; ST0 = c[0]; fcompp; ja
      t = R8(i * 0x38 + 0x61670);
      const d0 = t - RF64(i * 0x38 + 0x61678);
      t = R8(c);
      if (!(t > d0)) {
        // 104ff..10537
        WF64(i * 0x38 + 0x61690, RF64(i * 0x38 + 0x61678) + RF64(i * 0x38 + 0x61690));
        t = fistp32(F.__CHP_222a4(RF64(i * 0x38 + 0x61690)));
        W8(c, t & 0xff); // 1052b..10534: low byte
      } else {
        W8(c, R8(i * 0x38 + 0x61670)); // 10539..10543
      }

      // 10546..10572: ST1 = byte[+1] - [+0x10]; ST0 = c[1]
      t = R8(i * 0x38 + 0x61671);
      const d1 = t - RF64(i * 0x38 + 0x61680);
      t = R8(c + 1);
      if (!(t > d1)) {
        // 10574..105ac
        WF64(i * 0x38 + 0x61698, RF64(i * 0x38 + 0x61680) + RF64(i * 0x38 + 0x61698));
        t = fistp32(F.__CHP_222a4(RF64(i * 0x38 + 0x61698)));
        W8(c + 1, t & 0xff);
      } else {
        W8(c + 1, R8(i * 0x38 + 0x61671)); // 105ae..105b8
      }

      // 105bb..105e7: ST1 = byte[+2] - [+0x18]; ST0 = c[2]
      t = R8(i * 0x38 + 0x61672);
      const d2 = t - RF64(i * 0x38 + 0x61688);
      t = R8(c + 2);
      if (!(t > d2)) {
        // 105e9..10621
        WF64(i * 0x38 + 0x616a0, RF64(i * 0x38 + 0x61688) + RF64(i * 0x38 + 0x616a0));
        t = fistp32(F.__CHP_222a4(RF64(i * 0x38 + 0x616a0)));
        W8(c + 2, t & 0xff);
      } else {
        W8(c + 2, R8(i * 0x38 + 0x61672)); // 10623..1062d
      }

      F.Write_Color_Reg_20541(i, c); // 10630..10636
    }
    await F.Time_Delay_20404(1); // 10640..10645
  }

  await F.Time_Delay_20404(delay); // 1064f..10652
  F.PCX_Delete_20b69(0x31ee4); // 10657..1065c
  if (effect !== 0x34) {
    await F.Screen_Transition_21673(effect); // 10661..1066a
  }
  stackFree(4);
});
