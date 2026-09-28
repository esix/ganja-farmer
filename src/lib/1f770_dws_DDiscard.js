// 0x1f770  void dws_DDiscard(int snd)   [cdecl, 1 stack arg (full dword passed on); no return value]
// DiamondWare STK client wrapper for STK function 0xd (dws_DDiscard, LIBRARY.md). Callers push a zero-extended
// word (e.g. 0x1954a: xor eax,eax; mov ax,[0x613aa]; push eax). Same frame as dwt_Init 0x1ff4f / dwt_Kill 0x1ffe0
// and identical in shape to dws_DSetRate 0x1f3c3, with these facts tied to instructions:
//   - Prologue is push ebp; mov ebp, esp; push ds; push eax (1f770..1f774): there is NO outer push eax, so
//     EAX is not preserved. The pushed EAX is only the scratch copy popped at 1f7ac / 1f7b9.
//   - Driver call: 0x1e342(snd, 0xd) (1f7d5..1f7db), then its result & 0xffff is passed in EAX to 0x1e3c0
//     (1f7e0..1f7e5).
//   - Only one 0x1e971 call on the counter==1 path (1f7ea), no extra 0x1e8d1.
//   - This function does NOT touch the DWD-copy tables at 0x30c95.. (no table access between 1f770 and the
//     ret at 1f7f7; the table-freeing wrapper is the next function, 0x1f804).
// EAX on return is a leftover (0x1e3c0's / 0x1e8d1's / 0x1e3ba's EAX through 0x1e971); none of the 70 callers
// reads it: every call is followed by `add esp, 4` and then an instruction that does not read EAX (EAX
// loads, xor, cmp of memory, stores, or `call 0x232c7` rand which takes no args), matching signatures.json
// returns=false -> nothing returned.
// Callee keys: 0x1e8d1 / 0x1e971 / 0x1e342 / 0x1e3ba / 0x1e3c0 are not named in re/names.tsv -> sub_<addr>.
import { F, register } from '../runtime/registry.js';
import { R8, R16, R32, W8, W16 } from '../runtime/mem.js';
import { selBase, SEL_CODE, SEL_DATA } from '../platform/dpmi.js';

register(0x1f770, 'dws_DDiscard_1f770', function dws_DDiscard(snd) {
  // 1f770..1f774: push ebp; mov ebp, esp; push ds; push eax
  // UNCERTAIN: the caller's DS is the extender-chosen data selector; the port uses SEL_DATA from
  // platform/dpmi.js (same approach as dwt_Init / dwt_Kill).
  let ds = SEL_DATA;
  const csBase = selBase(SEL_CODE);
  let skipStore = false;
  if (R16(csBase + 0x30c61) !== 0) {                  // 1f775: cmp word cs:[0x30c61], 0; je 1f797
    if (R16(csBase + 0x30c61) === ds) {               // 1f780..1f78b: mov ax, ds; cmp cs:[0x30c61], ax; je 1f7b9
      skipStore = true;
    } else {
      ds = R16(csBase + 0x30c61);                     // 1f78d: mov ds, cs:[0x30c61]
      // 1f795: je 1f7b9 — MOV does not change flags; ZF is still clear from the cmp at 1f783, never taken.
    }
  }
  // UNCERTAIN: after a real DS reload the callees would run with the reloaded DS; the port cannot pass a
  // segment register to them (only reachable if 0x30c61 holds a selector other than SEL_DATA).
  const dsBase = selBase(ds);
  if (!skipStore) {
    W16(dsBase + 0x30c61, ds);                        // 1f797: mov word ds:[0x30c61], ds
    // 1f79e..1f7aa: mov eax, cs:[0x31088]; cmp eax, ds:[0x31088]; je 1f7b9
    if (R32(csBase + 0x31088) !== R32(dsBase + 0x31088)) {
      // 1f7ac: pop eax
      F.sub_1e3ba(0x29a);                             // 1f7ad..1f7b2: mov eax, 0x29a; call 0x1e3ba
      return;                                         // 1f7b7: jmp 1f7f5 -> pop ds; leave; ret
    }
  }
  // 1f7b9: pop eax; 1f7ba: xor eax, eax
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) + 1) & 0xff); // 1f7bc: inc byte [0x31086]
  if (R8(dsBase + 0x31086) === 1) {                   // 1f7c2: cmp byte [0x31086], 1; jne 1f7f8
    if (F.sub_1e8d1() !== 0) {                        // 1f7cb..1f7d3: call 0x1e8d1; cmp eax, 0; je 1f7ea
      // 1f7d5..1f7db: push 0xd; mov eax, [ebp+8]; push eax; call 0x1e342 (callee pops 8)
      const r = F.sub_1e342(snd, 0xd);
      F.sub_1e3c0(r & 0xffff);                        // 1f7e0..1f7e5: and eax, 0xffff; call 0x1e3c0
    }
    F.sub_1e971();                                    // 1f7ea: call 0x1e971
  } else {
    F.sub_1e3ba(0x13);                                // 1f7f8..1f7fd: mov eax, 0x13; call 0x1e3ba; jmp 1f7ef
  }
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) - 1) & 0xff); // 1f7ef: dec byte [0x31086]
  // 1f7f5..1f7f7: pop ds; leave; ret
});
