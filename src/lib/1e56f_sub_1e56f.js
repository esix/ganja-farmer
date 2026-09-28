// 0x1e56f  void sub_1e56f(void)   [Watcom, no args; EDX saved/restored (push edx .. pop edx); no return value]
// Frees the single DOS buffer recorded in word 0x30c8b (selector) / dword 0x30c8d (size): if the selector is
// non-zero, calls 0x1e52c(DX = selector, stack = size) and clears 0x30c8b. The pair is recorded by 0x1e597
// (0x1e5ac `mov [0x30c8b], cx` = selector returned by 0x1e49e, 0x1e5b7 `mov [0x30c8d], eax` = its size arg),
// which is called from dws_MPlay 0x1faa2; 0x1e597 itself calls 0x1e56f first (free previous buffer).
// Callers: 0x1e597, 0x1e971 (STK session close), 0x1fd9b. No INT/IN/OUT here (DPMI calls are in 0x1e52c).
// Not a vector restore. EAX on return is untouched by this function (0x1e52c saves/restores EAX), so nothing
// is returned (signatures.json returns=false).
// Callee 0x1e52c: inputs DX and one stack dword (argc_overrides.json regs [edx], stack 1, mask edx 0xffff).
// Upper 16 bits of EDX at the call are the caller's leftover (only DX is loaded at 0x1e580); 0x1e52c uses
// only DX, so the port passes the 16-bit value.
import { F, register } from '../runtime/registry.js';
import { R16, R32, W16 } from '../runtime/mem.js';

register(0x1e56f, 'sub_1e56f', function sub_1e56f() {
  // 1e56f: push edx
  if (R16(0x30c8b) !== 0) {                      // 1e570: cmp word ptr [0x30c8b], 0; je 1e595
    // 1e57a: push dword ptr [0x30c8d]; 1e580: mov dx, word ptr [0x30c8b]; 1e587: call 0x1e52c (callee pops 4)
    F.sub_1e52c(R16(0x30c8b), R32(0x30c8d));
    W16(0x30c8b, 0);                             // 1e58c: mov word ptr [0x30c8b], 0
  }
  // 1e595: pop edx; 1e596: ret
});
