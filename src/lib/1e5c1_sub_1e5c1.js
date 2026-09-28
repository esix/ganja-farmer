// 0x1e5c1  void sub_1e5c1(void)   [Watcom, no args; EBX saved/restored; EDX clobbered; no return value]
// Frees every DOS buffer in the 36-entry (0x24) DWD-copy table: for i = 0..35, if dword 0x30c95[i] != 0,
// calls 0x1e52c(EDX = dword 0x30db5[i] (selector), stack = dword 0x30ff5[i] (size)) and clears 0x30c95[i].
// The table is filled by 0x1e705 (0x30c95/0x30d25/0x30db5/0x30e45/0x30ed5/0x30f65/0x30ff5, first free slot);
// re/HARDWARE.md: "One copy of each playing DWD (dws_DPlay 0x1f0a6). Up to 36 copies are tracked at 0x30c95."
// Only caller: 0x1e971 (STK session close). No INT/IN/OUT here (DPMI calls are in 0x1e52c). Not a vector
// restore. EAX is untouched (0x1e52c saves/restores EAX); nothing is returned (signatures.json returns=false).
// Callee 0x1e52c: inputs DX and one stack dword (argc_overrides.json regs [edx], stack 1, mask edx 0xffff);
// the original loads the full dword into EDX (0x1e5d5), so the port passes the dword.
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';

register(0x1e5c1, 'sub_1e5c1', function sub_1e5c1() {
  // 1e5c1: push ebx
  let i = 0;                                            // 1e5c2: xor ebx, ebx
  for (;;) {
    if (R32(0x30c95 + i * 4) !== 0) {                   // 1e5c4: cmp dword ptr [ebx*4+0x30c95], 0; je 1e5ec
      // 1e5ce: push dword ptr [ebx*4+0x30ff5]; 1e5d5: mov edx, dword ptr [ebx*4+0x30db5];
      // 1e5dc: call 0x1e52c (callee pops 4)
      F.sub_1e52c(R32(0x30db5 + i * 4), R32(0x30ff5 + i * 4));
      W32(0x30c95 + i * 4, 0);                          // 1e5e1: mov dword ptr [ebx*4+0x30c95], 0
    }
    i++;                                                // 1e5ec: inc ebx
    if (i >= 0x24) break;                               // 1e5ed: cmp ebx, 0x24; jae 1e5f4
    // 1e5f2: jmp 1e5c4
  }
  // 1e5f4: pop ebx; 1e5f5: ret
});
