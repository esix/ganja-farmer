// 0x1e7a6  void sub_1e7a6(n)   [1 stack arg, callee pops it (ret 4); no register args; no return value; synchronous]
// DiamondWare STK client: subtracts the low 16 bits of n from word [0x30c87] (16-bit wrap). 0x30c87 is the
// offset of the next free byte in the DOS buffer (segment word 0x30c83 = the real-mode segment from DPMI 0100h in 0x1e49e, stored by 0x1e8d1 at 0x1e922; zeroed by 0x1e8d1 at 1e933, advanced by 0x1e774 when an
// argument block is allocated there, see 1ea27_dws_DetectHardWare.js / 1ebe4_dws_Init.js), so this releases
// the n bytes of such a block.
// Call sites (all `push imm; call 0x1e7a6`, no `add esp` afterwards): 0x1ebbc (0x58), 0x1ed7e (0x60),
// 0x1f331 (8), 0x1f58b (6), 0x1f748 (0x4a), 0x1fd73 (6).
// Signature: signatures.json (regs 0, stack 4, cdecl false, returns false) is correct: `push ebx` at 1e7a9 is a
// callee save (popped at 1e7b4), the argument is read from [ebp+8], and `ret 4` pops it (Watcom stack-arg,
// callee-pop — not cdecl). EAX is never written, so nothing is returned.
import { register } from '../runtime/registry.js';
import { R16, W16 } from '../runtime/mem.js';

register(0x1e7a6, 'sub_1e7a6', function sub_1e7a6(n) {
  // 1e7a6: push ebp; 1e7a7: mov ebp, esp; 1e7a9: push ebx
  // 1e7aa: mov ebx, [ebp+8]
  W16(0x30c87, (R16(0x30c87) - n) & 0xffff);      // 1e7ad: sub word [0x30c87], bx
  // 1e7b4: pop ebx; 1e7b5: leave; 1e7b6: ret 4
});
