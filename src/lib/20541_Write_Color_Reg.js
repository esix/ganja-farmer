// 0x20541  void Write_Color_Reg(int index, RGB_color *color)
//          [Watcom: index=EAX, color=EDX; no stack args; no return value]
// Programs one VGA DAC entry: outp(0x3c8, index), then outp(0x3c9, ...) with the bytes at color+0, +1, +2
// (red, green, blue per LIBRARY.md), each zero-extended (xor edx,edx; mov dl,[eax+n]).
// Return: EAX is left as the last outp result, but none of the 28 callers reads it (each call is followed by
// a jmp to a loop head that reloads EAX, by `mov eax, imm`, `xor eax, eax`, `inc/mov [mem]`, or by the
// epilogue of the void function 0x14fba), so the port returns nothing.
// Stage 2: programs the DAC directly (was OUT 3C8h,index; OUT 3C9h r, g, b through the CRT's outp).
import { register } from '../runtime/registry.js';
import { R8 } from '../runtime/mem.js';
import { writeDac } from '../platform/vga.js';

register(0x20541, 'Write_Color_Reg_20541', function Write_Color_Reg(index, color) {
  writeDac(index, R8(color), R8(color + 1), R8(color + 2));
});
