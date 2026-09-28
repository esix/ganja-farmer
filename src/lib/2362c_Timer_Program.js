// 0x2362c  void Timer_Program(int port, unsigned rate)   [Watcom: EAX=port, EDX=rate; no return value]
// Writes 0x3C to the PIT mode/command port 0x43 via outp, then the low byte and the high byte of rate
// to `port` via outp (0x23d99). Synchronous (no waiting).
// Only caller: main (0x1aa02) at 0x1e022, with (0x40, 0xFFFF), just before Set_Video_Mode(3).
// Stage 2: writes the PIT directly (was OUT 43h,3Ch; OUT port lo; OUT port hi through the CRT's outp).
import { register } from '../runtime/registry.js';
import { writePort } from '../platform/pit.js';

register(0x2362c, 'Timer_Program_2362c', function Timer_Program(port, rate) {
  writePort(0x43, 0x3c);
  writePort(port, rate & 0xff);
  writePort(port, (rate >>> 8) & 0xff);
});
