// 0x1fa16  void dws_DUnPause(void)   [no args; no stack frame (no push ebp); DS saved/restored; EAX NOT preserved]
// DiamondWare STK client wrapper for STK function 0x11 (dws_DUnPause, LIBRARY.md): resumes digitized sound
// in the STKRUN TSR. The INT to the TSR is issued inside 0x1e309 (called here with fn = 0x11), not in this
// function.
// Same frame as dws_Kill (1eda6_dws_Kill.js) / dwt_Kill (1ffe0_dwt_Kill.js), with these differences tied to
// instructions:
//   - driver function number 0x11 (1fa78: push 0x11; 1fa7a: call 0x1e309, callee pops it).
//   - 0x1e3c0's result is not tested (1fa84: call 0x1e3c0 is followed directly by 1fa89: call 0x1e971), so
//     there is only ONE 0x1e971 call on the counter==1 path (unlike dws_Kill's two).
//   - 0x1e3c0 (ported, src/lib/1e3c0_sub_1e3c0.js) stores the STK error code at 0x30c7f when its EAX
//     argument is 0 and returns EAX unchanged.
// Return value: signatures.json returns=false; both callers (0x10bfa in 0x10b7d, 0x10c9b in 0x10c0b) call
// 0x1fec3 right after without reading EAX, and EAX is not deliberately set before RET (leftover of 0x1e971 /
// 0x1e3ba) -> nothing is returned.
// Callee keys: 0x1e8d1 / 0x1e971 / 0x1e309 / 0x1e3c0 / 0x1e3ba are not named in re/names.tsv -> sub_<addr>.
import { F, register } from '../runtime/registry.js';
import { R8, R16, R32, W8, W16 } from '../runtime/mem.js';
import { selBase, SEL_CODE, SEL_DATA } from '../platform/dpmi.js';

register(0x1fa16, 'dws_DUnPause_1fa16', function dws_DUnPause() {
  // 1fa16..1fa17: push ds; push eax
  // UNCERTAIN: the caller's DS is the extender-chosen data selector; the port uses SEL_DATA from
  // platform/dpmi.js (same approach as dws_Kill / dwt_Kill).
  let ds = SEL_DATA;
  const csBase = selBase(SEL_CODE);
  let skipStore = false;
  if (R16(csBase + 0x30c61) !== 0) {                  // 1fa18: cmp word cs:[0x30c61], 0; je 1fa3a
    if (R16(csBase + 0x30c61) === ds) {               // 1fa23..1fa2e: mov ax, ds; cmp cs:[0x30c61], ax; je 1fa5c
      skipStore = true;
    } else {
      ds = R16(csBase + 0x30c61);                     // 1fa30: mov ds, cs:[0x30c61]
      // 1fa38: je 1fa5c — MOV does not change flags; ZF is still clear from the cmp at 1fa26, so this
      // branch is never taken and execution falls through to 1fa3a.
    }
  }
  // UNCERTAIN: after a real DS reload the callees would run with the reloaded DS; the port cannot pass a
  // segment register to them (only reachable if 0x30c61 holds a selector other than SEL_DATA).
  const dsBase = selBase(ds);
  if (!skipStore) {
    W16(dsBase + 0x30c61, ds);                        // 1fa3a: mov word ds:[0x30c61], ds
    // 1fa41..1fa4d: mov eax, cs:[0x31088]; cmp eax, ds:[0x31088]; je 1fa5c
    if (R32(csBase + 0x31088) !== R32(dsBase + 0x31088)) {
      // 1fa4f: pop eax
      F.sub_1e3ba(0x29a);                             // 1fa50..1fa55: mov eax, 0x29a; call 0x1e3ba
      return;                                         // 1fa5a: jmp 1fa94 -> pop ds; ret
    }
  }
  // 1fa5c: pop eax; 1fa5d: xor eax, eax
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) + 1) & 0xff); // 1fa5f: inc byte [0x31086]
  if (R8(dsBase + 0x31086) === 1) {                   // 1fa65: cmp byte [0x31086], 1; jne 1fa96
    if (F.sub_1e8d1() !== 0) {                        // 1fa6e..1fa76: call 0x1e8d1; cmp eax, 0; je 1fa89
      const res = F.sub_1e309(0x11);                  // 1fa78..1fa7a: push 0x11; call 0x1e309 (callee pops it)
      F.sub_1e3c0(res & 0xffff);                      // 1fa7f: and eax, 0xffff; 1fa84: call 0x1e3c0
    }
    F.sub_1e971();                                    // 1fa89: call 0x1e971
  } else {
    F.sub_1e3ba(0x13);                                // 1fa96..1fa9b: mov eax, 0x13; call 0x1e3ba; jmp 1fa8e
  }
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) - 1) & 0xff); // 1fa8e: dec byte [0x31086]
  // 1fa94..1fa95: pop ds; ret
});
