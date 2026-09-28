// 0x221aa  void Print_String_DB(int x, int y, int color, char *s, int transparent)
//          [Watcom: x=EAX, y=EDX, color=EBX, s=ECX, transparent on stack; callee pops 4 (ret 4); no return value]
// Calls strlen(s) once, then Print_Char_DB(x + i*8, y, (uint8)s[i], color, transparent) for i = 0 .. len-1.
import { F, register } from '../runtime/registry.js';
import { R8 } from '../runtime/mem.js';

register(0x221aa, 'Print_String_DB_221aa', function Print_String_DB(x, y, color, s, transparent) {
  let len; // [ebp-4]
  let i;   // [ebp-8]

  len = F.strlen_23d44(s) | 0;                  // 221cb: call strlen(eax = s)
  for (i = 0; i < len; i++) {                   // 221d6..221eb: signed compare (jge)
    // 221ed..2220a: push transparent; ecx=color; ebx=(xor ebx,ebx; mov bl,[s+i]) zero-extended byte; edx=y; eax=(i<<3)+x
    F.Print_Char_DB_220d0(((i << 3) + x) | 0, y, R8((s + i) >>> 0), color, transparent);
  }
});
