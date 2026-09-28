// 0x16b96  void sub_16b96(void)   [Watcom, no args, no return value]
// Sets 0x3de78 = 2, plays the dws_DPLAY at 0x61360, draws the sprite at 0x3dd10 into the buffer [0x64e7c],
// shows that buffer, waits 0x24 ticks, runs Screen_Transition(0), then loads "blank.pcx" (0x30174) into the
// pcx_picture at 0x31ee4, copies it into [0x64e7c] and deletes it.
// Return: EAX at RET is only the leftover of PCX_Delete (0x16c2b); nothing sets it deliberately and the only
// caller (0x1dfe7) overwrites EAX right after (`xor eax, eax` at 0x1dfec) — so no return value (PORTING.md).
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';

register(0x16b96, 'sub_16b96', async function sub_16b96() {
  W32(0x3de78, 2);                                                    // 16bae
  F.dws_DPlay_1eff8(0x61360);                                   // 16bb8..16bc3 (cdecl, 1 stack arg)
  F.Draw_Sprite_Clip_212c0(0x3dd10, R32(0x64e7c), 1);           // 16bc6..16bd6
  F.Show_Double_Buffer_21531(R32(0x64e7c), 0);                  // 16bdb..16be2
  await F.Time_Delay_20404(0x24);                                     // 16be7..16bec
  await F.Screen_Transition_21673(0);                                 // 16bf1..16bf3
  F.PCX_Init_207a0(0x31ee4);                                    // 16bf8..16bfd
  F.PCX_Load_20806(0x30174 /* "blank.pcx" */, 0x31ee4, 1);      // 16c02..16c11
  F.PCX_Copy_To_Buffer_20bd7(0x31ee4, R32(0x64e7c));            // 16c16..16c21
  F.PCX_Delete_20b69(0x31ee4);                                  // 16c26..16c2b
});
