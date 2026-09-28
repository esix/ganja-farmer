// 0x14fba  void cycleRastaColors(void)   [Watcom, no args, no return value]
// Rotates DAC entries 0xf9..0xfc through the four colors at 0x30c00/0x30c08/0x30c10/0x30c18 (passed as the
// RGB_color* of Write_Color_Reg, LIBRARY.md): phase = [0x60ba0] selects the starting color via a 4-entry jump
// table at 0x150fc (0x14fdf, 0x15026, 0x1506d, 0x150b1); phases 0..2 increment [0x60ba0], phase 3 resets it to 0.
// Any other value (unsigned > 3, `ja 0x150f9`) does nothing.
// Return: EAX is a leftover (Write_Color_Reg result / local copy); the function is void in all callers
// (Write_Color_Reg header documents the epilogue here), so nothing is returned.
// No x87 instructions in this function.
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';
import { CYCLECOLORS_FIELD, colorCyclePhase, cycleColors } from './data.js';

register(0x14fba, 'cycleRastaColors_14fba', function cycleRastaColors() {
  let phase; // [ebp-4]

  phase = R32(colorCyclePhase);                                   // 14fd2/14fd7
  // 1510c..15118: cmp [ebp-4],3; ja default; jmp [phase*4 + 0x150fc]
  switch (phase >>> 0) {
    case 0:                                               // 14fdf
      F.Write_Color_Reg_20541(0xf9, cycleColors);
      F.Write_Color_Reg_20541(0xfa, (cycleColors + 1 * CYCLECOLORS_FIELD.SIZE));
      F.Write_Color_Reg_20541(0xfb, (cycleColors + 2 * CYCLECOLORS_FIELD.SIZE));
      F.Write_Color_Reg_20541(0xfc, (cycleColors + 3 * CYCLECOLORS_FIELD.SIZE));
      W32(colorCyclePhase, (R32(colorCyclePhase) + 1) | 0);               // 1501b: inc dword [0x60ba0]
      break;
    case 1:                                               // 15026
      F.Write_Color_Reg_20541(0xf9, (cycleColors + 1 * CYCLECOLORS_FIELD.SIZE));
      F.Write_Color_Reg_20541(0xfa, (cycleColors + 2 * CYCLECOLORS_FIELD.SIZE));
      F.Write_Color_Reg_20541(0xfb, (cycleColors + 3 * CYCLECOLORS_FIELD.SIZE));
      F.Write_Color_Reg_20541(0xfc, cycleColors);
      W32(colorCyclePhase, (R32(colorCyclePhase) + 1) | 0);               // 15062
      break;
    case 2:                                               // 1506d
      F.Write_Color_Reg_20541(0xf9, (cycleColors + 2 * CYCLECOLORS_FIELD.SIZE));
      F.Write_Color_Reg_20541(0xfa, (cycleColors + 3 * CYCLECOLORS_FIELD.SIZE));
      F.Write_Color_Reg_20541(0xfb, cycleColors);
      F.Write_Color_Reg_20541(0xfc, (cycleColors + 1 * CYCLECOLORS_FIELD.SIZE));
      W32(colorCyclePhase, (R32(colorCyclePhase) + 1) | 0);               // 150a9
      break;
    case 3:                                               // 150b1
      F.Write_Color_Reg_20541(0xf9, (cycleColors + 3 * CYCLECOLORS_FIELD.SIZE));
      F.Write_Color_Reg_20541(0xfa, cycleColors);
      F.Write_Color_Reg_20541(0xfb, (cycleColors + 1 * CYCLECOLORS_FIELD.SIZE));
      F.Write_Color_Reg_20541(0xfc, (cycleColors + 2 * CYCLECOLORS_FIELD.SIZE));
      W32(colorCyclePhase, 0);                                    // 150ed
      break;
    default:                                              // 150f9: jmp epilogue
      break;
  }
});
