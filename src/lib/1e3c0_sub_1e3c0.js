// 0x1e3c0  int sub_1e3c0(int code)   [Watcom: code=EAX; no stack args; plain ret; returns EAX = code unchanged]
// STK client status check used by the dws_* wrappers: every one of the 21 call sites does
// `and eax, 0xffff; call 0x1e3c0` right after a driver call (e.g. dws_Kill 0x1ee0f..0x1ee14), and 11 of them
// read EAX afterwards (`mov [ebp-x], eax` or `cmp eax, 0`, e.g. 0x1ee19 in dws_Kill), so the value is returned.
// If code == 0 it calls the driver with STK fn 0 (0x1e309(0), no argument block) and stores the low 16 bits
// of that result as a dword at 0x30c7f (STK client last-error code, see 1e3ba_sub_1e3ba.js).
// EAX is pushed on entry and popped before RET, so the result is always the incoming code (the value
// returned by 0x1e309 is discarded after the store).
import { F, register } from '../runtime/registry.js';
import { W32 } from '../runtime/mem.js';

register(0x1e3c0, 'sub_1e3c0', function sub_1e3c0(code) {
  // 1e3c0: push eax
  if (code === 0) {                              // 1e3c1: cmp eax, 0; jne 1e3d7
    let r = F.sub_1e309(0);                      // 1e3c6..1e3c8: push 0; call 0x1e309 (callee pops 4)
    r = r & 0xffff;                              // 1e3cd: and eax, 0xffff
    W32(0x30c7f, r);                             // 1e3d2: mov dword ptr [0x30c7f], eax
  }
  return code;                                   // 1e3d7: pop eax; 1e3d8: ret
});
