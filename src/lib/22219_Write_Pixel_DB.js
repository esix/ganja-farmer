// 0x22219  void Write_Pixel_DB(int x, int y, int color)
//          [Watcom: x=EAX, y=EDX, color=EBX (low byte stored); no stack args; plain ret; no return value]
// Stores the low byte of color at double_buffer [0x64e7c] + y*320 + x. No clipping.
// signatures.json says returns=true only because EAX is left as ([0x64e7c] & ~0xff) | (color & 0xff) by the
// byte store; all 4 call sites (after 0x11ca5, 0x1220e, 0x12e0a, 0x1dee1) overwrite EAX before reading it.
import { register } from '../runtime/registry.js';
import { R32, W8 } from '../runtime/mem.js';

register(0x22219, 'Write_Pixel_DB_22219', function Write_Pixel_DB(x, y, color) {
  // 22238..22246: (y << 8) + (y << 6) + x;  22249..2224e: + [0x64e7c]
  // 22250..22253: mov al, [ebp-4] (BL); mov [edx], al
  W8((((((y << 8) + (y << 6)) | 0) + x | 0) + R32(0x64e7c)) >>> 0, color & 0xff);
});
