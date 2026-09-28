// 0x235f9  int Timer_Query(void)   [Watcom, no args; returns EAX]
// Returns the 32-bit dword at flat address 0x46c (BIOS tick counter, 0040:006C) with a single plain read:
// no cli/sti, no retry/double-read loop. Does not wait, so it is synchronous.
import { register } from '../runtime/registry.js';
import { R32 } from '../runtime/mem.js';

register(0x235f9, 'Timer_Query_235f9', function Timer_Query() {
  let p;       // [ebp-4]
  let ticks;   // [ebp-8]
  // 235f9..235fe: __CHK(0x24) omitted
  p = 0x46c;                  // 23611: mov dword [ebp-4], 0x46c
  ticks = R32(p);            // 23618..2361d: mov eax,[ebp-4]; mov eax,[eax] (full dword); mov [ebp-8], eax
  return ticks;               // 23620: mov eax, [ebp-8]
});
