// 0x1fe37  void dws_MPause(void)   [no args; no stack frame (no push ebp); DS saved/restored; EAX NOT preserved]
// DiamondWare STK client wrapper for STK function 0x15 (dws_MPause, LIBRARY.md): pauses music playback in the
// STKRUN TSR. The INT to the TSR is issued inside 0x1e309 (called here with fn = 0x15), not in this function.
// Same frame as dws_Kill 0x1eda6 / dwt_Kill 0x1ffe0 (see their headers), with these differences tied to
// instructions:
//   - only `push ds; push eax` on entry (1fe37/1fe38), no push ebp and no outer push eax: the inner EAX copy is
//     popped at 1fe70/1fe7d before EAX is reused, so EAX on return is a leftover (0x1e971's or 0x1e3ba's).
//   - driver call 0x1e309(0x15) (1fe99..1fe9b, callee pops), result & 0xffff passed in EAX to 0x1e3c0
//     (1fea0..1fea5). Unlike dws_Kill, 0x1e3c0's result is not tested: 0x1e971 is called exactly once
//     (1feaa), on both the enter-ok and enter-failed paths.
// Return value: signatures.json returns=false; both callers (0x10b9a in 0x10b7d, 0x10c28 in 0x10c0b) go
// straight on to Print_String argument setup and ignore EAX -> nothing is returned.
// Callee keys: 0x1e8d1 / 0x1e971 / 0x1e309 / 0x1e3c0 / 0x1e3ba are not named in re/names.tsv -> sub_<addr>.
import { F, register } from '../runtime/registry.js';
import { R8, R16, R32, W8, W16 } from '../runtime/mem.js';
import { selBase, SEL_CODE, SEL_DATA } from '../platform/dpmi.js';

register(0x1fe37, 'dws_MPause_1fe37', function dws_MPause() {
  // 1fe37..1fe38: push ds; push eax
  // UNCERTAIN: the caller's DS is the extender-chosen data selector; the port uses SEL_DATA from
  // platform/dpmi.js (same approach as dwt_Kill / dws_Kill).
  let ds = SEL_DATA;
  const csBase = selBase(SEL_CODE);
  let skipStore = false;
  if (R16(csBase + 0x30c61) !== 0) {                  // 1fe39: cmp word cs:[0x30c61], 0; je 1fe5b
    if (R16(csBase + 0x30c61) === ds) {               // 1fe44..1fe4f: mov ax, ds; cmp cs:[0x30c61], ax; je 1fe7d
      skipStore = true;
    } else {
      ds = R16(csBase + 0x30c61);                     // 1fe51: mov ds, cs:[0x30c61]
      // 1fe59: je 1fe7d — MOV does not change flags; ZF is still clear from the cmp at 1fe47, so this
      // branch is never taken and execution falls through to 1fe5b.
    }
  }
  // UNCERTAIN: after a real DS reload the callees would run with the reloaded DS; the port cannot pass a
  // segment register to them (only reachable if 0x30c61 holds a selector other than SEL_DATA).
  const dsBase = selBase(ds);
  if (!skipStore) {
    W16(dsBase + 0x30c61, ds);                        // 1fe5b: mov word ds:[0x30c61], ds
    // 1fe62..1fe6e: mov eax, cs:[0x31088]; cmp eax, ds:[0x31088]; je 1fe7d
    if (R32(csBase + 0x31088) !== R32(dsBase + 0x31088)) {
      // 1fe70: pop eax
      F.sub_1e3ba(0x29a);                             // 1fe71..1fe76: mov eax, 0x29a; call 0x1e3ba
      return;                                         // 1fe7b: jmp 1feb5 -> pop ds; ret
    }
  }
  // 1fe7d: pop eax; 1fe7e: xor eax, eax
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) + 1) & 0xff); // 1fe80: inc byte [0x31086]
  if (R8(dsBase + 0x31086) === 1) {                   // 1fe86: cmp byte [0x31086], 1; jne 1feb7
    if (F.sub_1e8d1() !== 0) {                        // 1fe8f..1fe97: call 0x1e8d1; cmp eax, 0; je 1feaa
      const res = F.sub_1e309(0x15);                  // 1fe99..1fe9b: push 0x15; call 0x1e309 (callee pops it)
      F.sub_1e3c0(res & 0xffff);                      // 1fea0..1fea5: and eax, 0xffff; call 0x1e3c0
    }
    F.sub_1e971();                                    // 1feaa: call 0x1e971
  } else {
    F.sub_1e3ba(0x13);                                // 1feb7..1febc: mov eax, 0x13; call 0x1e3ba; jmp 1feaf
  }
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) - 1) & 0xff); // 1feaf: dec byte [0x31086]
  // 1feb5..1feb6: pop ds; ret
});
