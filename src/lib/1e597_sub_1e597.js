// 0x1e597  {eax, ebx, ecx, edx} sub_1e597(DWORD size)
//          [1 stack arg, callee pops (`ret 4`); no register args; returns the registers of 0x1e49e]
// DiamondWare STK client: (re)allocates the single DOS buffer recorded at word 0x30c8b (selector) /
// dword 0x30c8d (size), the pair freed by 0x1e56f. Frees the previous one (0x1e56f), allocates `size` bytes
// (0x1e49e); on success (EAX != 0) records CX (selector) at 0x30c8b and the size argument at 0x30c8d.
// Only caller: dws_MPlay 0x1faa2 (call at 0x1fb59), which tests EAX (0x1fb5e `cmp eax,0; je`) and on non-zero
// reads EBX (0x1fb67), CX (0x1fb6a) and EDX (0x1fb6e) - all as left by 0x1e49e: this function does not
// touch EBX/ECX/EDX after the call and preserves EAX around its own store (0x1e5b3 push eax .. 0x1e5bc pop eax).
// So the port returns 0x1e49e's register object unchanged (on failure {eax: 0}; the caller then reads nothing
// else).
// Callee keys: 0x1e56f / 0x1e49e are not named in re/names.tsv -> sub_<addr>.
import { F, register } from '../runtime/registry.js';
import { W16, W32 } from '../runtime/mem.js';

register(0x1e597, 'sub_1e597', function sub_1e597(size) {
  // 1e597, 1e598: push ebp; mov ebp, esp
  F.sub_1e56f();                                // 1e59a: call 0x1e56f
  const r = F.sub_1e49e(size);                  // 1e59f: push dword ptr [ebp+8]; 1e5a2: call 0x1e49e (ret 4)
  if (r.eax !== 0) {                            // 1e5a7: cmp eax, 0; 1e5aa: je 1e5bd
    W16(0x30c8b, r.ecx);                        // 1e5ac: mov word ptr [0x30c8b], cx
    // 1e5b3: push eax
    W32(0x30c8d, size);                         // 1e5b4: mov eax, [ebp+8]; 1e5b7: mov dword ptr [0x30c8d], eax
    // 1e5bc: pop eax
  }
  return r;                                     // 1e5bd, 1e5be: leave; ret 4 (EAX/EBX/ECX/EDX from 0x1e49e)
});
