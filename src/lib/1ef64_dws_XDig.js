// 0x1ef64  void dws_XDig(int vol)   [cdecl, 1 stack arg (full dword passed on); no result read by the caller]
// DiamondWare STK client wrapper for STK function 7 (dws_XDig, LIBRARY.md: digital-sound volume, "F/X" slider).
// Only caller: 0x110b9 (push zero-extended word [0x60f0e]; call; add esp, 4 — EAX not read afterwards).
// Same frame as dwt_Kill (0x1ffe0) / dwt_Init (0x1ff4f), with these differences tied to instructions:
//   - prologue is push ebp; mov ebp, esp; push ds; push eax (no outer push eax): EAX is NOT preserved.
//     The final EAX is a leftover (0x1e971's result, or 0x29a / 0x13 after 0x1e3ba), so nothing is returned.
//   - the driver call result is passed on: 0x1e342(vol, 7) -> and eax, 0xffff -> call 0x1e3c0 (EAX arg).
// DS check: 0x30c61 holds the data selector. If 0 -> store DS there, then magic check (dword 0x31088 through
// CS vs through DS; mismatch -> error 0x29a via 0x1e3ba, return). If it equals DS -> skip store and check.
// Re-entry byte counter 0x31086 (LIBRARY.md): only when it becomes 1 does the session open 0x1e8d1 / close
// 0x1e971 run; otherwise error 0x13 via 0x1e3ba.
// Callee keys: 0x1e8d1 / 0x1e971 / 0x1e342 / 0x1e3ba / 0x1e3c0 are not named in re/names.tsv -> sub_<addr>.
import { F, register } from '../runtime/registry.js';
import { R8, R16, R32, W8, W16 } from '../runtime/mem.js';
import { selBase, SEL_CODE, SEL_DATA } from '../platform/dpmi.js';

register(0x1ef64, 'dws_XDig_1ef64', function dws_XDig(vol) {
  // 1ef64..1ef68: push ebp; mov ebp, esp; push ds; push eax
  // UNCERTAIN: the caller's DS is the extender-chosen data selector; the port uses SEL_DATA from
  // platform/dpmi.js (same approach as dwt_Kill 0x1ffe0 / dwt_Init 0x1ff4f).
  let ds = SEL_DATA;
  const csBase = selBase(SEL_CODE);
  let skipStore = false;
  if (R16(csBase + 0x30c61) !== 0) {                  // 1ef69: cmp word cs:[0x30c61], 0; je 1ef8b
    if (R16(csBase + 0x30c61) === ds) {               // 1ef74..1ef7f: mov ax, ds; cmp cs:[0x30c61], ax; je 1efad
      skipStore = true;
    } else {
      ds = R16(csBase + 0x30c61);                     // 1ef81: mov ds, cs:[0x30c61]
      // 1ef89: je 1efad — MOV does not change flags; ZF is still clear from the cmp at 1ef77, so this
      // branch is never taken and execution falls through to 1ef8b.
    }
  }
  // UNCERTAIN: after a real DS reload the callees would run with the reloaded DS; the port cannot pass a
  // segment register to them (only reachable if 0x30c61 holds a selector other than SEL_DATA).
  const dsBase = selBase(ds);
  if (!skipStore) {
    W16(dsBase + 0x30c61, ds);                        // 1ef8b: mov word ds:[0x30c61], ds
    // 1ef92..1ef9e: mov eax, cs:[0x31088]; cmp eax, ds:[0x31088]; je 1efad
    if (R32(csBase + 0x31088) !== R32(dsBase + 0x31088)) {
      // 1efa0: pop eax
      F.sub_1e3ba(0x29a);                             // 1efa1..1efa6: mov eax, 0x29a; call 0x1e3ba
      return;                                         // 1efab: jmp 1efe9 -> pop ds; leave; ret
    }
  }
  // 1efad: pop eax; 1efae: xor eax, eax
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) + 1) & 0xff); // 1efb0: inc byte [0x31086]
  if (R8(dsBase + 0x31086) === 1) {                   // 1efb6: cmp byte [0x31086], 1; jne 1efec
    const r = F.sub_1e8d1();                          // 1efbf: call 0x1e8d1
    if (r !== 0) {                                    // 1efc4: cmp eax, 0; je 1efde
      // 1efc9..1efcf: push 7; mov eax, [ebp+8]; push eax; call 0x1e342 (callee pops 8)
      const v = F.sub_1e342(vol, 7);
      F.sub_1e3c0(v & 0xffff);                        // 1efd4..1efd9: and eax, 0xffff; call 0x1e3c0 (result not read)
    }
    F.sub_1e971();                                    // 1efde: call 0x1e971
  } else {
    F.sub_1e3ba(0x13);                                // 1efec..1eff1: mov eax, 0x13; call 0x1e3ba; jmp 1efe3
  }
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) - 1) & 0xff); // 1efe3: dec byte [0x31086]
  // 1efe9..1efeb: pop ds; leave; ret
});
