// 0x1eda6  void dws_Kill(void)   [no args; no stack frame (no push ebp); DS saved/restored; EAX NOT preserved]
// DiamondWare STK client wrapper for STK function 4 (dws_Kill, LIBRARY.md): shuts down the sound system in the
// STKRUN TSR. The INT to the TSR is issued inside 0x1e309 (called here with fn = 4), not in this function.
// Same frame as dwt_Kill (1ffe0_dwt_Kill.js), with these differences tied to instructions:
//   - only `push ds; push eax` on entry (1eda6/1eda7), no push ebp and no outer push eax: the inner EAX copy
//     is popped at 1eddf/1edec before EAX is reused, so EAX on return is a leftover (0x1e971's or 0x1e3ba's).
//   - the driver result is passed through 0x1e3c0 (1ee0f: and eax, 0xffff; 1ee14: call 0x1e3c0). 0x1e3c0
//     (src/lib/1e3c0_sub_1e3c0.js) stores the STK error code at 0x30c7f when its EAX argument is 0 and returns EAX unchanged
//     (push eax .. pop eax at 1e3c0/1e3d7). The second 0x1e971 call at 1ee1e is made only if that is non-zero.
// Return value: signatures.json returns=false; both callers (decompiled.c lines 5286, 9268) ignore EAX, and
// EAX is not deliberately set before RET -> nothing is returned.
// Callee keys: 0x1e8d1 / 0x1e971 / 0x1e309 / 0x1e3c0 / 0x1e3ba are not named in re/names.tsv -> sub_<addr>.
import { F, register } from '../runtime/registry.js';
import { R8, R16, R32, W8, W16 } from '../runtime/mem.js';
import { selBase, SEL_CODE, SEL_DATA } from '../platform/dpmi.js';

register(0x1eda6, 'dws_Kill_1eda6', function dws_Kill() {
  // 1eda6..1eda7: push ds; push eax
  // UNCERTAIN: the caller's DS is the extender-chosen data selector; the port uses SEL_DATA from
  // platform/dpmi.js (same approach as dwt_Kill / Keyboard_Install_Driver).
  let ds = SEL_DATA;
  const csBase = selBase(SEL_CODE);
  let skipStore = false;
  if (R16(csBase + 0x30c61) !== 0) {                  // 1eda8: cmp word cs:[0x30c61], 0; je 1edca
    if (R16(csBase + 0x30c61) === ds) {               // 1edb3..1edbe: mov ax, ds; cmp cs:[0x30c61], ax; je 1edec
      skipStore = true;
    } else {
      ds = R16(csBase + 0x30c61);                     // 1edc0: mov ds, cs:[0x30c61]
      // 1edc8: je 1edec — MOV does not change flags; ZF is still clear from the cmp at 1edb6, so this
      // branch is never taken and execution falls through to 1edca.
    }
  }
  // UNCERTAIN: after a real DS reload the callees would run with the reloaded DS; the port cannot pass a
  // segment register to them (only reachable if 0x30c61 holds a selector other than SEL_DATA).
  const dsBase = selBase(ds);
  if (!skipStore) {
    W16(dsBase + 0x30c61, ds);                        // 1edca: mov word ds:[0x30c61], ds
    // 1edd1..1eddd: mov eax, cs:[0x31088]; cmp eax, ds:[0x31088]; je 1edec
    if (R32(csBase + 0x31088) !== R32(dsBase + 0x31088)) {
      // 1eddf: pop eax
      F.sub_1e3ba(0x29a);                             // 1ede0..1ede5: mov eax, 0x29a; call 0x1e3ba
      return;                                         // 1edea: jmp 1ee2e -> pop ds; ret
    }
  }
  // 1edec: pop eax; 1eded: xor eax, eax
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) + 1) & 0xff); // 1edef: inc byte [0x31086]
  if (R8(dsBase + 0x31086) === 1) {                   // 1edf5: cmp byte [0x31086], 1; jne 1ee30
    const r = F.sub_1e8d1();                          // 1edfe: call 0x1e8d1
    if (r !== 0) {                                    // 1ee03: cmp eax, 0; je 1ee23
      const res = F.sub_1e309(4);                     // 1ee08..1ee0a: push 4; call 0x1e309 (callee pops it)
      // 1ee0f: and eax, 0xffff; 1ee14: call 0x1e3c0 (EAX in, EAX out)
      if (F.sub_1e3c0(res & 0xffff) !== 0) {          // 1ee19: cmp eax, 0; je 1ee23
        F.sub_1e971();                                // 1ee1e: call 0x1e971
      }
    }
    F.sub_1e971();                                    // 1ee23: call 0x1e971
  } else {
    F.sub_1e3ba(0x13);                                // 1ee30..1ee35: mov eax, 0x13; call 0x1e3ba; jmp 1ee28
  }
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) - 1) & 0xff); // 1ee28: dec byte [0x31086]
  // 1ee2e..1ee2f: pop ds; ret
});
