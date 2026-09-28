// 0x21937  void Wait_For_Vertical_Retrace(void)
//          [Watcom: no args; no return value (EAX holds the last inp result, not read by callers)]
// Polls VGA input status register 1 (port 0x3DA) through the CRT inp (0x23da3): first loops while
// bit 3 (0x08) is set, then loops while it is clear — i.e. returns at the start of a vertical retrace.
// Async because both loops busy-wait on hardware state (PORTING.md busy-wait rule).
// Stage 2: reads the retrace bit from the VGA directly (was IN 3DAh through the CRT's inp).
import { register } from '../runtime/registry.js';
import { yieldCpu } from '../runtime/cpu.js';
import { inRetrace } from '../platform/vga.js';

register(0x21937, 'Wait_For_Vertical_Retrace_21937', async function Wait_For_Vertical_Retrace() {
  while (inRetrace()) await yieldCpu();   // wait for the end of a retrace in progress
  while (!inRetrace()) await yieldCpu();  // then for the start of the next one
});
