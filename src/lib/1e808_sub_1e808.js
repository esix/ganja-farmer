// 0x1e808  void sub_1e808(void)   [no args; EAX, EBX, ECX, EDX, EDI, ESI saved/restored (push 1e808..1e80d,
// pop 1e852..1e857); no return value: EAX is restored to the caller's value]
// DiamondWare STK client: unlocks the two regions that 0x1e7b9 locks (same ranges, AX=0600h there).
// Issues INT 31h AX=0601h (DPMI "unlock linear region": BX:CX = linear address, SI:DI = size) twice:
//   - 0x30c60 .. 0x3108c exclusive (size 0x42c) — STK client data (incl. the thunk table at 0x30c63 and the
//     word 0x30c85 / byte 0x31085 session variables);
//   - 0x1e2f4 .. 0x201f3 exclusive (size 0x1eff) — code from the thunk 0x1e2f4 up to Print_Char (0x201f3).
// The DPMI results (CF / AX) are not examined. Called only by 0x1e971 (at 0x1e9a6), which runs it when the 0x31085 counter reaches 0 (the session close,
// src/lib/1e971_sub_1e971.js).
// INT registers: only the parts the original loads are passed (AX, CX, DI are 16-bit loads; EBX and ESI are
// full 32-bit after `shr reg, 0x10`); EDX is not loaded (caller's leftover, unused by DPMI 0601h).
import { register } from '../runtime/registry.js';
import { int86 } from '../runtime/io.js';

register(0x1e808, 'sub_1e808', function sub_1e808() {
  // 1e808..1e80d: push eax; push ebx; push ecx; push edx; push edi; push esi
  // 1e80e..1e82e: mov ebx, 0x30c60; mov cx, bx; shr ebx, 0x10; mov esi, 0x3108c; sub esi, 0x30c60;
  //               mov di, si; shr esi, 0x10; mov ax, 0x601; int 0x31
  int86(0x31, { ax: 0x601, ebx: 0x30c60 >>> 16, cx: 0x30c60 & 0xffff,
                esi: (0x3108c - 0x30c60) >>> 16, di: (0x3108c - 0x30c60) & 0xffff });
  // 1e830..1e850: mov ebx, 0x1e2f4; mov cx, bx; shr ebx, 0x10; mov esi, 0x201f3; sub esi, 0x1e2f4;
  //               mov di, si; shr esi, 0x10; mov ax, 0x601; int 0x31
  int86(0x31, { ax: 0x601, ebx: 0x1e2f4 >>> 16, cx: 0x1e2f4 & 0xffff,
                esi: (0x201f3 - 0x1e2f4) >>> 16, di: (0x201f3 - 0x1e2f4) & 0xffff });
  // 1e852..1e857: pop esi; pop edi; pop edx; pop ecx; pop ebx; pop eax; 1e858: ret
});
