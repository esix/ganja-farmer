// 0x1e8d1  int sub_1e8d1(void)   [Watcom register convention, no args; EBX, EDX, ES saved/restored; returns EAX]
// DiamondWare STK client: session open (see the header of 1ff4f_dwt_Init.js). Increments the nesting byte
// 0x31085; only when it becomes 1: discovers the driver vector (0x1e859) if byte 0x31087 is 0, clears
// 0x30c7f / 0x30c91 / 0x30c8b / 0x30c89, allocates a 0x1000-byte DOS buffer (0x1e49e: DPMI 0100h, returns
// EAX = 1/0, EBX = real-mode segment << 16, ECX = selector), stores segment -> word 0x30c83, selector ->
// word 0x30c85, 0 -> word 0x30c87, locks ranges (0x1e7b9: DPMI 0600h) and does the handshake: STK fn 5 with
// the dword 0x6969 (0x1e342) must return AX = 0x0B. Returns 1 (ok or nested) / 0 (failure; errors: 0x64 via
// 0x1e3ba for no vector / bad handshake, 0x1e49e reports its own error 0x65).
// This function has no INT of its own; all DPMI / driver INTs are in the called helpers.
// Callee results:
//  * 0x1e859 (returns EAX = vector 0x60..0x66 or 0; 0x1e8c4 `mov eax,[ebp-4]` / 0x1e8cd `xor eax,eax`).
//    It takes no arguments (signatures.json regs 4 is an overcount: its `push ebx/ecx/edx` at 0x1e85f..
//    0x1e861 are callee saves popped at 0x1e8c8..0x1e8ca, after `add esp,-0xc`).
//  * 0x1e49e (1 stack arg, `ret 4`) returns three registers; the port expects {eax, ebx, ecx}
//    (argc_overrides.json "retregs" convention): 0x1e4c6..0x1e4d0 `shl eax,16; xor ax,ax; mov ebx,eax;
//    xor ecx,ecx; mov cx,dx` (kept across pushal/popal), 0x1e4ff `mov eax,1`; failure 0x1e528 `xor eax,eax`.
//  * 0x1e342 (2 stack args [ebp+8] = WORD argument, [ebp+0xc] = fn; `ret 8`) returns EAX (= ECX after INT).
// Callee keys: none of 0x1e859 / 0x1e49e / 0x1e7b9 / 0x1e342 / 0x1e3ba is named in re/names.tsv -> sub_<addr>.
import { F, register } from '../runtime/registry.js';
import { R8, W8, W16, W32 } from '../runtime/mem.js';

register(0x1e8d1, 'sub_1e8d1', function sub_1e8d1() {
  // 1e8d1..1e8d3: push ebx; push edx; push es (restored at 1e95f..1e961)
  W8(0x31085, (R8(0x31085) + 1) & 0xff);           // 1e8d4: inc byte [0x31085]
  if (R8(0x31085) !== 1) {                         // 1e8da: cmp byte [0x31085], 1; jne 1e95a
    return 1;                                      // 1e95a: mov eax, 1
  }
  fail: {
    if (R8(0x31087) === 0) {                       // 1e8e3: cmp byte [0x31087], 0; jne 1e8fb
      const v = F.sub_1e859();                     // 1e8ec: call 0x1e859
      if (v === 0) break fail;                     // 1e8f1: cmp eax, 0; je 1e963
      W8(0x31087, v & 0xff);                       // 1e8f6: mov byte [0x31087], al
    }
    // 1e8fb: xor eax, eax
    W32(0x30c7f, 0);                               // 1e8fd: mov dword [0x30c7f], eax
    W32(0x30c91, 0);                               // 1e902: mov dword [0x30c91], eax
    W16(0x30c8b, 0);                               // 1e907: mov word [0x30c8b], ax
    W16(0x30c89, 0);                               // 1e90d: mov word [0x30c89], ax
    const r = F.sub_1e49e(0x1000);                 // 1e913..1e918: push 0x1000; call 0x1e49e
    if (r.eax === 0) {                             // 1e91d: cmp eax, 0; je 1e95f
      return r.eax;                                // 1e95f: EAX (= 0) returned as is
    }
    W16(0x30c83, r.ebx >>> 16);                    // 1e922..1e925: shr ebx, 0x10; mov word [0x30c83], bx
    W16(0x30c85, r.ecx);                           // 1e92c: mov word [0x30c85], cx
    W16(0x30c87, 0);                               // 1e933: mov word [0x30c87], 0
    F.sub_1e7b9();                                 // 1e93c: call 0x1e7b9
    // 1e941..1e949: push 5; mov eax, 0x6969; push eax; call 0x1e342
    const h = F.sub_1e342(0x6969, 5);
    if ((h & 0xffff) === 0xb) {                    // 1e94e..1e956: and eax, 0xffff; cmp eax, 0xb; je 1e95a
      return 1;                                    // 1e95a: mov eax, 1
    }
    // 1e958: jmp 1e963
  }
  F.sub_1e3ba(0x64);                               // 1e963..1e968: mov eax, 0x64; call 0x1e3ba
  return 0;                                        // 1e96d: xor eax, eax; jmp 1e95f
});
