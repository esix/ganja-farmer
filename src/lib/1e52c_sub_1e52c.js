// 0x1e52c  void sub_1e52c(DX = selector (16-bit), stack dword size)
//          [Watcom, DX in register + 1 stack arg, callee pops 4 (ret 4); EAX/EBX/ECX/EDX/ESI/EDI are
//          pushed at 0x1e52f..0x1e534 and popped at 0x1e565..0x1e56a, so no register (incl. EAX) is changed
//          for the caller -> nothing is returned]
// DiamondWare STK client: free a DOS memory buffer (re/HARDWARE.md §6). Three DPMI calls, no CF checks:
//   INT 31h AX=0006h BX=selector            -> CX:DX = selector base (linear address)
//   INT 31h AX=0601h BX:CX = that base, SI:DI = ((size >>> 4) + 1) << 4   (unlock linear region)
//   INT 31h AX=0101h DX=selector            (free DOS memory block)
// Callers: 0x1e971 (DX = word 0x30c85, size 0x1000) and 0x1e56f (DX = word 0x30c8b, size = dword 0x30c8d).
// Parameter convention: re/difftest/argc_overrides.json "0x1e52c" (regs [edx] masked 0xffff, stack 1).
// Only the low 16 bits of EDX are used (mov bx, dx; the INT 31h/0101h selector is DX).
import { register } from '../runtime/registry.js';
import { int86 } from '../runtime/io.js';

register(0x1e52c, 'sub_1e52c', function sub_1e52c(dx /* selector, 16-bit */, size /* stack [ebp+8] */) {
  // 1e52c..1e534: push ebp; mov ebp, esp; push eax; push ebx; push ecx; push edx; push esi; push edi
  // 1e535: push edx
  // 1e536: mov bx, dx; 1e539: mov ax, 6; 1e53d: int 0x31
  // EDX is not loaded for this INT but still holds the entry value (the parameter); it is passed so that
  // the value the host leaves in DX is what the port reads back at 1e546.
  // KNOWN DEVIATION (unreachable path): if INT 31h/0006h fails (CF=1) the host leaves CX unchanged, and the
  // original then passes the CALLER's CX as BX to 0601h (0x1e543 mov bx,cx). The caller's ECX is not an input of
  // this function (callers 0x1e56f/0x1e5c1/0x1e971 never set it), so it cannot be reproduced; ECX is not passed and
  // r1.ecx is whatever the emulated host returns. Unreachable in practice: the selectors passed here come only from
  // successful 0x1e49e allocations, for which 0006h succeeds. (Independent audit of 0x1e52c, finding 1.)
  const r1 = int86(0x31, { ax: 6, bx: dx & 0xffff, edx: dx >>> 0 });
  // 1e53f: mov ax, 0x601
  // 1e543: mov bx, cx            (CX from INT 31h/0006h: base high word)
  // 1e546: mov cx, dx            (DX from INT 31h/0006h: base low word)
  // 1e549: mov edx, [ebp+8]; 1e54c: shr edx, 4; 1e54f: inc edx; 1e550: shl edx, 4
  let edx = size >>> 0;
  edx = edx >>> 4;
  edx = (edx + 1) >>> 0;
  edx = (edx << 4) >>> 0;
  const di = edx & 0xffff;        // 1e553: mov di, dx
  edx = edx >>> 16;               // 1e556: shr edx, 0x10
  const si = edx & 0xffff;        // 1e559: mov si, dx
  // 1e55c: int 0x31  (results not read)
  int86(0x31, { ax: 0x601, bx: r1.ecx & 0xffff, cx: r1.edx & 0xffff, edx: edx, si: si, di: di });
  // 1e55e: pop edx  (EDX = the value at entry; DX = selector)
  // 1e55f: mov ax, 0x101; 1e563: int 0x31  (results not read)
  int86(0x31, { ax: 0x101, dx: dx & 0xffff });
  // 1e565..1e56c: pop edi; pop esi; pop edx; pop ecx; pop ebx; pop eax; leave; ret 4
});
