// 0x2362c  void Timer_Program(int port, unsigned rate)   [Watcom: EAX=port, EDX=rate; no return value]
// Writes 0x3C to the PIT mode/command port 0x43 via outp, then the low byte and the high byte of rate
// to `port` via outp (0x23d99). Synchronous (no waiting).
// Only caller: main (0x1aa02) at 0x1e022, with (0x40, 0xFFFF), just before Set_Video_Mode(3).
import { F, register } from '../runtime/registry.js';

register(0x2362c, 'Timer_Program_2362c', function Timer_Program(port, rate) {
  // 2362c..23631: __CHK(0x20) omitted
  // 23643/23646: port -> [ebp-8], rate -> [ebp-4]
  F.outp_23d99(0x43, 0x3c);                          // 23649..23653
  F.outp_23d99(port, rate & 0xff);                   // 23658..23664: and edx, 0xff
  F.outp_23d99(port, (rate >>> 8) & 0xff);           // 23669..23678: shr edx, 8; and edx, 0xff
  // 2367d..23684: epilogue, ret (EAX left as outp's result; signatures.json returns=false)
});
