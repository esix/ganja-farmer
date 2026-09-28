// 0x2156b  int Create_Double_Buffer(int lines)
//          [Watcom: lines=EAX; no stack args; returns 1 ok / 0 malloc failed]
// double_buffer [0x64e7c] = malloc((lines+1)*320). On NULL: printf("\nCouldn't allocate double buffer.")
// and return 0 (no exit). Else double_buffer_height [0x310a0] = lines, double_buffer_size [0x310a4] =
// (lines*320) >>> 1 (words), memset(double_buffer, 0, lines*320), return 1.
// Return: EAX is loaded from the local [ebp-4] (set to 0 or 1) at 0x215ea. The only caller (0x1aa35, from
// main with lines=200) does not read it; signatures.json says returns=false because of that. It is kept
// because the original sets it explicitly.
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';

register(0x2156b, 'Create_Double_Buffer_2156b', function Create_Double_Buffer(lines) {
  let ret;
  // 21586..21595: eax = (lines + 1) * 0x140 (imul, 32-bit); call malloc; [0x64e7c] = eax
  W32(0x64e7c /* double_buffer (LIBRARY.md) */, F.malloc_23dab(Math.imul((lines + 1) | 0, 0x140)));
  // 2159a: cmp dword [0x64e7c], 0 / jne
  if (R32(0x64e7c) === 0) {
    // 215a3..215ae: push 0x30635 ("\nCouldn't allocate double buffer."); call printf; add esp, 4
    F.printf_23783(0x30635);
    // 215b1: [ebp-4] = 0
    ret = 0;
  } else {
    // 215ba..215bd: [0x310a0] = lines  (double_buffer_height, LIBRARY.md)
    W32(0x310a0, lines);
    // 215c2..215cb: [0x310a4] = (lines * 0x140) shr 1  (double_buffer_size in words, LIBRARY.md)
    W32(0x310a4, Math.imul(lines, 0x140) >>> 1);
    // 215d0..215de: ebx = lines * 0x140; edx = 0; eax = [0x64e7c]; call memset
    F.memset_23d81(R32(0x64e7c), 0, Math.imul(lines, 0x140));
    // 215e3: [ebp-4] = 1
    ret = 1;
  }
  // 215ea: eax = [ebp-4]
  return ret;
});
