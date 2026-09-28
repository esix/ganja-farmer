// 0x21937  void Wait_For_Vertical_Retrace(void)
//          [Watcom: no args; no return value (EAX holds the last inp result, not read by callers)]
// Polls VGA input status register 1 (port 0x3DA) through the CRT inp (0x23da3): first loops while
// bit 3 (0x08) is set, then loops while it is clear — i.e. returns at the start of a vertical retrace.
// Async because both loops busy-wait on hardware state (PORTING.md busy-wait rule).
import { F, register } from '../runtime/registry.js';
import { yieldCpu } from '../runtime/cpu.js';

register(0x21937, 'Wait_For_Vertical_Retrace_21937', async function Wait_For_Vertical_Retrace() {
  // 2194f-2195d: do { al = inp(0x3da) } while (al & 8)
  for (;;) {
    // 2194f/21954: eax = 0x3da; call 0x23da3
    // 21959/2195b: test al, 8; je 0x2195f
    if ((await F.inp_23da3(0x3da) & 8) === 0) break;
    // 2195d: jmp 0x2194f — yield so the emulated VGA can advance (not in the original)
    await yieldCpu();
  }
  // 2195f-2196d: do { al = inp(0x3da) } while (!(al & 8))
  for (;;) {
    // 2195f/21964: eax = 0x3da; call 0x23da3
    // 21969/2196b: test al, 8; jne 0x2196f
    if ((await F.inp_23da3(0x3da) & 8) !== 0) break;
    // 2196d: jmp 0x2195f — yield (not in the original)
    await yieldCpu();
  }
  // 2196f-21975: epilogue
});
