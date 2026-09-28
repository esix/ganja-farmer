// 0x1e774  regs sub_1e774(size)   [1 stack arg [ebp+8], callee pops it (`ret 4`); no register args;
//          EBX saved/restored; returns three registers {eax, ecx, edx}; synchronous]
// DiamondWare STK client: reserves `size` bytes of the DOS buffer. Returns the current position and then
// advances it: word [0x30c87] += low 16 bits of size. The inverse is 0x1e7a6 (sub word [0x30c87], bx).
// Callers (0x1eaa2 dws_DetectHardWare, 0x1ec64 dws_Init, 0x1f217, 0x1f4d2, 0x1f62e, 0x1fcba) all read
// exactly `mov [ebp-x], eax; mov [ebp-y], cx; mov [ebp-z], edx` right after the call and use EAX as a
// real-mode far pointer seg:off, CX as the buffer selector and EDX as the offset inside it.
// Returned registers (argc_overrides.json 0x1e774: regs [], stack 1, retregs [eax, ecx, edx]):
//   EAX: 1e778 `mov ax, [0x30c83]` writes AX only, 1e77e `shl eax, 0x10` moves it to bits 16..31 and
//        shifts every bit of the caller's EAX out (low 16 bits become 0), 1e781 `mov ax, [0x30c87]` fills
//        bits 0..15. So EAX = word [0x30c83] << 16 | word [0x30c87] — fully determined, no incoming bits
//        survive (signatures.json "regs 1 / reads eax" is the partial-write misdetection, see README).
//   ECX: 1e787 `mov cx, [0x30c85]` writes CX only; bits 16..31 are whatever the caller had in ECX. The port
//        has no ECX input, so it returns those bits as 0.
//        UNCERTAIN: upper 16 bits of ECX are the caller's leftovers, not modelled (returned as 0). All six call
//        sites store only CX; the full ECX stays live in the callers (push/pop, passed into 0x1e37f/0x1e3c0/
//        0x1e7a6/0x1e971) but every path overwrites or pops it before any read (independent audit). The difftest
//        enters with ECX = 0, so both sides match.
//   EDX: 1e78e `xor edx, edx`, 1e790 `mov dx, [0x30c87]` -> zero-extended word [0x30c87] (read before the add).
// Only BX (low 16 bits of the stack arg) is added: 1e79a `add word [0x30c87], bx` (16-bit wrap).
// Name: not in re/names.tsv -> sub_1e774.
import { register } from '../runtime/registry.js';
import { R16, W16 } from '../runtime/mem.js';

register(0x1e774, 'sub_1e774', function sub_1e774(size) {
  // 1e774..1e777: push ebp; mov ebp, esp; push ebx
  let eax = R16(0x30c83);                          // 1e778: mov ax, word [0x30c83]
  eax = (eax << 16) >>> 0;                         // 1e77e: shl eax, 0x10
  eax = (eax | R16(0x30c87)) >>> 0;                // 1e781: mov ax, word [0x30c87]
  const ecx = R16(0x30c85);                        // 1e787: mov cx, word [0x30c85] (upper bits: see header)
  let edx = 0;                                     // 1e78e: xor edx, edx
  edx = R16(0x30c87);                              // 1e790: mov dx, word [0x30c87]
  const ebx = size >>> 0;                          // 1e797: mov ebx, [ebp+8]
  W16(0x30c87, (R16(0x30c87) + (ebx & 0xffff)) & 0xffff); // 1e79a: add word [0x30c87], bx
  // 1e7a1..1e7a3: pop ebx; leave; ret 4
  return { eax, ecx, edx };
});
