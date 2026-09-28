// 0x1e705  void sub_1e705(a1, a2, a3, a4, a5, a6)   [stack-only, callee-pop (`ret 0x18`), 6 dword args;
//          EAX/EBX saved and restored; no return value; synchronous]
// DiamondWare STK client: stores one record into the first free slot of the 36-entry (0x24) DWD-copy table.
// Scans i = 0..35 (unsigned, `jae`) for the first dword 0x30c95[i] == 0; there it writes
//   0x30c95[i] = a5, 0x30d25[i] = a3, 0x30db5[i] = a2, 0x30e45[i] = a1, 0x30ed5[i] = a4,
//   0x30f65[i] = dword 0x30c91 (then 0x30c91 is incremented), 0x30ff5[i] = a6
// and returns. If no slot is free nothing is written (0x30c91 is not incremented).
// The table is emptied by 0x1e5c1, which passes 0x30db5[i] (a2) as the selector in EDX and 0x30ff5[i] (a6) as
// the stack arg to 0x1e52c, and clears 0x30c95[i].
// Only caller: dws_DPlay 0x1eff8 at 0x1f1bf. There a1 = [ebp-0xc], a2 = zero-extended word [ebp-6],
// a3 = [ebp-4], a4 = [ebp-0x14], a5 = zero-extended word [dplay+0xa], a6 = [ebp-0x1c] (pushed a6 first).
// Signature check: signatures.json (regs 0, stack 24, callee-pop, returns false) matches the disassembly —
// args are read at [ebp+8]..[ebp+0x1c] (6 dwords), `ret 0x18`, and EAX is restored by `pop eax` at 1e76f,
// so nothing is returned. No override needed.
import { register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';

register(0x1e705, 'sub_1e705', function sub_1e705(a1, a2, a3, a4, a5, a6) {
  // 1e705: push ebp; mov ebp, esp; push eax; push ebx
  let i = 0;                                            // 1e70a: xor ebx, ebx
  for (;;) {
    if (R32(0x30c95 + i * 4) === 0) {                   // 1e70c: cmp dword ptr [ebx*4+0x30c95], 0; jne 1e766
      W32(0x30c95 + i * 4, a5);                         // 1e716: mov eax, [ebp+0x18]; mov [ebx*4+0x30c95], eax
      W32(0x30d25 + i * 4, a3);                         // 1e720: mov eax, [ebp+0x10]; mov [ebx*4+0x30d25], eax
      W32(0x30db5 + i * 4, a2);                         // 1e72a: mov eax, [ebp+0xc];  mov [ebx*4+0x30db5], eax
      W32(0x30e45 + i * 4, a1);                         // 1e734: mov eax, [ebp+8];    mov [ebx*4+0x30e45], eax
      W32(0x30ed5 + i * 4, a4);                         // 1e73e: mov eax, [ebp+0x14]; mov [ebx*4+0x30ed5], eax
      W32(0x30f65 + i * 4, R32(0x30c91));               // 1e748: mov eax, [0x30c91];  mov [ebx*4+0x30f65], eax
      W32(0x30ff5 + i * 4, a6);                         // 1e754: mov eax, [ebp+0x1c]; mov [ebx*4+0x30ff5], eax
      W32(0x30c91, (R32(0x30c91) + 1) | 0);             // 1e75e: inc dword ptr [0x30c91]
      break;                                            // 1e764: jmp 1e76e
    }
    i++;                                                // 1e766: inc ebx
    if (i >= 0x24) break;                               // 1e767: cmp ebx, 0x24; jae 1e76e
    // 1e76c: jmp 1e70c
  }
  // 1e76e: pop ebx; pop eax; leave; ret 0x18
});
