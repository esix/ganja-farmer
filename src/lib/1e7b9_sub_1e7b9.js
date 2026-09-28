// 0x1e7b9  void sub_1e7b9(void)   [no args; saves/restores EAX, EBX, ECX, EDI, ESI; no return value; synchronous]
// DiamondWare STK client: locks two linear ranges with DPMI INT 31h AX=0600h (lock linear region,
// BX:CX = linear address, SI:DI = size in bytes):
//   1) 0x30c60 .. 0x3108c exclusive (size 0x42c)  — the STK client's data (thunk table 0x30c63, session vars 0x30c7f..,
//      0x31085/0x31087 used by 0x1e8d1);
//   2) 0x1e2f4 .. 0x201f3 (size 0x1eff) — code from the STK thunks (0x1e2f4) up to Print_Char (0x201f3).
// The INT results (CF, AX error code) are not checked. Called only by 0x1e8d1 (STK session open).
// Registers passed to int86: only what the code sets. `mov ax, 0x600`, `mov cx, bx`, `mov di, si` are
// 16-bit writes (upper halves are the caller's leftovers), so ax/cx/di are passed as 16-bit; EBX and ESI are
// fully set by `shr reg, 0x10` (high words of address / size: EBX=3, ESI=0 for range 1; EBX=1, ESI=0 for range 2).
// EDX is not set here (the caller's EDX) and not used by function 0600h, so it is not passed.
// Signature: signatures.json (regs 0, stack 0, returns false) is correct — all five pushes at 1e7b9..1e7bd
// are popped at 1e802..1e806 (register saves, no `push ebp` frame), and the popped EAX overwrites the INT
// result, so nothing is returned.
import { register } from '../runtime/registry.js';
import { int86 } from '../runtime/io.js';

register(0x1e7b9, 'sub_1e7b9', function sub_1e7b9() {
  // 1e7b9..1e7bd: push eax; push ebx; push ecx; push edi; push esi
  // 1e7be: mov ebx, 0x30c60; 1e7c3: mov cx, bx; 1e7c6: shr ebx, 0x10
  // 1e7c9: mov esi, 0x3108c; 1e7ce: sub esi, 0x30c60; 1e7d4: mov di, si; 1e7d7: shr esi, 0x10
  // 1e7da: mov ax, 0x600
  int86(0x31, {
    ax: 0x0600,
    ebx: 0x30c60 >>> 16,
    cx: 0x30c60 & 0xffff,
    esi: (0x3108c - 0x30c60) >>> 16,
    di: (0x3108c - 0x30c60) & 0xffff,
  });                                             // 1e7de: int 0x31
  // 1e7e0: mov ebx, 0x1e2f4; 1e7e5: mov cx, bx; 1e7e8: shr ebx, 0x10
  // 1e7eb: mov esi, 0x201f3; 1e7f0: sub esi, 0x1e2f4; 1e7f6: mov di, si; 1e7f9: shr esi, 0x10
  // 1e7fc: mov ax, 0x600
  int86(0x31, {
    ax: 0x0600,
    ebx: 0x1e2f4 >>> 16,
    cx: 0x1e2f4 & 0xffff,
    esi: (0x201f3 - 0x1e2f4) >>> 16,
    di: (0x201f3 - 0x1e2f4) & 0xffff,
  });                                             // 1e800: int 0x31
  // 1e802..1e806: pop esi; pop edi; pop ecx; pop ebx; pop eax
});                                               // 1e807: ret
