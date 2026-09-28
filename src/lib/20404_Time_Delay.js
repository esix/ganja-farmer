// 0x20404  void Time_Delay(int ticks)
//          [Watcom: ticks=EAX; no stack args]
// Busy-waits on the BIOS tick counter (dword at flat 0x46C, incremented by the timer interrupt):
// start = [0x46C]; repeat r = sub_23d7a([0x46C] - start) until r >= ticks (signed, jge).
// Return value: none. EAX at RET is the leftover sub_23d7a result (the epilogue 0x20442..0x2044a does not set
// EAX); no caller reads it (signatures.json returns=false over 16 binary call sites; no JS caller uses it),
// so per the PORTING.md return-value rule nothing is returned.
// sub_23d7a: signed absolute value (0x23d7a: test eax,eax; jge; neg eax; ret). LIBRARY.md guesses "labs (?)".
// There is no explicit wrap handling: the difference is a plain 32-bit `sub`, then passed to sub_23d7a.
// Async because the loop waits for the timer ISR (PORTING.md busy-wait rule).
import { F, register } from '../runtime/registry.js';
import { R32 } from '../runtime/mem.js';
import { yieldCpu } from '../runtime/cpu.js';

register(0x20404, 'Time_Delay_20404', async function Time_Delay(ticks) {
  // 2041c: [ebp-0xc] = ticks
  // 2041f: [ebp-8] = 0x46c (pointer local; not address-taken)
  // 20426-2042b: [ebp-4] = start = dword [0x46c]
  const start = R32(0x46c);
  let r;
  for (;;) {
    // 2042e-20433: eax = dword [0x46c] - start (32-bit wrap)
    // 20436: call 0x23d7a (signed abs)
    r = F.sub_23d7a((R32(0x46c) - start) | 0);
    // 2043b/2043e: cmp eax, ticks; jge 0x20442 (signed)
    if (r >= (ticks | 0)) break;
    // 20440: jmp 0x2042e — yield so the timer interrupt can advance 0x46C (not in the original)
    await yieldCpu();
  }
  // 20442-2044a: epilogue (EAX = leftover sub_23d7a result, not returned — see header)
});
