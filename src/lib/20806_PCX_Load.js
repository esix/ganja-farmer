// 0x20806  int PCX_Load(char *file, pcx_picture *img, int enable_palette)
//          [Watcom: EAX=file, EDX=img, EBX=enable_palette; returns 1 ok / 0 file not found]
// Stage 2: the pictures are 8-bit indexed PNGs (assets/game/*.PNG, decoded at start-up by
// platform/images.js) instead of RLE-compressed PCX files read through the C library. The result in memory
// is the same as the original's (checked for all 39 pictures: pixels, palette, buf[64000]):
//   - img->buffer (img+0x394) = the 320x200 colour indices; buf[64000] = 0x0C, the byte the original decoder
//     stored there (it ran one byte past the picture into the PCX palette marker);
//   - palette at img+0x94 + i*3 = 8-bit file palette >> 2 (6-bit DAC values);
//   - if enable_palette, Write_Color_Reg(i, img+0x94+i*3) for i = 0..255.
// Not found: printf("\nPCX SYSTEM - Couldn't find file: %s", file) and return 0, as the original.
// DEVIATION: the 128-byte header at img+0 is zeroed instead of holding the file's PCX header; nothing reads
// it (LIBRARY.md pcx_picture).
import { F, register } from '../runtime/registry.js';
import { u8, R32, readCString } from '../runtime/mem.js';
import * as images from '../platform/images.js';

register(0x20806, 'PCX_Load_20806', function PCX_Load_20806(file, img, enable_palette) {
  const name = readCString(file);
  const pic = images.get(name);
  if (!pic) {
    F.printf_23783(0x30610 /* "\nPCX SYSTEM - Couldn't find file: %s" */, file);
    return 0;
  }
  if (pic.width !== 320 || pic.height !== 200) throw new Error(`${name}: pictures must be 320x200, got ${pic.width}x${pic.height}`);

  u8.fill(0, img, img + 0x80);
  const buf = R32(img + 0x394);
  u8.set(pic.pixels, buf);
  u8[buf + 64000] = 0x0c;
  for (let i = 0; i < 768; i++) u8[img + 0x94 + i] = pic.palette[i] >> 2;

  if (enable_palette !== 0) {
    for (let i = 0; i < 0x100; i++) F.Write_Color_Reg_20541(i, img + 0x94 + i * 3);
  }
  return 1;
});
