// 0x20806  int PCX_Load(char *file, pcx_picture *img, int enable_palette)
//          [Watcom: EAX=file, EDX=img, EBX=enable_palette; returns 1 ok / 0 file not found]
// Stage 2: the pictures are 8-bit indexed PNGs (assets/game/*.PNG, decoded at start-up by platform/images.js)
// and the pcx_picture struct no longer owns a pixel buffer: PCX_Load binds the struct to the decoded picture
// (images.bind), and PCX_Show_Buffer / PCX_Copy_To_Buffer / PCX_Get_Sprite read it from there. PCX_Init
// (which allocated the 64001-byte buffer) and PCX_Delete (which freed it) are gone.
//   - if enable_palette: the DAC gets the file palette >> 2 (6-bit), entries 0..255, through Write_Color_Reg
//     as before (it takes a pointer, so the three bytes go through a small block of emulated memory).
// Not found: printf("\nPCX SYSTEM - Couldn't find file: %s", file) and return 0, as the original.
import { F, register } from '../runtime/registry.js';
import { W8, readCString } from '../runtime/mem.js';
import { stackAlloc, stackFree } from '../runtime/stack.js';
import * as images from '../platform/images.js';

register(0x20806, 'PCX_Load_20806', function PCX_Load_20806(file, img, enable_palette) {
  const name = readCString(file);
  const pic = images.get(name);
  if (!pic) {
    F.printf_23783(0x30610 /* "\nPCX SYSTEM - Couldn't find file: %s" */, file);
    return 0;
  }
  if (pic.width !== 320 || pic.height !== 200) throw new Error(`${name}: pictures must be 320x200, got ${pic.width}x${pic.height}`);
  images.bind(img, pic);
  if (enable_palette !== 0) {
    const rgb = stackAlloc(4);
    for (let i = 0; i < 0x100; i++) {
      W8(rgb, pic.palette[i * 3] >> 2); W8(rgb + 1, pic.palette[i * 3 + 1] >> 2); W8(rgb + 2, pic.palette[i * 3 + 2] >> 2);
      F.Write_Color_Reg_20541(i, rgb);
    }
    stackFree(4);
  }
  return 1;
});
