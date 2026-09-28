// 0x20b69  void PCX_Delete(pcx_picture *img)
//          [Watcom: EAX=img; no return value — EAX after free is only passed through by callers' own epilogues]
// Frees img->buffer (img+0x394, LIBRARY.md) via free (0x23ff0). The pointer is not cleared.
import { F, register } from '../runtime/registry.js';
import { R32 } from '../runtime/mem.js';

register(0x20b69, 'PCX_Delete_20b69', function PCX_Delete_20b69(img) {
  // 20b84..20b8d: eax = [img+0x394]; call free
  F.free_23ff0(R32(img + 0x394));
});
