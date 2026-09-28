// 0x1eed0  void dws_XMusic(int vol)   [cdecl, 1 stack arg (full dword [ebp+8] passed on); no return value]
// DiamondWare STK client stub for STK function 6 (dws_XMusic, LIBRARY.md: music volume, "Music" slider).
// Same frame as dwt_Init 0x1ff4f / dwt_Kill 0x1ffe0 (DS check at 0x30c61, magic 0x31088, re-entry counter
// byte 0x31086), with two differences tied to instructions:
//   - entry pushes only DS and EAX (1eed3/1eed4; no outer push eax), and the epilogue 1ef55..1ef57 is
//     pop ds; leave; ret — EAX is NOT restored. It holds a leftover (0x1e971's EAX, or 0x1e3ba's on the error
//     paths); both callers (0x110ca, 0x1cb9d) do `add esp, 4` and then overwrite EAX without reading it
//     (signatures.json returns=false), so the port returns nothing.
//   - the driver result is passed on: 0x1e342(vol, 6) returns the STK result in EAX; `and eax, 0xffff` and
//     call 0x1e3c0 (register arg EAX; per its disassembly it stores a driver error code into 0x30c7f when EAX
//     is 0 — ported, called through F).
// No DOS-buffer argument block is built here (0x1e342 carries the single word argument itself).
// Callee keys: 0x1e8d1 / 0x1e971 / 0x1e342 / 0x1e3c0 / 0x1e3ba are not in re/names.tsv -> sub_<addr>.
import { F, register } from '../runtime/registry.js';
import { R8, R16, R32, W8, W16 } from '../runtime/mem.js';
import { selBase, SEL_CODE, SEL_DATA } from '../platform/dpmi.js';

register(0x1eed0, 'dws_XMusic_1eed0', function dws_XMusic(vol) {
  // 1eed0..1eed4: push ebp; mov ebp, esp; push ds; push eax
  // UNCERTAIN: the caller's DS is the extender-chosen data selector; the port uses SEL_DATA from
  // platform/dpmi.js (same approach as dwt_Init / dwt_Kill).
  let ds = SEL_DATA;
  const csBase = selBase(SEL_CODE);
  let skipStore = false;
  if (R16(csBase + 0x30c61) !== 0) {                  // 1eed5: cmp word cs:[0x30c61], 0; je 1eef7
    if (R16(csBase + 0x30c61) === ds) {               // 1eee0..1eeeb: mov ax, ds; cmp cs:[0x30c61], ax; je 1ef19
      skipStore = true;
    } else {
      ds = R16(csBase + 0x30c61);                     // 1eeed: mov ds, cs:[0x30c61]
      // 1eef5: je 1ef19 — MOV does not change flags; ZF is still clear from the cmp at 1eee3, so this
      // branch is never taken and execution falls through to 1eef7.
    }
  }
  // UNCERTAIN: after a real DS reload the callees would run with the reloaded DS; the port cannot pass a
  // segment register to them (only reachable if 0x30c61 holds a selector other than SEL_DATA).
  const dsBase = selBase(ds);
  if (!skipStore) {
    W16(dsBase + 0x30c61, ds);                        // 1eef7: mov word ds:[0x30c61], ds
    // 1eefe..1ef0a: mov eax, cs:[0x31088]; cmp eax, ds:[0x31088]; je 1ef19
    if (R32(csBase + 0x31088) !== R32(dsBase + 0x31088)) {
      // 1ef0c: pop eax
      F.sub_1e3ba(0x29a);                             // 1ef0d..1ef12: mov eax, 0x29a; call 0x1e3ba
      return;                                         // 1ef17: jmp 1ef55 -> pop ds; leave; ret
    }
  }
  // 1ef19: pop eax; 1ef1a: xor eax, eax
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) + 1) & 0xff); // 1ef1c: inc byte [0x31086]
  if (R8(dsBase + 0x31086) === 1) {                   // 1ef22: cmp byte [0x31086], 1; jne 1ef58
    if (F.sub_1e8d1() !== 0) {                        // 1ef2b..1ef33: call 0x1e8d1; cmp eax, 0; je 1ef4a
      // 1ef35..1ef3b: push 6; mov eax, [ebp+8]; push eax; call 0x1e342 (callee pops 8)
      const r = F.sub_1e342(vol, 6);
      F.sub_1e3c0(r & 0xffff);                        // 1ef40..1ef45: and eax, 0xffff; call 0x1e3c0
    }
    F.sub_1e971();                                    // 1ef4a: call 0x1e971
  } else {
    F.sub_1e3ba(0x13);                                // 1ef58..1ef5d: mov eax, 0x13; call 0x1e3ba; jmp 1ef4f
  }
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) - 1) & 0xff); // 1ef4f: dec byte [0x31086]
  // 1ef55..1ef57: pop ds; leave; ret
});
