// 0x1e342  int sub_1e342(DWORD arg, DWORD fn)   [stack args only, callee pops (ret 8); EBX/ECX/EDX saved/restored]
// DiamondWare STK client driver call with one WORD argument (see the call-mechanism header in
// 1ff4f_dwt_Init.js and re/HARDWARE.md §6): EAX = arg, EBX = fn << 16 | 0x6969, ECX = 2 (argument byte
// count), EDX = 0 with DL = byte [0x31087] (the STK vector found by 0x1e859). If 0x60 <= DL <= 0x66 it calls
// the thunk [0x30c63 + (DL - 0x60) * 4] (table of `int 0x60..0x66; ret` at 0x1e2f4..0x1e306 in the data image),
// with EDX = DL - 0x60 at the call. Returns EAX = ECX: the ECX left by the thunk's INT (driver DX:AX), or 2
// when the vector byte is out of range (no call). Callers mask the result with 0xFFFF.
// The INT itself is in the thunk (not in this function); it is reached through callPtr with the four
// registers the INT sees (Watcom order EAX, EDX, EBX, ECX).
// UNCERTAIN: thunk interface — the thunks (0x1e2f4, 0x1e2f7, 0x1e2fa, 0x1e2fd, 0x1e300, 0x1e303, 0x1e306) are
// ported in 1e2f4..1e306_sub_*.js (verified). This port assumes a thunk returns the register set after its INT as an object
// ({eax, ecx, ...}, as int86 returns) and reads only .ecx from it, since `int N; ret` changes ECX (and the
// handler restores every other register, platform/stk.js).
import { callPtr, register } from '../runtime/registry.js';
import { R8, R32 } from '../runtime/mem.js';

register(0x1e342, 'sub_1e342', function sub_1e342(arg, fn) {
  // 1e342..1e347: push ebp; mov ebp, esp; push ebx; push ecx; push edx (restored on return)
  let ebx = fn << 16;                            // 1e348, 1e34b: mov ebx, [ebp+0xc]; shl ebx, 0x10
  ebx = (ebx & 0xffff0000) | 0x6969;             // 1e34e: mov bx, 0x6969
  const eax = arg;                               // 1e352: mov eax, [ebp+8]
  let ecx = 2;                                   // 1e355: mov ecx, 2
  let edx = 0;                                   // 1e35a: xor edx, edx
  edx = R8(0x31087);                             // 1e35c: mov dl, byte [0x31087]
  if (edx >= 0x60 && edx <= 0x66) {             // 1e362..1e36a: cmp dl, 0x60; jb 1e376; cmp dl, 0x66; ja 1e376
    edx = edx - 0x60;                            // 1e36c: sub edx, 0x60
    // 1e36f: call dword ptr [edx*4 + 0x30c63]  (thunk: int 0x60+edx; ret)
    ecx = callPtr(R32(0x30c63 + edx * 4), eax, edx, ebx | 0, ecx).ecx;
  }
  return ecx;                                    // 1e376: mov eax, ecx; 1e378..1e37c: pop edx/ecx/ebx; leave; ret 8
});
