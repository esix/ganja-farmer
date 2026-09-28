// 0x18f27  void sub_18f27(void)   [Watcom, no args, no return value]  (code 0x18f27..0x1977d RET)
// No register arguments: after `push 0x24; call __CHK` it pushes EBX/ECX/EDX/ESI/EDI/EBP (`sub esp, 0`: no
// locals) and writes every register before reading it (signatures.json regs 0). Return value: none — EAX at RET
// is a leftover (a load / callee result); both call sites (0x1617b, 0x1d630) are followed directly by calls to
// 0x15788 / 0x16446, which take no register args (signatures.json regs 0), so EAX is not read.
//
// Structures (LIBRARY.md "Structures"):
//   dws_DPLAY (stride 0x20, +0xA soundnum): 0x61300, 0x613e0, 0x611a0, 0x613a0, 0x611c0, 0x611e0, 0x61200,
//     0x61220, 0x61400, 0x61420 are passed to dws_DPlay (LIBRARY.md `dws_DPlay(dws_DPLAY *dp)`); the words
//     read at 0x6130a, 0x613ea, 0x6142a, 0x611aa, 0x613aa, 0x611ca, 0x611ea, 0x6120a, 0x6122a are +0xA of
//     structs at 0x61300, 0x613e0, 0x61420, 0x611a0, 0x613a0, 0x611c0, 0x611e0, 0x61200, 0x61220 and are
//     passed as soundnum to dws_DDiscard / dws_DSoundStatus.
//   0x60f14: the WORD *result of dws_DSoundStatus (LIBRARY.md); read back as a word after each call.
//   0x61668: passed as RGB_color* to Write_Color_Reg (LIBRARY.md: bytes +0, +1, +2 = r, g, b).
//   0x33aa4 / 0x33dbc are sprites (x +0, y +4; evidence in 1977e_sub_1977e.js header).
// All other globals by address only; no game meaning is claimed.
import { F, register } from '../runtime/registry.js';
import { R8, W8, R16, R32, W32 } from '../runtime/mem.js';
import { imod } from '../runtime/cpu.js';

