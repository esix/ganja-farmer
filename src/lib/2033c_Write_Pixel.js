// 0x2033c  void Write_Pixel(int x, int y, int color)
//          [Watcom: x=EAX, y=EDX, color=EBX (low byte stored); no stack args; plain ret; no return value]
// Stores the low byte of color at video_buffer [0x31090] + y*320 + x. No clipping.
// 0x31090: video_buffer = 0xA0000 (LIBRARY.md). signatures.json returns=false; EAX is left as
// ([0x31090] & ~0xff) | (color & 0xff) by the byte store, which no caller reads.
import { register } from '../runtime/registry.js';
import { R32, W8 } from '../runtime/mem.js';

register(0x2033c, 'Write_Pixel_2033c', function Write_Pixel(x, y, color) {
  // 2035b..20369: (y << 8) + (y << 6) + x;  2036c..20371: + [0x31090]
  // 20373..20376: mov al, [ebp-4] (BL); mov [edx], al
  W8((((((y << 8) + (y << 6)) | 0) + x | 0) + R32(0x31090)) >>> 0, color & 0xff);
});
