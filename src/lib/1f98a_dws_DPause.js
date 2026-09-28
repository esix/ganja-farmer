// 0x1f98a  void dws_DPause(void)   [no args; no stack frame (no push ebp); DS saved/restored; EAX NOT preserved]
// DiamondWare STK client wrapper for STK function 0x10 (dws_DPause, LIBRARY.md). The INT to the TSR is
// issued inside 0x1e309 (called here with fn = 0x10), not in this function.
// Same frame as dws_Kill 0x1eda6 (1eda6_dws_Kill.js) / dwt_Kill 0x1ffe0, with these differences, each tied to
// an instruction:
//   - Driver call: 0x1e309(0x10) (1f9ec: push 0x10; 1f9ee: call 0x1e309 — callee pops it), then its
//     result & 0xffff is passed in EAX to 0x1e3c0 (1f9f3..1f9f8). 0x1e3c0's result is NOT tested: execution
//     falls through to the single 0x1e971 call at 1f9fd (unlike dws_Kill, which has a second, conditional one).
// Return value: signatures.json returns=false; both callers (0x10b95 in 0x10b7d, 0x10c23 in 0x10c0b) are
// followed directly by call 0x1fe37 (dws_MPause, which saves EAX (push eax) and overwrites it without ever using the saved value), and EAX is
// not deliberately set before RET (leftover of 0x1e971 / 0x1e3ba) -> nothing is returned.
// Callee keys: 0x1e8d1 / 0x1e971 / 0x1e309 / 0x1e3c0 / 0x1e3ba are not named in re/names.tsv -> sub_<addr>.
import { F, register } from '../runtime/registry.js';
import { R8, R16, R32, W8, W16 } from '../runtime/mem.js';
import { selBase, SEL_CODE, SEL_DATA } from '../platform/dpmi.js';

register(0x1f98a, 'dws_DPause_1f98a', function dws_DPause() {
  // 1f98a..1f98b: push ds; push eax
  // UNCERTAIN: the caller's DS is the extender-chosen data selector; the port uses SEL_DATA from
  // platform/dpmi.js (same approach as dws_Kill / dwt_Kill).
  let ds = SEL_DATA;
  const csBase = selBase(SEL_CODE);
  let skipStore = false;
  if (R16(csBase + 0x30c61) !== 0) {                  // 1f98c: cmp word cs:[0x30c61], 0; je 1f9ae
    if (R16(csBase + 0x30c61) === ds) {               // 1f997..1f9a2: mov ax, ds; cmp cs:[0x30c61], ax; je 1f9d0
      skipStore = true;
    } else {
      ds = R16(csBase + 0x30c61);                     // 1f9a4: mov ds, cs:[0x30c61]
      // 1f9ac: je 1f9d0 — MOV does not change flags; ZF is still clear from the cmp at 1f99a, never taken.
    }
  }
  // UNCERTAIN: after a real DS reload the callees would run with the reloaded DS; the port cannot pass a
  // segment register to them (only reachable if 0x30c61 holds a selector other than SEL_DATA).
  const dsBase = selBase(ds);
  if (!skipStore) {
    W16(dsBase + 0x30c61, ds);                        // 1f9ae: mov word ds:[0x30c61], ds
    // 1f9b5..1f9c1: mov eax, cs:[0x31088]; cmp eax, ds:[0x31088]; je 1f9d0
    if (R32(csBase + 0x31088) !== R32(dsBase + 0x31088)) {
      // 1f9c3: pop eax
      F.sub_1e3ba(0x29a);                             // 1f9c4..1f9c9: mov eax, 0x29a; call 0x1e3ba
      return;                                         // 1f9ce: jmp 1fa08 -> pop ds; ret
    }
  }
  // 1f9d0: pop eax; 1f9d1: xor eax, eax
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) + 1) & 0xff); // 1f9d3: inc byte [0x31086]
  if (R8(dsBase + 0x31086) === 1) {                   // 1f9d9: cmp byte [0x31086], 1; jne 1fa0a
    if (F.sub_1e8d1() !== 0) {                        // 1f9e2..1f9ea: call 0x1e8d1; cmp eax, 0; je 1f9fd
      const r = F.sub_1e309(0x10);                    // 1f9ec..1f9ee: push 0x10; call 0x1e309 (callee pops it)
      F.sub_1e3c0(r & 0xffff);                        // 1f9f3..1f9f8: and eax, 0xffff; call 0x1e3c0
    }
    F.sub_1e971();                                    // 1f9fd: call 0x1e971
  } else {
    F.sub_1e3ba(0x13);                                // 1fa0a..1fa0f: mov eax, 0x13; call 0x1e3ba; jmp 1fa02
  }
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) - 1) & 0xff); // 1fa02: dec byte [0x31086]
  // 1fa08..1fa09: pop ds; ret
});