register(0x18f27, 'sub_18f27', function sub_18f27() {
  // 0x18f3f..0x18f9b
  if ((R32(0x60b50) === 1 || R32(0x60ba8) !== R32(0x33aa8) || R32(0x60ba4) !== R32(0x33aa4)) && // 18f3f..18f62
      (R32(0x33f2c) === 0x2c || R32(0x33f2c) === 0x2b) && // 18f64..18f74
      R32(0x60bc4) !== 1 && // 18f7a
      R32(0x33f2c) !== 0x3a && // 18f85
      R32(0x33f2c) !== 0x3b) { // 18f90
    W32(0x33f2c, 1); // 18f9b
  }

  // 0x18fa5..0x19018
  if (R32(0x60b50) !== 1 && R32(0x60ba8) === R32(0x33aa8) && R32(0x60ba4) === R32(0x33aa4) &&
      R32(0x33f2c) === 1) {
    W32(0x30be8, (R32(0x30be8) - 1) | 0); // 18fd7 dec
    if (R32(0x30be8) < 0) { // 18fdd cmp 0; jge
      W32(0x33f2c, 0x2b);
      W32(0x33f24, 0xa);
      W32(0x60ee4, 0);
      W32(0x30be8, 0x64);
      W32(0x30bf8, 2);
    }
  }

  // 0x19018..0x19115
  if (R32(0x33f2c) === 0x2c) {
    if (R32(0x30bf8) === 2) {
      W8(0x61668, (R8(0x61668) + 2) & 0xff); // 1902e add byte
      F.Write_Color_Reg_20541(0xb6, 0x61668); // 19035..1903f
      if (R8(0x61668) > 0x3c) { // 19044..1904e movzx; cmp 0x3c; jle
        W32(0x30bf8, 0);
      }
    }
    W32(0x60ee4, (R32(0x60ee4) + 1) | 0); // 1905a inc
    if (R32(0x60ee4) > 4) { // 19060 jle
      if (R32(0x30bf8) === 0) {
        W32(0x33f24, (R32(0x33f24) + 1) | 0); // 19076 inc
        if (R32(0x33f24) > 0x12) { // 1907c jle
          W32(0x30bf8, 1);
          W32(0x33f24, 0x12);
          W8(0x61668, 4);
          W8(0x61669, 2);
          F.Write_Color_Reg_20541(0xb6, 0x61668); // 190a7..190b1
          F.dws_DDiscard_1f770(R16(0x6130a)); // 190b6..190bf (cdecl, zero-extended word)
          F.dws_DPlay_1eff8(0x61300); // 190c7..190cd (cdecl)
          W32(0x60a68, (R32(0x60a68) + 0x3e8) | 0); // 190d5
        }
      }
      if (R32(0x30bf8) === 1) { // 190df
        W32(0x33f24, (R32(0x33f24) - 1) | 0); // 190e8 dec
        if (R32(0x33f24) < 0x10) { // 190ee jge
          W32(0x33f24, 0x10);
          W32(0x30bf8, 2);
        }
      }
      W32(0x60ee4, 0); // 1910b
    }
  }

  // 0x19115..0x1915f
  if (R32(0x33f2c) === 0x2b) {
    F.Write_Color_Reg_20541(0xb6, 0x61668); // 1911e..19128
    W32(0x60ee4, (R32(0x60ee4) + 1) | 0); // 1912d inc
    if (R32(0x60ee4) > 4) { // 19133 jle
      W32(0x33f24, (R32(0x33f24) + 1) | 0); // 1913c inc
      if (R32(0x33f24) > 0xf) { // 19142 jle
        W32(0x33f2c, 0x2c);
      }
      W32(0x60ee4, 0); // 19155
    }
  }

  // 0x1915f..0x191b2
  if (R32(0x33f2c) === 0x3a) {
    W32(0x60ee4, (R32(0x60ee4) + 1) | 0); // 19168 inc
    if (R32(0x60ee4) > 4) { // 1916e jle
      W32(0x33f24, (R32(0x33f24) + 1) | 0); // 19177 inc
      if (R32(0x33f24) > 0x22) { // 1917d jle
        W32(0x33f2c, 0x3b);
        W32(0x30be0, 0x5a);
        F.dws_DPlay_1eff8(0x613e0); // 1919a..191a0 (cdecl)
      }
      W32(0x60ee4, 0); // 191a8
    }
  }

  // 0x191b2..0x1921d
  if (R32(0x33f2c) === 0x3b) {
    W32(0x33f24, 0x22); // 191bb
    W32(0x30be0, (R32(0x30be0) - 1) | 0); // 191c5 dec
    F.dws_DSoundStatus_1f348(R16(0x613ea), 0x60f14); // 191cb..191da (cdecl, push 0x60f14 then word)
    if (R16(0x60f14) === 0 || R32(0x30be0) < 0) { // 191e2 je / 191ec jge
      W32(0x33f2c, 1);
      W32(0x60ef4, 0x3c);
      W32(0x60ef8, 0x3c);
      W32(0x60efc, 1);
    }
  }

  // 0x1921d
  if (R32(0x33f2c) !== 1) {
    return; // jne 0x19777 (epilogue)
  }

  F.dws_DSoundStatus_1f348(R16(0x6142a), 0x60f14); // 1922a..19239 (cdecl)
  if (R16(0x60f14) !== 0 && R32(0x60b50) !== 1) { // 19241 je skip / 1924b jne do
    F.dws_DDiscard_1f770(R16(0x6142a)); // 19256..1925f
    W32(0x60efc, 1); // 19267
  }

  // 0x19271..0x192b3
  if (R32(0x60ee8) === 0x37 || R32(0x60ee8) === 0x36) {
    W32(0x33f24, 0);
  }
  if (R32(0x60ee8) === 0x35) {
    W32(0x33f24, 0x14);
  }
  if (R32(0x60ee8) === 0x38) {
    W32(0x33f24, 0x23);
  }

  // 0x192b3..0x19315: 0xbe < 0x33aa4.x + 6 < 0x140
  if (((R32(0x33aa4) + 6) | 0) > 0xbe && ((R32(0x33aa4) + 6) | 0) < 0x140) {
    if (R32(0x60ee8) === 0x37 || R32(0x60ee8) === 0x36) {
      W32(0x33f24, 2);
    }
    if (R32(0x60ee8) === 0x35) {
      W32(0x33f24, 0x16);
    }
    if (R32(0x60ee8) === 0x38) {
      W32(0x33f24, 0x24);
    }
  }

  // 0x19315..0x19374: 0 < 0x33aa4.x + 6 < 0x82
  if (((R32(0x33aa4) + 6) | 0) > 0 && ((R32(0x33aa4) + 6) | 0) < 0x82) {
    if (R32(0x60ee8) === 0x37 || R32(0x60ee8) === 0x36) {
      W32(0x33f24, 4);
    }
    if (R32(0x60ee8) === 0x35) {
      W32(0x33f24, 0x18);
    }
    if (R32(0x60ee8) === 0x38) {
      W32(0x33f24, 0x25);
    }
  }

  // 0x19374..0x193e1: 0x118 < 0x33aa4.x + 6 < 0x140 and 0x33aa4.y > 0x50
  if (((R32(0x33aa4) + 6) | 0) > 0x118 && ((R32(0x33aa4) + 6) | 0) < 0x140 && R32(0x33aa8) > 0x50) {
    if (R32(0x60ee8) === 0x37 || R32(0x60ee8) === 0x36) {
      W32(0x33f24, 6);
    }
    if (R32(0x60ee8) === 0x35) {
      W32(0x33f24, 0x1a);
    }
    if (R32(0x60ee8) === 0x38) {
      W32(0x33f24, 0x26);
    }
  }

  // 0x193e1..0x19449: 0 < 0x33aa4.x + 6 < 0x28 and 0x33aa4.y > 0x50
  if (((R32(0x33aa4) + 6) | 0) > 0 && ((R32(0x33aa4) + 6) | 0) < 0x28 && R32(0x33aa8) > 0x50) {
    if (R32(0x60ee8) === 0x37 || R32(0x60ee8) === 0x36) {
      W32(0x33f24, 8);
    }
    if (R32(0x60ee8) === 0x35) {
      W32(0x33f24, 0x1c);
    }
    if (R32(0x60ee8) === 0x38) {
      W32(0x33f24, 0x27);
    }
  }

  // 0x19449..0x194ad: 0x33aa4.x + 6 > 0x33dbc.x and 0x33aa4.y + 6 > 0x33dbc.y
  if (((R32(0x33aa4) + 6) | 0) > R32(0x33dbc) && ((R32(0x33aa8) + 6) | 0) > R32(0x33dc0)) {
    if (R32(0x60ee8) === 0x37 || R32(0x60ee8) === 0x36) {
      W32(0x33f24, 6);
    }
    if (R32(0x60ee8) === 0x35) {
      W32(0x33f24, 0x1a);
    }
    if (R32(0x60ee8) === 0x38) {
      W32(0x33f24, 0x26);
    }
  }

  // 0x194ad..0x19511: 0x33aa4.x + 6 < 0x33dbc.x and 0x33aa4.y + 6 > 0x33dbc.y
  if (((R32(0x33aa4) + 6) | 0) < R32(0x33dbc) && ((R32(0x33aa8) + 6) | 0) > R32(0x33dc0)) {
    if (R32(0x60ee8) === 0x37 || R32(0x60ee8) === 0x36) {
      W32(0x33f24, 8);
    }
    if (R32(0x60ee8) === 0x35) {
      W32(0x33f24, 0x1c);
    }
    if (R32(0x60ee8) === 0x38) {
      W32(0x33f24, 0x27);
    }
  }

  // 0x19511..0x19523
  if (R32(0x60b50) !== 1 || R32(0x60edc) !== 1) {
    return; // jmp 0x19777 (epilogue)
  }

  F.dws_DDiscard_1f770(R16(0x611aa)); // 19528..19531
  if (R32(0x46070) === 0) {
    F.dws_DDiscard_1f770(R16(0x613aa)); // 19542..1954b
  }

  if (imod(F.rand_232c7(), 0x1e) === 0xf) { // 19553..19569: cdq-style sar; idiv 30; cmp edx, 15
    W32(0x60ee0, imod(F.rand_232c7(), 4)); // 1956f..19582: idiv 4 -> remainder
    F.dws_DDiscard_1f770(R16(0x611ca)); // 19588..19592
    F.dws_DDiscard_1f770(R16(0x611ea)); // 1959a..195a4
    F.dws_DDiscard_1f770(R16(0x6120a)); // 195ac..195b6
    F.dws_DDiscard_1f770(R16(0x6122a)); // 195be..195c8
    if (R32(0x60ee0) === 0) {
      F.dws_DPlay_1eff8(0x611c0);
    }
    if (R32(0x60ee0) === 1) {
      F.dws_DPlay_1eff8(0x611e0);
    }
    if (R32(0x60ee0) === 2) {
      F.dws_DPlay_1eff8(0x61200);
    }
    if (R32(0x60ee0) === 3) {
      F.dws_DPlay_1eff8(0x61220);
    }
  } else { // 0x1962e
    if (R32(0x60ee8) === 0x37 || R32(0x60ee8) === 0x36) {
      F.dws_DPlay_1eff8(0x611a0); // 19640..19646
    }
    if (R32(0x60ee8) === 0x35 && R32(0x46070) === 0) { // 1964e jne skip / 19657 je do
      F.dws_DPlay_1eff8(0x613a0); // 19662..19668
    }
  }

  // 0x19670..0x196bf
  if (R32(0x60ee8) === 0x37 || R32(0x60ee8) === 0x36) {
    W32(0x33f24, (R32(0x33f24) + 1) | 0); // 19682 inc
    F.sub_11c2a(); // 19688
    if (R32(0x60ee8) === 0x36) {
      W32(0x60edc, 0); // 19696
    }
  }
  if (R32(0x60ee8) === 0x35 && R32(0x46070) === 0) { // 196a0 jne skip / 196a9 je do
    W32(0x33f24, (R32(0x33f24) + 1) | 0); // 196b4 inc
    F.sub_1864d(); // 196ba
  }

  // 0x196bf
  if (R32(0x60ee8) !== 0x38) {
    return; // jne 0x19777 (epilogue)
  }
  if (R32(0x60ef4) === 0x3c) { // 196cc
    W32(0x60ef8, (R32(0x60ef8) - 1) | 0); // 196d9 dec
    if (R32(0x60ef8) > 0) { // 196df jle
      F.sub_1977e(); // 196e8
      if (R32(0x60efc) === 1) {
        F.dws_DPlay_1eff8(0x61400); // 196f6..196fc
        W32(0x60efc, 0); // 19704
      }
      F.dws_DSoundStatus_1f348(R16(0x6142a), 0x60f14); // 1970e..1971d
      if (R16(0x60f14) === 0) { // 19725 jne
        F.dws_DPlay_1eff8(0x61420); // 1972f..19735
      }
    } else { // 0x1973f
      W32(0x60ef4, 0x39);
      F.dws_DDiscard_1f770(R16(0x6142a)); // 19749..19752
    }
  }
  if (R32(0x60ef4) === 0x39) { // 1975a
    W32(0x33f2c, 0x3a);
    W32(0x33f24, 0x1e);
  }
});
