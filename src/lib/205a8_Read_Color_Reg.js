// 0x205a8  RGB_color *Read_Color_Reg(int index, RGB_color *color)
//          [Watcom: index=EAX, color=EDX; returns EAX = color]
// Reads one VGA DAC entry: outp(0x3c7, index), then three inp(0x3c9) whose low bytes are stored
// to color[0], color[1], color[2] (r, g, b per RGB_color, LIBRARY.md). Returns the color pointer.
// The port I/O goes through the Watcom CRT outp (0x23d99) / inp (0x23da3) calls, as in the original.
// Stage 2: reads the DAC directly (was OUT 3C7h,index; IN 3C9h x3 through the CRT's outp/inp).
import { register } from '../runtime/registry.js';
import { W8 } from '../runtime/mem.js';
import { readDac } from '../platform/vga.js';

register(0x205a8, 'Read_Color_Reg_205a8', function Read_Color_Reg(index, color) {
  const [r, g, b] = readDac(index);
  W8(color, r); W8(color + 1, g); W8(color + 2, b);
  return color;
});
