// 0x22bd7  void Keyboard_Install_Driver(void)   [Watcom, no args; no return value (EAX not set deliberately)]
// Zeroes keyboard_state[128] (int32 each at 0x64f04, LIBRARY.md), saves the current INT 9 vector via
// _dos_getvect(9) into 0x64ef8 (offset, dword) / 0x64efc (selector, word), and installs the ISR at code
// address 0x22b04 (Keyboard_Driver, LIBRARY.md) with _dos_setvect(9, CS:0x22b04).
import { F, register } from '../runtime/registry.js';
import { W16, W32 } from '../runtime/mem.js';
import { SEL_CODE } from '../platform/dpmi.js';

register(0x22bd7, 'Keyboard_Install_Driver_22bd7', function Keyboard_Install_Driver() {
  let i;       // [ebp-4]
  // 22bd7..22bdc: __CHK(0x20) omitted
  for (i = 0; i < 0x80; i++) {                 // 22bef..22c05: i = 0; cmp i,0x80; jge (signed)
    W32(0x64f04 + i * 4, 0);                   // 22c07..22c0d: mov dword [i*4 + 0x64f04], 0
  }
  // 22c19..22c1e: mov eax, 9; call _dos_getvect -> far pointer in EDX:EAX (selector:offset)
  const v = F._dos_getvect_24ccb(9);
  W16(0x64efc, v.edx);                         // 22c23, 22c27: mov ebx, edx; mov word [0x64efc], bx
  W32(0x64ef8, v.eax);                         // 22c25, 22c2e: mov ecx, eax; mov dword [0x64ef8], ecx
  // 22c34..22c4a: EAX = 9 (intno), EBX = 0x22b04 (handler offset), ECX = CS (handler selector);
  // EDX = 9 is also loaded (22c3f) but _dos_setvect overwrites EDX before reading it (0x24cfc mov edx, ebx).
  // UNCERTAIN: `mov eax, cs` — the CS selector value is chosen by the DOS extender at run time; the port
  // uses the emulated code selector SEL_CODE from platform/dpmi.js.
  F._dos_setvect_24cfb(9, 0x22b04, SEL_CODE);
});
