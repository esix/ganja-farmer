// 0x201f3  void Print_Char(int x, int y, char c, int color, int transparent)
//   [Watcom: x=EAX, y=EDX, c=BL (byte), color=ECX (low byte stored); transparent on the stack (ret 4);
//    no return value]
// Draws the 8x8 glyph at rom_char_set [0x31094] + (uint8)c*8 to video_buffer [0x31090] + y*320 + x:
// for each set bit (0x80 = leftmost) writes the low byte of color; for each clear bit writes 0 unless
// transparent != 0. No clipping.
import { register } from '../runtime/registry.js';
import { R8, R32, W8 } from '../runtime/mem.js';

register(0x201f3, 'Print_Char_201f3', function Print_Char_201f3(x, y, c, color, transparent) {
  let glyph;  // [ebp-0xc]  byte pointer into the font
  let offset; // [ebp-0x14]
  let row;    // [ebp-0x10]
  let mask;   // [ebp-8]    byte
  let col;    // [ebp-0x1c]

  // 20214..20224: glyph = [0x31094] + (movzx byte c) << 3
  glyph = (R32(0x31094) + ((c & 0xff) << 3)) | 0;
  // 20227..2023a: offset = (y << 8) + (y << 6) + x
  offset = ((((y << 8) + (y << 6)) | 0) + x) | 0;
  for (row = 0; row < 8; row++) {               // 2024c: cmp row, 8; jge (signed)
    mask = 0x80;                                // 20256
    for (col = 0; col < 8; col++) {             // 20269: cmp col, 8; jge (signed)
      if ((R8(glyph >>> 0) & mask) !== 0) {     // 2026f..2027d: movzx [glyph]; test edx, eax; je
        // 2027f..2028f: [offset + col + [0x31090]] = (byte)color
        W8((((offset + col) | 0) + R32(0x31090)) >>> 0, color & 0xff);
      } else if (transparent === 0) {           // 20293: cmp dword [ebp+0x10], 0; jne
        // 20299..202a7: [offset + col + [0x31090]] = 0
        W8((((offset + col) | 0) + R32(0x31090)) >>> 0, 0);
      }
      mask = (mask >> 1) & 0xff;                // 202aa..202b1: movzx mask; sar eax, 1; store byte
    }
    offset = (offset + 0x140) | 0;              // 202b6
    glyph = (glyph + 1) | 0;                    // 202bd..202c0
  }
});
