// 0x202cd  void Print_String(x, y, color, s, transparent)
//   [Watcom: x=EAX, y=EDX, color=EBX, s=ECX; transparent on the stack (ret 4); no return value]
// Calls strlen(s) once, then Print_Char(x + i*8, y, (uint8)s[i], color, transparent) for i = 0 .. len-1.
import { F, register } from '../runtime/registry.js';
import { R8 } from '../runtime/mem.js';

register(0x202cd, 'Print_String_202cd', function Print_String_202cd(x, y, color, s, transparent) {
  let len; // [ebp-4]
  let i;   // [ebp-8]

  len = F.strlen_23d44(s) | 0;                  // 202f1: call strlen(eax = s)
  for (i = 0; i < len; i++) {                   // 20308: cmp i, len; jge (signed)
    // 2032d: Print_Char(eax = i*8 + x, edx = y, ebx = (uint8)s[i], ecx = color, push transparent)
    F.Print_Char_201f3(((i << 3) + x) | 0, y, R8((s + i) | 0), color, transparent);
  }
});
