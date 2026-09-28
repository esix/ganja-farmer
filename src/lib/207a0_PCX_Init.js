// 0x207a0  int PCX_Init(img)
//   [Watcom: img=EAX; no stack args; returns 1 if the buffer was allocated, else 0 (EAX from [ebp-4]).
//    signatures.json says returns:false, but the disassembly loads [ebp-4] into EAX before RET.]
// img->buffer (+0x394, LIBRARY.md pcx_picture) = malloc(0xfa01); if that is 0, printf("\nPCX SYSTEM - Couldn't
// allocate PCX image buffer") and return 0, else return 1.
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';

register(0x207a0, 'PCX_Init_207a0', function PCX_Init_207a0(img) {
  let result; // [ebp-4]

  W32(img + 0x394, F.malloc_23dab(0xfa01)); // buffer (LIBRARY.md)
  if (R32(img + 0x394) === 0) {
    // Only the format string is pushed (push eax=0x305dc; add esp,4) — no further printf args.
    F.printf_23783(0x305dc /* "\nPCX SYSTEM - Couldn't allocate PCX image buffer" */);
    result = 0;
  } else {
    result = 1;
  }
  return result;
});
