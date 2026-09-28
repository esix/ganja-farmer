// 0x1e37f  int sub_1e37f(n, fn, farptr)   [stack args only, callee pops (ret 0xc); EBX/ECX/EDX saved]
// DiamondWare STK driver call with an argument block (see the call-mechanism header in 1ff4f_dwt_Init.js and
// re/HARDWARE.md §6):  [ebp+8] = n (argument byte count -> ECX), [ebp+0xc] = fn (STK function number),
// [ebp+0x10] = real-mode far pointer seg:off to the argument block (-> EAX).
// EBX = fn << 16 | 0x6969, EDX = byte [0x31087] (driver vector). If 0x60 <= vector <= 0x66 it calls through
// the table dword [0x30c63 + (vector-0x60)*4] (initial image: 0x1e2f4, 0x1e2f7, ..., 0x1e306 = `int 60h..66h;
// ret` thunks) with EDX = vector-0x60. Returns EAX = ECX (after the INT: the driver's DX:AX result; if no
// call was made: n). This function itself writes no memory (the callers build the argument block).
//
// The INT is not in this function: it is in the thunks 0x1e2f4..0x1e306, reached by the indirect call at
// 0x1e3aa, so it is ported as callPtr(table entry, EAX, EDX, EBX, ECX).
// Thunk contract assumed here (thunks ported in 1e2f4..1e306_sub_*.js, verified): callPtr(thunk, eax, edx, ebx, ecx) performs
// int86(0x60+k, {eax, ebx, ecx, edx}) and returns the register object after the INT; this function reads
// only its .ecx (0x1e3b1 mov eax, ecx).
// UNCERTAIN: the thunks are register-in/register-out; the object return (.ecx) is the port's convention for
// that, not an original construct. ESI/EDI/EBP (caller's values) also reach the INT but the STK handler does
// not read them (HARDWARE.md §6), so they are not passed.
import { callPtr, register } from '../runtime/registry.js';
import { R8, R32 } from '../runtime/mem.js';

register(0x1e37f, 'sub_1e37f', function sub_1e37f(n, fn, farptr) {
  // 1e37f..1e384: push ebp; mov ebp, esp; push ebx; push ecx; push edx (restored on return)
  let ebx = (fn << 16) >>> 0;                    // 1e385..1e388: mov ebx, [ebp+0xc]; shl ebx, 0x10
  ebx = ((ebx & 0xffff0000) | 0x6969) >>> 0;     // 1e38b: mov bx, 0x6969
  const eax = farptr >>> 0;                      // 1e38f: mov eax, [ebp+0x10]
  let ecx = n >>> 0;                             // 1e392: mov ecx, [ebp+8]
  let edx = 0;                                   // 1e395: xor edx, edx
  edx = R8(0x31087);                             // 1e397: mov dl, byte [0x31087]
  if (!(edx < 0x60) && !(edx > 0x66)) {          // 1e39d..1e3a5: cmp dl, 0x60; jb 1e3b1; cmp dl, 0x66; ja 1e3b1
    edx = (edx - 0x60) >>> 0;                    // 1e3a7: sub edx, 0x60
    // 1e3aa: call dword [edx*4 + 0x30c63]  (thunk `int 0x6?; ret`)
    const r = callPtr(R32(0x30c63 + edx * 4), eax, edx, ebx, ecx);
    ecx = r.ecx >>> 0;
  }
  return ecx | 0;                                // 1e3b1: mov eax, ecx; 1e3b3..1e3b7: pop edx/ecx/ebx; leave; ret 0xc
});
