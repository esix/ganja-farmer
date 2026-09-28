// 0x1e303  regs sub_1e303(eax, edx, ebx, ecx)   [register args, no stack args; synchronous]
// DiamondWare STK driver-call thunk: `int 0x65; ret` (3 bytes, entry 5 of the thunk table at 0x30c63,
// called indirectly through that table (e.g. 0x1e342 at 0x1e36f) with the vector found by 0x1e859; re/HARDWARE.md §6).
// The INT sees exactly the caller's EAX, EBX, ECX, EDX; the thunk touches no register itself.
// Returns the register set after the INT as int86 returns it ({eax, ebx, ecx, edx, ..., cf}); callers read
// .ecx (the STKRUN handler's result, e.g. 0x1e376 `mov eax, ecx` in 0x1e342). Per argc_overrides.json
// (retregs ["ecx"]), EAX after the INT is not what callers use.
import { register } from '../runtime/registry.js';
import { int86 } from '../runtime/io.js';

register(0x1e303, 'sub_1e303', function sub_1e303(eax, edx, ebx, ecx) {
  const r = int86(0x65, { eax, ebx, ecx, edx });  // 1e303: int 0x65
  return r;                                     // 1e305: ret
});
