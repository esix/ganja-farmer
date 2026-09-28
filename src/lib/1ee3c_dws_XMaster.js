// 0x1ee3c  void dws_XMaster(int vol)   [cdecl, 1 stack arg (full dword passed on); no return value]
// DiamondWare STK client wrapper for STK function 5 (dws_XMaster, LIBRARY.md: master volume). Only caller
// 0x110db passes the word [0x60f12] zero-extended and does not read EAX afterwards (0x110e0: add esp, 4;
// 0x110e3: mov eax, 0x60f14), so the EAX left by 0x1e971 / 0x1e3ba is not returned.
// Same frame as dwt_Init (1ff4f) / dwt_Kill (1ffe0), except that EAX is NOT saved around the call here
// (push ds; push eax only — the inner EAX copy is popped at 1ee78 / 1ee85 before EAX is reused).
//   DS check on 0x30c61 + magic dword 0x31088 (error 0x29a via 0x1e3ba, return).
//   inc byte [0x31086]; if it is 1: 0x1e8d1 (session open); if EAX != 0: 0x1e342(vol, 5) = STK fn 5 with
//   one word argument, its result masked to 16 bits is passed in EAX to 0x1e3c0; then 0x1e971 (session close)
//   always. Otherwise error 0x13 via 0x1e3ba. dec byte [0x31086].
// Callee keys: 0x1e8d1 / 0x1e971 / 0x1e342 / 0x1e3ba / 0x1e3c0 are not named in re/names.tsv -> sub_<addr>.
// 0x1e3c0 (src/lib/1e3c0_sub_1e3c0.js): per its disassembly, if EAX == 0 it calls 0x1e309(0) and stores the masked result
// to dword [0x30c7f]; EAX is preserved.
import { F, register } from '../runtime/registry.js';
import { R8, R16, R32, W8, W16 } from '../runtime/mem.js';
import { selBase, SEL_CODE, SEL_DATA } from '../platform/dpmi.js';

register(0x1ee3c, 'dws_XMaster_1ee3c', function dws_XMaster(vol) {
  // 1ee3c..1ee40: push ebp; mov ebp, esp; push ds; push eax
  // UNCERTAIN: the caller's DS is the extender-chosen data selector; the port uses SEL_DATA from
  // platform/dpmi.js (same approach as dwt_Init / dwt_Kill).
  let ds = SEL_DATA;
  const csBase = selBase(SEL_CODE);
  let skipStore = false;
  if (R16(csBase + 0x30c61) !== 0) {                  // 1ee41: cmp word cs:[0x30c61], 0; je 1ee63
    if (R16(csBase + 0x30c61) === ds) {               // 1ee4c..1ee57: mov ax, ds; cmp cs:[0x30c61], ax; je 1ee85
      skipStore = true;
    } else {
      ds = R16(csBase + 0x30c61);                     // 1ee59: mov ds, cs:[0x30c61]
      // 1ee61: je 1ee85 — MOV does not change flags; ZF is still clear from the cmp at 1ee4f, so this
      // branch is never taken and execution falls through to 1ee63.
    }
  }
  // UNCERTAIN: after a real DS reload the callees would run with the reloaded DS; the port cannot pass a
  // segment register to them (only reachable if 0x30c61 holds a selector other than SEL_DATA).
  const dsBase = selBase(ds);
  if (!skipStore) {
    W16(dsBase + 0x30c61, ds);                        // 1ee63: mov word ds:[0x30c61], ds
    // 1ee6a..1ee76: mov eax, cs:[0x31088]; cmp eax, ds:[0x31088]; je 1ee85
    if (R32(csBase + 0x31088) !== R32(dsBase + 0x31088)) {
      // 1ee78: pop eax
      F.sub_1e3ba(0x29a);                             // 1ee79..1ee7e: mov eax, 0x29a; call 0x1e3ba
      return;                                         // 1ee83: jmp 1eec1 -> pop ds; leave; ret
    }
  }
  // 1ee85: pop eax; 1ee86: xor eax, eax
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) + 1) & 0xff); // 1ee88: inc byte [0x31086]
  if (R8(dsBase + 0x31086) === 1) {                   // 1ee8e: cmp byte [0x31086], 1; jne 1eec4
    if (F.sub_1e8d1() !== 0) {                        // 1ee97..1ee9f: call 0x1e8d1; cmp eax, 0; je 1eeb6
      // 1eea1..1eea7: push 5; mov eax, [ebp+8]; push eax; call 0x1e342 (callee pops 8)
      const r = F.sub_1e342(vol, 5);
      F.sub_1e3c0(r & 0xffff);                        // 1eeac..1eeb1: and eax, 0xffff; call 0x1e3c0
    }
    F.sub_1e971();                                    // 1eeb6: call 0x1e971
  } else {
    F.sub_1e3ba(0x13);                                // 1eec4..1eec9: mov eax, 0x13; call 0x1e3ba; jmp 1eebb
  }
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) - 1) & 0xff); // 1eebb: dec byte [0x31086]
  // 1eec1..1eec3: pop ds; leave; ret
});
