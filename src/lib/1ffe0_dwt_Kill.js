// 0x1ffe0  void dwt_Kill(void)   [no args; EAX is preserved (push eax ... pop eax), no return value]
// DiamondWare STK client wrapper for STK function 0x18 (dwt_Kill, LIBRARY.md): stops the DWT timer in the
// STKRUN TSR. The INT to the TSR is issued inside 0x1e309 (called here with fn = 0x18), not in this function.
// Structure (identical in every STK wrapper, LIBRARY.md "STK function-number map"):
//   1. DS check: 0x30c61 holds the program's data selector. If it is 0, DS is stored there; if it differs
//      from DS, DS is reloaded from it and stored back. In both of those cases the dword 0x31088 read through
//      CS is then compared with the same dword read through DS (mismatch: error 0x29a via 0x1e3ba, return).
//      If 0x30c61 == DS, the store and the magic check are skipped (je 20027).
//      UNCERTAIN: after a real DS reload the callees would run with the reloaded DS; the port cannot pass a
//      segment register to them (only reachable if 0x30c61 holds a selector other than SEL_DATA).
//   2. Reentrancy counter byte 0x31086 (LIBRARY.md): only when it becomes 1 are the enter stub 0x1e8d1,
//      the driver call 0x1e309(0x18) and the leave stub 0x1e971 run; otherwise error 0x13 via 0x1e3ba.
// DS and EAX are pushed on entry and popped on exit, so the DS reload is local to this call.
import { F, register } from '../runtime/registry.js';
import { R8, R16, R32, W8, W16 } from '../runtime/mem.js';
import { selBase, SEL_CODE, SEL_DATA } from '../platform/dpmi.js';

register(0x1ffe0, 'dwt_Kill_1ffe0', function dwt_Kill() {
  // 1ffe0..1ffe2: push eax; push ds; push eax  (restored at 2005a/2005b; the inner copy is popped at
  // 1a/27 before EAX is reused)
  // UNCERTAIN: the caller's DS is the extender-chosen data selector; the port uses SEL_DATA from
  // platform/dpmi.js (same approach as Keyboard_Install_Driver's use of SEL_CODE).
  let ds = SEL_DATA;
  const csBase = selBase(SEL_CODE);
  let skipStore = false;
  if (R16(csBase + 0x30c61) !== 0) {                  // 1ffe3: cmp word cs:[0x30c61], 0; je 20005
    if (R16(csBase + 0x30c61) === ds) {               // 1ffee..1fff9: mov ax, ds; cmp cs:[0x30c61], ax; je 20027
      skipStore = true;
    } else {
      ds = R16(csBase + 0x30c61);                     // 1fffb: mov ds, cs:[0x30c61]
      // 20003: je 20027 — MOV does not change flags; ZF is still clear from the cmp at 1fff1, so this
      // branch is never taken and execution falls through to 20005.
    }
  }
  const dsBase = selBase(ds);
  if (!skipStore) {
    W16(dsBase + 0x30c61, ds);                        // 20005: mov word ds:[0x30c61], ds
    // 2000c..20018: mov eax, cs:[0x31088]; cmp eax, ds:[0x31088]; je 20027
    if (R32(csBase + 0x31088) !== R32(dsBase + 0x31088)) {
      // 2001a: pop eax
      F.sub_1e3ba(0x29a);                             // 2001b..20020: mov eax, 0x29a; call 0x1e3ba
      return;                                         // 20025: jmp 2005a -> pop ds; pop eax; ret
    }
  }
  // 20027: pop eax; 20028: xor eax, eax
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) + 1) & 0xff); // 2002a: inc byte [0x31086]
  if (R8(dsBase + 0x31086) === 1) {                   // 20030: cmp byte [0x31086], 1; jne 2005d
    const r = F.sub_1e8d1();                          // 20039: call 0x1e8d1
    if (r !== 0) {                                    // 2003e: cmp eax, 0; je 2004f
      F.sub_1e309(0x18);                              // 20043..20045: push 0x18; call 0x1e309 (callee pops it)
      F.sub_1e971();                                  // 2004a: call 0x1e971
      // (second leave call, falls through to 2004f; dwt_Init makes a matching extra 0x1e8d1 call at 0x1ffb5)
    }
    F.sub_1e971();                                    // 2004f: call 0x1e971
  } else {
    F.sub_1e3ba(0x13);                                // 2005d..20062: mov eax, 0x13; call 0x1e3ba; jmp 20054
  }
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) - 1) & 0xff); // 20054: dec byte [0x31086]
  // 2005a..2005c: pop ds; pop eax; ret
});
