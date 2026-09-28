// 0x220d0  void Print_Char_DB(int x, int y, char c, int color, int transparent)
//          [Watcom: x=EAX, y=EDX, c=BL (byte), color=ECX (low byte stored), transparent on stack; ret 4;
//           no return value]
// Draws the 8x8 glyph of (uint8)c from the font pointed to by [0x31094] (rom_char_set, 0xFFA6E) into
// double_buffer [0x64e7c] at offset x + y*320: set bits (0x80 = leftmost) write color, clear bits write 0
// unless transparent != 0. No clipping.
import { register } from '../runtime/registry.js';
import { R8, R32, W8 } from '../runtime/mem.js';

register(0x220d0, 'Print_Char_DB_220d0', function Print_Char_DB(x, y, c, color, transparent) {
  let glyph;   // [ebp-0xc]
  let offset;  // [ebp-0x14]
  let row;     // [ebp-0x10]
  let mask;    // [ebp-8] (byte)
  let col;     // [ebp-0x1c]

  // 220eb: mov [ebp-4], bl -- only the low byte of c is kept; 220f1..22101: movzx, shl 3, + [0x31094]
  glyph = (R32(0x31094) + ((c & 0xff) << 3)) | 0;
  // 22104..22117: (y << 8) + (y << 6) + x
  offset = (x + (((y << 6) + (y << 8)) | 0)) | 0;
  for (row = 0; row < 8; row++) {                      // 2211a..2212d: signed (jge)
    mask = 0x80;                                       // 22133: mov byte [ebp-8], 0x80
    for (col = 0; col < 8; col++) {                    // 22137..2214a: signed (jge)
      if ((R8(glyph >>> 0) & mask) !== 0) {            // 2214c..2215a: movzx both, test
        // 2215c..2216c: [offset + col + [0x64e7c]] = color (byte)
        W8((((offset + col) | 0) + R32(0x64e7c)) >>> 0, color & 0xff);
      } else if (transparent === 0) {                  // 22170: cmp dword [ebp+0x10], 0; jne
        // 22176..22184: [offset + col + [0x64e7c]] = 0
        W8((((offset + col) | 0) + R32(0x64e7c)) >>> 0, 0);
      }
      mask = (mask >> 1) & 0xff;                       // 22187..2218e: movzx, sar 1, store byte
    }
    offset = (offset + 0x140) | 0;                     // 22193: add [ebp-0x14], 0x140
    glyph = (glyph + 1) | 0;                           // 2219a..2219d: inc [ebp-0xc]
  }
});
