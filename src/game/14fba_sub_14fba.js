// 0x14fba  void sub_14fba(void)   [Watcom, no args, no return value]
// Rotates DAC entries 0xf9..0xfc through the four colors at 0x30c00/0x30c08/0x30c10/0x30c18 (passed as the
// RGB_color* of Write_Color_Reg, LIBRARY.md): phase = [0x60ba0] selects the starting color via a 4-entry jump
// table at 0x150fc (0x14fdf, 0x15026, 0x1506d, 0x150b1); phases 0..2 increment [0x60ba0], phase 3 resets it to 0.
// Any other value (unsigned > 3, `ja 0x150f9`) does nothing.
// Return: EAX is a leftover (Write_Color_Reg result / local copy); the function is void in all callers
// (Write_Color_Reg header documents the epilogue here), so nothing is returned.
// No x87 instructions in this function.
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';

register(0x14fba, 'sub_14fba', function sub_14fba() {
  let phase; // [ebp-4]

  phase = R32(0x60ba0);                                   // 14fd2/14fd7
  // 1510c..15118: cmp [ebp-4],3; ja default; jmp [phase*4 + 0x150fc]
  switch (phase >>> 0) {
    case 0:                                               // 14fdf
      F.Write_Color_Reg_20541(0xf9, 0x30c00);
      F.Write_Color_Reg_20541(0xfa, 0x30c08);
      F.Write_Color_Reg_20541(0xfb, 0x30c10);
      F.Write_Color_Reg_20541(0xfc, 0x30c18);
      W32(0x60ba0, (R32(0x60ba0) + 1) | 0);               // 1501b: inc dword [0x60ba0]
      break;
    case 1:                                               // 15026
      F.Write_Color_Reg_20541(0xf9, 0x30c08);
      F.Write_Color_Reg_20541(0xfa, 0x30c10);
      F.Write_Color_Reg_20541(0xfb, 0x30c18);
      F.Write_Color_Reg_20541(0xfc, 0x30c00);
      W32(0x60ba0, (R32(0x60ba0) + 1) | 0);               // 15062
      break;
    case 2:                                               // 1506d
      F.Write_Color_Reg_20541(0xf9, 0x30c10);
      F.Write_Color_Reg_20541(0xfa, 0x30c18);
      F.Write_Color_Reg_20541(0xfb, 0x30c00);
      F.Write_Color_Reg_20541(0xfc, 0x30c08);
      W32(0x60ba0, (R32(0x60ba0) + 1) | 0);               // 150a9
      break;
    case 3:                                               // 150b1
      F.Write_Color_Reg_20541(0xf9, 0x30c18);
      F.Write_Color_Reg_20541(0xfa, 0x30c00);
      F.Write_Color_Reg_20541(0xfb, 0x30c08);
      F.Write_Color_Reg_20541(0xfc, 0x30c10);
      W32(0x60ba0, 0);                                    // 150ed
      break;
    default:                                              // 150f9: jmp epilogue
      break;
  }
});
