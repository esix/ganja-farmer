// 0x22b04  Keyboard_Driver(scan)   [was the INT 9 ISR; stage 2: called by platform/kbd.js with each byte]
// Stage 1 ported the ISR: it read the byte from port 0x60, acknowledged it on port 0x61 and sent the PIC an
// EOI. Stage 2 hands it the byte directly; what it does with it is unchanged:
//   raw_key 0x64f00 (dword) = byte; byte < 0x80 -> make: if keyboard_state[byte] (0x64f04, int32) == 0,
//   keys_active 0x65104 += 1 and keyboard_state[byte] = 1; else -> break: if keyboard_state[byte - 0x80]
//   == 1, keys_active -= 1 and that entry = 0. (Prefix bytes E0h/E1h are "breaks" of 60h/61h, which the
//   game never makes, so they change nothing; an E0-prefixed key sets the same slot as its non-E0 twin.)
// (keyboard_state / raw_key / keys_active names: LIBRARY.md, re/HARDWARE.md §3.)
import { register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';

register(0x22b04, 'Keyboard_Driver_22b04', function Keyboard_Driver(scan) {
  W32(0x64f00, scan);
  if (scan < 0x80) {
    const slot = 0x64f04 + scan * 4;
    if (R32(slot) === 0) {
      W32(0x65104, (R32(0x65104) + 1) | 0);
      W32(slot, 1);
    }
  } else {
    const slot = 0x64f04 + (scan - 0x80) * 4;
    if (R32(slot) === 1) {
      W32(0x65104, (R32(0x65104) - 1) | 0);
      W32(slot, 0);
    }
  }
});
