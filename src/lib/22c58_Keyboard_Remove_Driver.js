// 0x22c58  void Keyboard_Remove_Driver(void)
//          [Watcom, no args (signatures.json regs=3 only reflects the partial `mov bx,[..]` read of EBX);
//           no return value: EAX after the call is not set by this function's own code and is not used]
// Restores the INT 9 vector saved by Keyboard_Install_Driver (0x22bd7): calls
// _dos_setvect(9, offset=[0x64ef8] (dword), selector=[0x64efc] (word)) (0x24cfb, re/names.tsv).
// No frame locals (sub esp,0).
import { F, register } from '../runtime/registry.js';
import { R16, R32 } from '../runtime/mem.js';

register(0x22c58, 'Keyboard_Remove_Driver_22c58', function Keyboard_Remove_Driver() {
  // 22c58..22c5d: __CHK(0x1c) omitted; 22c62..22c6a: push ebx/ecx/edx/esi/edi/ebp, frame
  // 22c70: mov bx,[0x64efc]      (word: saved INT 9 selector)
  // 22c77: mov eax,[0x64ef8]     (dword: saved INT 9 offset)
  // 22c7c..22c85: edx=9; ecx=ebx; ebx=eax; eax=edx  -> EAX=9, EDX=9, EBX=offset, ECX=selector
  // 22c87: call 0x24cfb (_dos_setvect). The callee uses only CX of ECX (0x24d0f/0x24d1d: mov ds,ecx);
  // ECX's upper half is the caller's EBX upper half and is never observed. EDX=9 is a leftover temp:
  // 0x24cfb overwrites EDX with EBX (0x24cfc) before reading it.
  F._dos_setvect_24cfb(9, R32(0x64ef8), R16(0x64efc));
  // 22c8c..22c92: pop ebp/edi/esi/edx/ecx/ebx; ret (EAX from the callee is not returned by design)
});
