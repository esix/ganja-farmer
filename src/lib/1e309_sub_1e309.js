// 0x1e309  int sub_1e309(int fn)   [1 stack arg, callee pops (ret 4); EBX/ECX/EDX saved and restored]
// STK driver call without an argument block (see the call-mechanism header in 1ff4f_dwt_Init.js and
// re/HARDWARE.md §6): EBX = fn << 16 | 0x6969, EAX = ECX = 0, and if the STK vector byte 0x31087 is in
// 0x60..0x66 it calls the thunk [0x30c63 + (vector - 0x60) * 4] (`int 0x60..0x66; ret`, 0x1e2f4..0x1e306).
// Returns EAX = ECX after the call (0 if the vector byte is out of range).
//
// Thunk interface (for the ports of 0x1e2f4..0x1e306, not written yet): the thunks take no stack args and
// use the registers live at the call; they are called here as thunk(eax, edx, ebx, ecx) (the registers
// this function sets) and must return the register object after the INT, i.e. the int86() result
// {eax, ebx, ecx, edx, ..., cf}. Only .ecx is read here.
// UNCERTAIN: ESI/EDI/EBP/segment registers are also live at the INT but are not set by this function
// (inherited from the caller); they are not passed.
import { register, callPtr } from '../runtime/registry.js';
import { R8, R32 } from '../runtime/mem.js';

register(0x1e309, 'sub_1e309', function sub_1e309(fn) {
  // 1e309..1e30e: push ebp; mov ebp, esp; push ebx; push ecx; push edx (restored at 1e33b..1e33d)
  let ebx = (fn << 16) >>> 0;                  // 1e30f: mov ebx, [ebp+8]; 1e312: shl ebx, 0x10
  ebx = (ebx | 0x6969) >>> 0;                  // 1e315: mov bx, 0x6969
  const eax = 0;                               // 1e319: xor eax, eax
  let ecx = 0;                                 // 1e31b: xor ecx, ecx
  let edx = 0;                                 // 1e31d: xor edx, edx
  edx = R8(0x31087);                           // 1e31f: mov dl, [0x31087]
  if (edx >= 0x60) {                           // 1e325: cmp dl, 0x60; jb 1e339
    if (edx <= 0x66) {                         // 1e32a: cmp dl, 0x66; ja 1e339
      edx = edx - 0x60;                        // 1e32f: sub edx, 0x60
      // 1e332: call [edx*4 + 0x30c63]  -> `int 0x60+edx; ret` thunk; ECX after the INT is read below
      const r = callPtr(R32(0x30c63 + edx * 4), eax, edx, ebx, ecx);
      ecx = r.ecx;
    }
  }
  return ecx | 0;                              // 1e339: mov eax, ecx; 1e33b..1e33f: pop; leave; ret 4
});
