// 0x1e3ba  void sub_1e3ba(int err)
//          [Watcom: err=EAX; no stack args; plain ret; no return value]
// Stores err to the dword at 0x30c7f. That is the whole function (6 bytes: mov [0x30c7f], eax; ret).
// Every one of the 57 call sites loads EAX with an immediate just before the call (0x13 x26, 0x29a x27,
// 0x10, 0x64, 0x65, 0xa x1 each), e.g. dwt_Init 0x1ff4f: `mov eax, 0x29a; call 0x1e3ba` and
// `mov eax, 0x13; call 0x1e3ba`. LIBRARY.md: 0x13 is set when an STK wrapper is re-entered.
// 0x30c7f: STK client last-error code. Writers: this function, 0x1e3d2 (in 0x1e3c0) and 0x1e8fd (in 0x1e8d1,
// clears it). Only reader: 0x1e9f4 in 0x1e9ad, a "get last error" routine that no code calls (audit of all
// references to the address bytes in flat.bin) — so no reachable code reads the value.
// EAX is unchanged (still err) on return; signatures.json returns=false (no caller reads it).
import { register } from '../runtime/registry.js';
import { W32 } from '../runtime/mem.js';

register(0x1e3ba, 'sub_1e3ba', function sub_1e3ba(err) {
  // 1e3ba: mov dword ptr [0x30c7f], eax
  W32(0x30c7f, err);
  // 1e3bf: ret
});
