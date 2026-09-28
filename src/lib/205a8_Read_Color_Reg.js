// 0x205a8  RGB_color *Read_Color_Reg(int index, RGB_color *color)
//          [Watcom: index=EAX, color=EDX; returns EAX = color]
// Reads one VGA DAC entry: outp(0x3c7, index), then three inp(0x3c9) whose low bytes are stored
// to color[0], color[1], color[2] (r, g, b per RGB_color, LIBRARY.md). Returns the color pointer.
// The port I/O goes through the Watcom CRT outp (0x23d99) / inp (0x23da3) calls, as in the original.
import { F, register } from '../runtime/registry.js';
import { W8 } from '../runtime/mem.js';

register(0x205a8, 'Read_Color_Reg_205a8', function Read_Color_Reg(index, color) {
  // 205bf/205c2: [ebp-0xc] = index, [ebp-8] = color
  // 205c5-205cd: outp(0x3c7, index)   (EAX=0x3c7, EDX=index)
  F.outp_23d99(0x3c7, index);
  // 205d2-205e1: dl = inp(0x3c9); byte [color] = dl
  W8(color, F.inp_23da3(0x3c9));
  // 205e3-205f2: byte [color+1] = low byte of inp(0x3c9)
  W8((color + 1) >>> 0, F.inp_23da3(0x3c9));
  // 205f5-20604: byte [color+2] = low byte of inp(0x3c9)
  W8((color + 2) >>> 0, F.inp_23da3(0x3c9));
  // 20607-2060d: [ebp-4] = color; eax = [ebp-4]
  return color;
});
