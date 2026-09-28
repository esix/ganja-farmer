// 0x1f3c3  void dws_DSetRate(int rate)   [cdecl, 1 stack arg (full dword passed on); no return value]
// DiamondWare STK client wrapper for STK function 0xa (dws_DSetRate, LIBRARY.md). Callers (0x1155a dead code,
// 0x1c097, 0x23514) push a zero-extended word (0x61044 / a local filled by dws_DGetRateFromDWD 0x1f5b3).
// Same frame as dwt_Init 0x1ff4f / dwt_Kill 0x1ffe0 (see their headers), with these differences, each tied
// to an instruction:
//   - Prologue is push ebp; mov ebp, esp; push ds; push eax (1f3c3..1f3c7): there is NO outer push eax, so
//     EAX is not preserved. The pushed EAX is only the scratch copy popped at 1f3ff / 1f40c.
//   - Driver call: 0x1e342(rate, 0xa) (1f428..1f42e), then its result & 0xffff is passed in EAX to 0x1e3c0
//     (1f433..1f438). 0x1e3c0 (ported, src/lib/1e3c0_sub_1e3c0.js): if EAX == 0 it calls 0x1e309(0) and stores the result &
//     0xffff into the error dword 0x30c7f; EAX is preserved (push/pop eax).
//   - Only one 0x1e971 call on the counter==1 path (1f43d), no extra 0x1e8d1.
// EAX on return is a leftover (0x1e971's / 0x1e3ba's EAX); none of the three callers reads it (each is
// followed by add esp, 4 and an EAX load/lea), matching signatures.json returns=false -> nothing returned.
// Callee keys: 0x1e8d1 / 0x1e971 / 0x1e342 / 0x1e3ba / 0x1e3c0 are not named in re/names.tsv -> sub_<addr>.
import { F, register } from '../runtime/registry.js';
import { R8, R16, R32, W8, W16 } from '../runtime/mem.js';
import { selBase, SEL_CODE, SEL_DATA } from '../platform/dpmi.js';

register(0x1f3c3, 'dws_DSetRate_1f3c3', function dws_DSetRate(rate) {
  // 1f3c3..1f3c7: push ebp; mov ebp, esp; push ds; push eax
  // UNCERTAIN: the caller's DS is the extender-chosen data selector; the port uses SEL_DATA from
  // platform/dpmi.js (same approach as dwt_Init / dwt_Kill).
  let ds = SEL_DATA;
  const csBase = selBase(SEL_CODE);
  let skipStore = false;
  if (R16(csBase + 0x30c61) !== 0) {                  // 1f3c8: cmp word cs:[0x30c61], 0; je 1f3ea
    if (R16(csBase + 0x30c61) === ds) {               // 1f3d3..1f3de: mov ax, ds; cmp cs:[0x30c61], ax; je 1f40c
      skipStore = true;
    } else {
      ds = R16(csBase + 0x30c61);                     // 1f3e0: mov ds, cs:[0x30c61]
      // 1f3e8: je 1f40c — MOV does not change flags; ZF is still clear from the cmp at 1f3d6, never taken.
    }
  }
  // UNCERTAIN: after a real DS reload the callees would run with the reloaded DS; the port cannot pass a
  // segment register to them (only reachable if 0x30c61 holds a selector other than SEL_DATA).
  const dsBase = selBase(ds);
  if (!skipStore) {
    W16(dsBase + 0x30c61, ds);                        // 1f3ea: mov word ds:[0x30c61], ds
    // 1f3f1..1f3fd: mov eax, cs:[0x31088]; cmp eax, ds:[0x31088]; je 1f40c
    if (R32(csBase + 0x31088) !== R32(dsBase + 0x31088)) {
      // 1f3ff: pop eax
      F.sub_1e3ba(0x29a);                             // 1f400..1f405: mov eax, 0x29a; call 0x1e3ba
      return;                                         // 1f40a: jmp 1f448 -> pop ds; leave; ret
    }
  }
  // 1f40c: pop eax; 1f40d: xor eax, eax
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) + 1) & 0xff); // 1f40f: inc byte [0x31086]
  if (R8(dsBase + 0x31086) === 1) {                   // 1f415: cmp byte [0x31086], 1; jne 1f44b
    if (F.sub_1e8d1() !== 0) {                        // 1f41e..1f426: call 0x1e8d1; cmp eax, 0; je 1f43d
      // 1f428..1f42e: push 0xa; mov eax, [ebp+8]; push eax; call 0x1e342 (callee pops 8)
      const r = F.sub_1e342(rate, 0xa);
      F.sub_1e3c0(r & 0xffff);                        // 1f433..1f438: and eax, 0xffff; call 0x1e3c0
    }
    F.sub_1e971();                                    // 1f43d: call 0x1e971
  } else {
    F.sub_1e3ba(0x13);                                // 1f44b..1f450: mov eax, 0x13; call 0x1e3ba; jmp 1f442
  }
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) - 1) & 0xff); // 1f442: dec byte [0x31086]
  // 1f448..1f44a: pop ds; leave; ret
});
