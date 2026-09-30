// 0x115bc  void showTitleScreen(void)   [Watcom, no args, no return value]
// Shows "titp.pcx" (PCX picture struct at 0x31ee4), then waits 65 x Time_Delay(1) ticks, calling
// dws_DPlay(0x611c0) once at iteration 50, and finally clears the screen with Fill_Screen(0).
// Return: EAX at RET is only Fill_Screen's leftover (no `mov eax` before the epilogue); the only caller
// (decompiled.c line 4839) ignores it -> returns nothing.
import { F, register } from '../runtime/registry.js';
import { pcxScratch, sndYaMon } from './data.js';

register(0x115bc, 'showTitleScreen_115bc', async function showTitleScreen() {
  let i; // [ebp-4]

  i = 0;                                                     // 115d4
  F.PCX_Load_20806(0x300eb /* "titp.pcx" */, pcxScratch, 1); // 115e5
  F.PCX_Show_Buffer_20b9b(pcxScratch);                    // 115f9
  for (i = 0; i < 0x41; i++) {                               // 1160d..11640 (signed jge)
    await F.Time_Delay_20404(1);                             // 11622
    if (i === 0x32) {                                        // 1162c
      F.dws_DPlay_1eff8(sndYaMon);                      // 11632 (cdecl, 1 stack arg; 0x611c0: dws_DPLAY struct passed to dws_DPlay, LIBRARY.md)
    }
  }
  i = 0;                                                     // 11642 (dead store)
  F.Fill_Screen_20768(0);                              // 11649
});
