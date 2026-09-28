// 0x1f348  void dws_DSoundStatus(soundnum, result)   [cdecl, 2 stack args (full dwords passed on); no result read]
// DiamondWare STK client wrapper for STK function 9 (dws_DSoundStatus, LIBRARY.md). The 32-bit client passes
// both arguments as dwords ([ebp+8], [ebp+0xc]); per LIBRARY.md they are the sound number and a pointer to the
// status word. This wrapper only forwards them unchanged to 0x1f1fb (which opens the session and makes the
// driver call itself); it does not call 0x1e8d1 / 0x1e971 / 0x1e3xx directly.
// Structure (0x1f34b..0x1f3c1): same DS / magic / re-entry frame as dwt_Init (0x1ff4f) and dwt_Kill (0x1ffe0):
//   push ds; push eax (one copy of EAX only, popped at 1f384 / 1f391).
//   DS check: word cs:[0x30c61] holds the data selector. If 0 -> store DS there, then the magic check.
//   If it equals DS -> skip both (je 1f391). Otherwise reload DS from it (the je at 1f36d is never taken:
//   MOV leaves ZF clear from the cmp at 1f35b), store it back, then the magic check: dword cs:[0x31088] must
//   equal ds:[0x31088], else error 0x29a via 0x1e3ba and return (counter untouched).
//   inc byte [0x31086]; if it is 1 -> 0x1f1fb(soundnum, result); else error 0x13 via 0x1e3ba. dec byte [0x31086].
// Return: EAX at RET is whatever 0x1f1fb (or 0x1e3ba) left; this function never sets it itself, and none of
// its 7 callers (0x110f2, 0x12ecc, 0x18edd, 0x191da, 0x19239, 0x1971d, 0x2353f) reads EAX after the call
// (each is followed by `add esp, 8`; EAX is never read — on some paths in 0x18a58/0x18f27 it passes up to
// their callers, which also do not read it (independent audit)) -> no return value.
// Callee keys: 0x1f1fb / 0x1e3ba are not named in re/names.tsv -> sub_<addr>.
import { F, register } from '../runtime/registry.js';
import { R8, R16, R32, W8, W16 } from '../runtime/mem.js';
import { selBase, SEL_CODE, SEL_DATA } from '../platform/dpmi.js';

register(0x1f348, 'dws_DSoundStatus_1f348', function dws_DSoundStatus(soundnum, result) {
  // 1f348..1f34c: push ebp; mov ebp, esp; push ds; push eax
  // UNCERTAIN: the caller's DS is the extender-chosen data selector; the port uses SEL_DATA from
  // platform/dpmi.js (same approach as dwt_Init / dwt_Kill).
  let ds = SEL_DATA;
  const csBase = selBase(SEL_CODE);
  let skipStore = false;
  if (R16(csBase + 0x30c61) !== 0) {                  // 1f34d: cmp word cs:[0x30c61], 0; je 1f36f
    if (R16(csBase + 0x30c61) === ds) {               // 1f358..1f363: mov ax, ds; cmp cs:[0x30c61], ax; je 1f391
      skipStore = true;
    } else {
      ds = R16(csBase + 0x30c61);                     // 1f365: mov ds, cs:[0x30c61]
      // 1f36d: je 1f391 — flags still from the cmp at 1f35b (not equal), never taken
    }
  }
  // UNCERTAIN: when DS was reloaded from 0x30c61 the callees below also run with that DS; the port cannot
  // pass a segment register to them (only reachable if 0x30c61 holds a selector other than SEL_DATA).
  const dsBase = selBase(ds);
  if (!skipStore) {
    W16(dsBase + 0x30c61, ds);                        // 1f36f: mov word ds:[0x30c61], ds
    // 1f376..1f382: mov eax, cs:[0x31088]; cmp eax, ds:[0x31088]; je 1f391
    if (R32(csBase + 0x31088) !== R32(dsBase + 0x31088)) {
      // 1f384: pop eax
      F.sub_1e3ba(0x29a);                             // 1f385..1f38a: mov eax, 0x29a; call 0x1e3ba
      return;                                         // 1f38f: jmp 1f3b4 -> pop ds; leave; ret
    }
  }
  // 1f391: pop eax; 1f392: xor eax, eax
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) + 1) & 0xff); // 1f394: inc byte [0x31086]
  if (R8(dsBase + 0x31086) === 1) {                   // 1f39a: cmp byte [0x31086], 1; jne 1f3b7
    // 1f3a3..1f3a9: push dword [ebp+0xc]; push dword [ebp+8]; call 0x1f1fb (callee pops 8: ret 8)
    F.sub_1f1fb(soundnum, result);
  } else {
    F.sub_1e3ba(0x13);                                // 1f3b7..1f3bc: mov eax, 0x13; call 0x1e3ba; jmp 1f3ae
  }
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) - 1) & 0xff); // 1f3ae: dec byte [0x31086]
  // 1f3b4..1f3b6: pop ds; leave; ret
});
