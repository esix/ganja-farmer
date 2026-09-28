// 0x2225c  int Read_Pixel_DB(int x, int y)
//          [Watcom: x=EAX, y=EDX; returns EAX = pixel zero-extended to 32 bits (0..255)]
// Returns the byte at double_buffer [0x64e7c] + y*320 + x. No clipping.
import { register } from '../runtime/registry.js';
import { R8, R32 } from '../runtime/mem.js';

register(0x2225c, 'Read_Pixel_DB_2225c', function Read_Pixel_DB(x, y) {
  let pixel;   // [ebp-4]
  // 22279..2228f: edx = (y << 6) + (y << 8) + x + [0x64e7c]  (32-bit wrap)
  // 22291..22295: xor eax, eax; mov al, [edx] -- upper 24 bits of EAX are 0
  pixel = R8((((((y << 6) + (y << 8)) | 0) + x | 0) + R32(0x64e7c)) >>> 0);
  return pixel;                                         // 22298: mov eax, [ebp-4]
});
