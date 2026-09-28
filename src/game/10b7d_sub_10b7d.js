// 0x10b7d  void sub_10b7d(void)   [Watcom, no args, no return value]
// Pauses digitized sound and music (dws_DPause, dws_MPause), prints " Game Paused Mon! " (0x30070) at (0x5a,0x3c)
// color 0xfc and " Press Enter to continue " (0x30083) at (0x3c,0x46) color 0xfb, then loops
// { sub_14fba(); Time_Delay(1); } while keyboard_state[0x1c] (0x64f74, Enter) == 0 and keyboard_state[0x39]
// (0x64fe8, Space) == 0 (LIBRARY.md "Game-side use of keyboard_state"), then dws_DUnPause, dws_MUnPause.
// Args: none — no register is read before being written (10b87..10b8c are callee saves popped at 10c04..10c09).
// The only caller (call at 0x1d1c0) reads no register afterwards (next insn 1d1c5: cmp dword [0x64f9c],0).
// Return: EAX is the leftover of dws_MUnPause; nothing is returned (signatures.json returns=false).
// No x87 instructions in this function.
import { F, register } from '../runtime/registry.js';
import { R32 } from '../runtime/mem.js';

register(0x10b7d, 'sub_10b7d', async function sub_10b7d() {
  F.dws_DPause_1f98a();                                        // 10b95
  F.dws_MPause_1fe37();                                        // 10b9a
  F.Print_String_202cd(0x5a, 0x3c, 0xfc, 0x30070 /* " Game Paused Mon! " */, 0); // 10b9f..10bb5
  F.Print_String_202cd(0x3c, 0x46, 0xfb, 0x30083 /* " Press Enter to continue " */, 0); // 10bba..10bd0
  // 10bd5..10bf8: exit when [0x64f74] != 0 or [0x64fe8] != 0. Busy-wait: both are keyboard_state entries
  // written by the keyboard ISR Keyboard_Driver 0x22b04 (LIBRARY.md); no extra yieldCpu is added:
  // the body awaits Time_Delay(1), which always yields at least once while waiting for the BIOS tick
  // (20404_Time_Delay.js; same reasoning as 1098f_sub_1098f.js / 1128e_sub_1128e.js).
  while (R32(0x64f74) === 0 && R32(0x64fe8) === 0) {
    F.sub_14fba();                                             // 10be9
    await F.Time_Delay_20404(1);                                     // 10bee/10bf3
  }
  F.dws_DUnPause_1fa16();                                      // 10bfa
  F.dws_MUnPause_1fec3();                                      // 10bff
});
