// 0x20541  void Write_Color_Reg(int index, RGB_color *color)
//          [Watcom: index=EAX, color=EDX; no stack args; no return value]
// Programs one VGA DAC entry: outp(0x3c8, index), then outp(0x3c9, ...) with the bytes at color+0, +1, +2
// (red, green, blue per LIBRARY.md), each zero-extended (xor edx,edx; mov dl,[eax+n]).
// Return: EAX is left as the last outp result, but none of the 28 callers reads it (each call is followed by
// a jmp to a loop head that reloads EAX, by `mov eax, imm`, `xor eax, eax`, `inc/mov [mem]`, or by the
// epilogue of the void function 0x14fba), so the port returns nothing.
import { F, register } from '../runtime/registry.js';
import { R8 } from '../runtime/mem.js';

register(0x20541, 'Write_Color_Reg_20541', function Write_Color_Reg(index, color) {
  // 20558/2055b: [ebp-8] = index, [ebp-4] = color
  // 2055e-20566: outp(0x3c8, index)
  F.outp_23d99(0x3c8, index);
  // 2056b-20577: outp(0x3c9, byte [color])
  F.outp_23d99(0x3c9, R8(color));
  // 2057c-20589: outp(0x3c9, byte [color + 1])
  F.outp_23d99(0x3c9, R8((color + 1) | 0));
  // 2058e-2059b: outp(0x3c9, byte [color + 2])
  F.outp_23d99(0x3c9, R8((color + 2) | 0));
  // 205a0-205a7: epilogue
});
