// 0x10c0b  void sub_10c0b(void)   [Watcom, no args, no return value]
// Pauses digitized sound and music (dws_DPause, dws_MPause), prints "Are you sure you want to quit Mon ?"
// (0x3009d) at (0xa,0x3c) color 0xfc and " (y or n) " (0x300c1) at (0x7d,0x46) color 0xfb, then, testing first,
// while (…) { sub_14fba(); Time_Delay(1); if ([0x64f58] != 0) [0x30be4] = 0x1c; } — condition: keyboard_state[0x15]
// (0x64f58, Y — LIBRARY.md "Game-side use of keyboard_state") == 0 and keyboard_state[0x31]
// (0x64fc8 = 0x64f04 + 4*0x31, LIBRARY.md) == 0, then dws_DUnPause, dws_MUnPause.
// Args: none — no register is read before being written (10c15..10c1a are callee saves popped at 10ca5..10caa).
// The only caller (call at 0x1d181) reads no register afterwards (next insn 1d186: call 0x16c37, which takes
// no register args per signatures.json).
// Return: EAX is the leftover of dws_MUnPause; nothing is returned (signatures.json returns=false).
// 0x30be4: unknown global (address only).
// No x87 instructions in this function.
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';
import { KEY, gameState, keyboardState } from './data.js';

register(0x10c0b, 'sub_10c0b', async function sub_10c0b() {
  F.dws_DPause_1f98a();                                        // 10c23
  F.dws_MPause_1fe37();                                        // 10c28
  F.Print_String_202cd(0xa, 0x3c, 0xfc, 0x3009d /* "Are you sure you want to quit Mon ?" */, 0); // 10c2d..10c43
  F.Print_String_202cd(0x7d, 0x46, 0xfb, 0x300c1 /* " (y or n) " */, 0); // 10c48..10c5e
  // 10c63..10c75: exit to 10c9b when [0x64f58] != 0 or [0x64fc8] != 0. Busy-wait: both are keyboard_state
  // entries written by the keyboard ISR Keyboard_Driver 0x22b04 (LIBRARY.md); no extra yieldCpu is added:
  // the body awaits Time_Delay(1), which always yields at least once while waiting for the BIOS tick
  // (20404_Time_Delay.js; same reasoning as 1098f_sub_1098f.js / 1128e_sub_1128e.js).
  while (R32((keyboardState + 4 * KEY.y)) === 0 && R32((keyboardState + 4 * KEY.n)) === 0) {
    F.sub_14fba();                                             // 10c77
    await F.Time_Delay_20404(1);                                     // 10c7c/10c81
    if (R32((keyboardState + 4 * KEY.y)) !== 0) {                                        // 10c86: cmp [0x64f58],0; je 10c99
      W32(gameState, 0x1c);                                            // 10c8f
    }
  }                                                                  // 10c99: jmp 10c63
  F.dws_DUnPause_1fa16();                                      // 10c9b
  F.dws_MUnPause_1fec3();                                      // 10ca0
});
