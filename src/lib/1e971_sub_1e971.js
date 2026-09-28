// 0x1e971  void sub_1e971(void)   [Watcom, no args; EDX saved/restored (push edx .. pop edx); no return value]
// STK client session close (the counterpart of the session open 0x1e8d1, see the header of
// 1ff4f_dwt_Init.js). Decrements the nesting byte 0x31085; only when it reaches 0:
//   - if word 0x30c85 (selector of the 0x1000-byte DOS buffer, stored by 0x1e8d1 at 0x1e92c from the
//     0x1e49e result in CX) is non-zero, calls 0x1e52c(DX = that selector, stack 0x1000). 0x1e52c issues
//     INT 31h AX=0006h (get selector base), AX=0601h (unlock the linear region, size ((0x1000>>4)+1)<<4)
//     and AX=0101h (free DOS memory block DX) (re/HARDWARE.md §5);
//   - then calls 0x1e56f, 0x1e5c1 and 0x1e808 (no args).
// This function itself contains no INT/IN/OUT; the DPMI calls live in the callee 0x1e52c (src/lib/1e52c_sub_1e52c.js).
// EAX on return is a leftover (a callee's EAX or the caller's); signatures.json returns=false, so nothing
// is returned. Note: word 0x30c85 is NOT cleared here (unlike 0x1e56f, which clears 0x30c8b at 0x1e58c).
// Callee keys: 0x1e52c / 0x1e56f / 0x1e5c1 / 0x1e808 are not named in re/names.tsv -> sub_<addr>.
// Callee 0x1e52c arguments: its only inputs are DX (0x1e536 `mov bx, dx` before INT 31h/0006h; EDX is
// pushed at 0x1e535 and popped at 0x1e55e for INT 31h/0101h) and the stack dword [ebp+8] (0x1e549).
// EAX/EBX/ECX are overwritten before being read (CX at 0x1e543 is the INT 31h/0006h result), so the port
// passes (DX, 0x1000). Upper 16 bits of EDX at the call are the caller's leftover and are never used.
import { F, register } from '../runtime/registry.js';
import { R8, R16, W8 } from '../runtime/mem.js';

register(0x1e971, 'sub_1e971', function sub_1e971() {
  // 1e971: push edx
  W8(0x31085, (R8(0x31085) - 1) & 0xff);          // 1e972: dec byte ptr [0x31085]
  if (R8(0x31085) === 0) {                        // 1e978: cmp byte ptr [0x31085], 0; jne 1e9ab
    if (R16(0x30c85) !== 0) {                     // 1e981: cmp word ptr [0x30c85], 0; je 1e99c
      // 1e98b: mov dx, word ptr [0x30c85]; 1e992: push 0x1000; 1e997: call 0x1e52c (callee pops 4)
      F.sub_1e52c(R16(0x30c85), 0x1000);
    }
    F.sub_1e56f();                                // 1e99c: call 0x1e56f
    F.sub_1e5c1();                                // 1e9a1: call 0x1e5c1
    F.sub_1e808();                                // 1e9a6: call 0x1e808
  }
  // 1e9ab: pop edx; 1e9ac: ret
});
