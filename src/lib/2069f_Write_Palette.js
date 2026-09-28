// 0x2069f  void Write_Palette(int start, int end, RGB_palette *p)
//          [Watcom: start=EAX, end=EDX, p=EBX; no stack args; signatures.json returns=false]
// For i = start .. end (signed compare, jg exit): Write_Color_Reg(i, p + 8 + i*3), i.e. &p->colors[i]
// (RGB_palette: colors at +8, 3 bytes each — LIBRARY.md). No port I/O of its own.
import { F, register } from '../runtime/registry.js';

register(0x2069f, 'Write_Palette_2069f', function Write_Palette(start, end, p) {
  // 206b5..206c1: [ebp-4] = start
  // 206c4: jmp to condition; 206c9: inc dword [ebp-4]
  for (let i = start; i <= end /* 206cf cmp / 206d2 jg (signed) */; i = (i + 1) | 0) {
    // 206d4..206e0: edx = i*3 + (p + 8); eax = i; 206e5: call Write_Color_Reg
    F.Write_Color_Reg_20541(i, (i * 3 + ((p + 8) | 0)) | 0);
  }
});
