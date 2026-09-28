// 0x1fec3  void dws_MUnPause(void)   [no args; no stack frame (no push ebp); DS saved/restored; EAX NOT preserved]
// DiamondWare STK client wrapper for STK function 0x16 (dws_MUnPause, LIBRARY.md): resumes music in the STKRUN
// TSR. The INT to the TSR is issued inside 0x1e309 (called here with fn = 0x16), not in this function.
// Same frame as dws_Kill 0x1eda6 (1eda6_dws_Kill.js), with these differences tied to instructions:
//   - driver call is 0x1e309(0x16) (1ff25..1ff27: push 0x16; call 0x1e309, callee pops it); its result & 0xffff
//     is passed in EAX to 0x1e3c0 (1ff2c..1ff31), whose return value is NOT tested (unlike dws_Kill).
//   - only one 0x1e971 call on the counter==1 path (1ff36), as in dws_DSetRate 0x1f3c3.
// Return value: signatures.json returns=false; both callers (0x10bff, 0x10ca0) are followed directly by
// pop ebp/edi/esi of void functions, and EAX is not deliberately set before RET -> nothing is returned.
// Callee keys: 0x1e8d1 / 0x1e971 / 0x1e309 / 0x1e3c0 / 0x1e3ba are not named in re/names.tsv -> sub_<addr>.
import { F, register } from '../runtime/registry.js';
import { R8, R16, R32, W8, W16 } from '../runtime/mem.js';
import { selBase, SEL_CODE, SEL_DATA } from '../platform/dpmi.js';

register(0x1fec3, 'dws_MUnPause_1fec3', function dws_MUnPause() {
  // 1fec3..1fec4: push ds; push eax
  // UNCERTAIN: the caller's DS is the extender-chosen data selector; the port uses SEL_DATA from
  // platform/dpmi.js (same approach as dwt_Kill / dws_Kill).
  let ds = SEL_DATA;
  const csBase = selBase(SEL_CODE);
  let skipStore = false;
  if (R16(csBase + 0x30c61) !== 0) {                  // 1fec5: cmp word cs:[0x30c61], 0; je 1fee7
    if (R16(csBase + 0x30c61) === ds) {               // 1fed0..1fedb: mov ax, ds; cmp cs:[0x30c61], ax; je 1ff09
      skipStore = true;
    } else {
      ds = R16(csBase + 0x30c61);                     // 1fedd: mov ds, cs:[0x30c61]
      // 1fee5: je 1ff09 — MOV does not change flags; ZF is still clear from the cmp at 1fed3, never taken.
    }
  }
  // UNCERTAIN: after a real DS reload the callees would run with the reloaded DS; the port cannot pass a
  // segment register to them (only reachable if 0x30c61 holds a selector other than SEL_DATA).
  const dsBase = selBase(ds);
  if (!skipStore) {
    W16(dsBase + 0x30c61, ds);                        // 1fee7: mov word ds:[0x30c61], ds
    // 1feee..1fefa: mov eax, cs:[0x31088]; cmp eax, ds:[0x31088]; je 1ff09
    if (R32(csBase + 0x31088) !== R32(dsBase + 0x31088)) {
      // 1fefc: pop eax
      F.sub_1e3ba(0x29a);                             // 1fefd..1ff02: mov eax, 0x29a; call 0x1e3ba
      return;                                         // 1ff07: jmp 1ff41 -> pop ds; ret
    }
  }
  // 1ff09: pop eax; 1ff0a: xor eax, eax
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) + 1) & 0xff); // 1ff0c: inc byte [0x31086]
  if (R8(dsBase + 0x31086) === 1) {                   // 1ff12: cmp byte [0x31086], 1; jne 1ff43
    if (F.sub_1e8d1() !== 0) {                        // 1ff1b..1ff23: call 0x1e8d1; cmp eax, 0; je 1ff36
      const r = F.sub_1e309(0x16);                    // 1ff25..1ff27: push 0x16; call 0x1e309 (callee pops it)
      F.sub_1e3c0(r & 0xffff);                        // 1ff2c..1ff31: and eax, 0xffff; call 0x1e3c0
    }
    F.sub_1e971();                                    // 1ff36: call 0x1e971
  } else {
    F.sub_1e3ba(0x13);                                // 1ff43..1ff48: mov eax, 0x13; call 0x1e3ba; jmp 1ff3b
  }
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) - 1) & 0xff); // 1ff3b: dec byte [0x31086]
  // 1ff41..1ff42: pop ds; ret
});
