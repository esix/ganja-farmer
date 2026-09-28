// 0x10cac  void sub_10cac(void)   [Watcom, no args, no return value]
// Args: none — no register is read before being written (10cb6..10cbb are callee saves popped at 11287..1128c).
// Return: EAX at RET is the leftover of Behind_Sprite_Clip (11280); neither caller reads it (0x11a3a is followed
// by 11a3f `xor eax, eax`; 0x1d194 by 1d199 `cmp dword [0x64ff8], 0`) -> nothing returned (signatures.json
// returns=false).
// Summary (facts from the disassembly): saves the backgrounds of the sprites at 0x33aa4, 0x45be8, 0x45744,
// 0x458d0, 0x45a5c (Behind/Erase_Sprite_Clip on double_buffer [0x64e7c], LIBRARY.md), sets [0x33c0c] = 1, then
// loops until the local `done` becomes 1:
//   [0x45d50] = ([0x30c20] == 0); sub_14fba(); Squeeze_Mouse(3, 0x60b48, 0x60b4c, 0x60b50);
//   sprite 0x33aa4: x (+0) = ([0x60b48] >> 1 (sar)) - 0x10, y (+4) = [0x60b4c] (sprite fields, LIBRARY.md);
//   done = 1 if [0x60b50] == 2 or keyboard_state Esc [0x64f08] != 0 or Space [0x64fe8] != 0 (LIBRARY.md
//   "Game-side use of keyboard_state"), or if [0x60b50] == 1 and the point (x, y) lies strictly inside
//   (0xab..0xb4, 0x7d..0x84);
//   if [0x60b50] == 1, (x, y) strictly inside (0x53..0x63, 0x66..0x70) and `latch` == 0: toggles [0x30c20]
//   (nonzero -> 0, 0 -> 1), dws_DPlay(0x61180), latch = 1; latch = 0 whenever [0x60b50] != 1;
//   for the three sprites 0x45744 / 0x458d0 / 0x45a5c (row y ranges 0x48..0x52 / 0x5c..0x66 / 0x70..0x7a,
//   x range 0x55..0xaf, all strict): if [0x60b50] == 1 and (x, y) is inside, sprite.x = x - 6; then sprite.x
//   is clamped (> 0xaf -> 0xae, < 0x55 -> 0x56);
//   word [0x60f0e] / [0x60f10] / [0x60f12] = (word sprite.x - 0x55) * 2 + 0x4a, forced to 0 if sprite.x < 0x5a
//   and to 0xff if sprite.x > 0xaa; if word [0x60f10] < 0x96 then [0x30c20] = 0;
//   dws_XDig(word [0x60f0e]); dws_XMusic(word [0x60f10]); dws_XMaster(word [0x60f12]);
//   dws_DSoundStatus(word [0x611ca], 0x60f14); if word [0x60f14] == 0: dws_DPlay(0x611c0);
//   erase / save background / draw (transparent) the sprites, Show_Double_Buffer, sub_10050(), Time_Delay(1).
// After the loop: [0x33c0c] = 0, erases the five sprites and saves the background of 0x33aa4 again.
// Evidence for pointer kinds: 0x33aa4, 0x45744, 0x458d0, 0x45a5c, 0x45be8 are passed as the sprite* of
// Behind_Sprite_Clip / Erase_Sprite_Clip / Draw_Sprite_Clip (LIBRARY.md), so +0 is x and +4 is y (0x33aa8).
// 0x61180 / 0x611c0 are passed as dws_DPLAY* to dws_DPlay; 0x611ca = 0x611c0 + 0xA = its soundnum word
// (LIBRARY.md dws_DPLAY), passed to dws_DSoundStatus with result pointer 0x60f14 (LIBRARY.md: `*result & 1` =
// still playing). 0x60b48 / 0x60b4c / 0x60b50: the x / y / buttons pointers of Squeeze_Mouse cmd 3 (per
// 230df_Squeeze_Mouse.js). 0x33c0c, 0x45d50, 0x30c20, 0x60f0e, 0x60f10, 0x60f12: address only (0x30c20 is also
// the DPlay gate tested in sub_10050, per 10050_sub_10050.js).
// All comparisons of dwords are signed (jg/jl/jle/jge); the word [0x60f10] test is on the zero-extended word
// (1105a `xor eax,eax; mov ax,[0x60f10]; cmp eax,0x96; jge`).
// No x87 instructions in this function.
import { F, register } from '../runtime/registry.js';
import { R16, R32, W16, W32 } from '../runtime/mem.js';
import { DPLAY, KEY, SPRITE, doubleBuffer, gunSight, keyboardState, masterVolume, mouseButtons, mouseX, mouseY, musicSamplesEnabled, musicVolume, sfxVolume, sndDoubleClick, sndYaMon, soundMenu, soundStatus, volumeSliders } from './data.js';

register(0x10cac, 'sub_10cac', async function sub_10cac() {
  let done;  // [ebp-8]
  let latch; // [ebp-4]

  done = 0;                                                            // 10cc4
  latch = 0;                                                           // 10ccb
  F.Behind_Sprite_Clip_2106f(gunSight, R32(doubleBuffer));             // 10cd2..10cdd
  F.Behind_Sprite_Clip_2106f(soundMenu, R32(doubleBuffer));             // 10ce2..10ced
  F.Erase_Sprite_Clip_211fc(gunSight, R32(doubleBuffer));              // 10cf2..10cfd
  F.Behind_Sprite_Clip_2106f(gunSight, R32(doubleBuffer));             // 10d02..10d0d
  F.Behind_Sprite_Clip_2106f(volumeSliders, R32(doubleBuffer));             // 10d12..10d1d
  F.Behind_Sprite_Clip_2106f((volumeSliders + 1 * SPRITE.SIZE), R32(doubleBuffer));             // 10d22..10d2d
  F.Behind_Sprite_Clip_2106f((volumeSliders + 2 * SPRITE.SIZE), R32(doubleBuffer));             // 10d32..10d3d
  W32((gunSight + SPRITE.currFrame), 1);                                                     // 10d42

  // 10d4c: cmp [ebp-8], 1; je 0x1121b. Busy-wait: the exit also depends on keyboard_state [0x64f08] /
  // [0x64fe8], written by the keyboard ISR Keyboard_Driver 0x22b04 (LIBRARY.md); no extra yieldCpu is added:
  // the body awaits Time_Delay(1), which always yields at least once while waiting for the BIOS tick
  // (20404_Time_Delay.js; same reasoning as 1098f_sub_1098f.js / 1128e_sub_1128e.js).
  while (done !== 1) {
    if (R32(musicSamplesEnabled) !== 0) {                                          // 10d56: cmp; je 10d6b
      W32((soundMenu + SPRITE.currFrame), 0);                                                 // 10d5f
    } else {
      W32((soundMenu + SPRITE.currFrame), 1);                                                 // 10d6b
    }
    F.sub_14fba();                                               // 10d75
    F.Squeeze_Mouse_230df(3, mouseX, mouseY, mouseButtons);         // 10d7a..10d8e (result not read)
    W32(gunSight, ((R32(mouseX) >> 1) - 0x10) | 0);                    // 10d93..10d9d: sar eax,1; sub eax,0x10
    W32((gunSight + SPRITE.y), R32(mouseY));                                        // 10da2..10da7

    // 10dac..10dc9
    if (R32(mouseButtons) === 2 || R32((keyboardState + 4 * KEY.esc)) !== 0 || R32((keyboardState + 4 * KEY.space)) !== 0) {
      done = 1;                                                        // 10dc9
    }
    // 10dd0..10e0e
    if (R32(mouseButtons) === 1 && R32(gunSight) > 0xab && R32(gunSight) < 0xb4 &&
        R32((gunSight + SPRITE.y)) > 0x7d && R32((gunSight + SPRITE.y)) < 0x84) {
      done = 1;                                                        // 10e0e
    }
    // 10e15..10e4e
    if (R32(mouseButtons) === 1 && R32(gunSight) > 0x53 && R32(gunSight) < 0x63 &&
        R32((gunSight + SPRITE.y)) > 0x66 && R32((gunSight + SPRITE.y)) < 0x70 && latch === 0) {
      if (R32(musicSamplesEnabled) !== 0) {                                        // 10e52: cmp; je 10e67
        W32(musicSamplesEnabled, 0);                                               // 10e5b
      } else {
        W32(musicSamplesEnabled, 1);                                               // 10e67
      }
      F.dws_DPlay_1eff8(sndDoubleClick);                                // 10e71..10e7c (cdecl)
      latch = 1;                                                       // 10e7f
    }
    if (R32(mouseButtons) !== 1) {                                          // 10e86: cmp; je 10e96
      latch = 0;                                                       // 10e8f
    }

    // 10e96..10ece
    if (R32(mouseButtons) === 1 && R32(gunSight) > 0x55 && R32(gunSight) < 0xaf &&
        R32((gunSight + SPRITE.y)) > 0x48 && R32((gunSight + SPRITE.y)) < 0x52) {
      W32(volumeSliders, (R32(gunSight) - 6) | 0);                            // 10ece..10ed6
    }
    if (R32(volumeSliders) > 0xaf) W32(volumeSliders, 0xae);                       // 10edb..10ee7 (jle)
    if (R32(volumeSliders) < 0x55) W32(volumeSliders, 0x56);                       // 10ef1..10efa (jge)

    // 10f04..10f3c
    if (R32(mouseButtons) === 1 && R32(gunSight) > 0x55 && R32(gunSight) < 0xaf &&
        R32((gunSight + SPRITE.y)) > 0x5c && R32((gunSight + SPRITE.y)) < 0x66) {
      W32((volumeSliders + 1 * SPRITE.SIZE), (R32(gunSight) - 6) | 0);                            // 10f3c..10f44
    }
    if (R32((volumeSliders + 1 * SPRITE.SIZE)) > 0xaf) W32((volumeSliders + 1 * SPRITE.SIZE), 0xae);                       // 10f49..10f55
    if (R32((volumeSliders + 1 * SPRITE.SIZE)) < 0x55) W32((volumeSliders + 1 * SPRITE.SIZE), 0x56);                       // 10f5f..10f68

    // 10f72..10faa
    if (R32(mouseButtons) === 1 && R32(gunSight) > 0x55 && R32(gunSight) < 0xaf &&
        R32((gunSight + SPRITE.y)) > 0x70 && R32((gunSight + SPRITE.y)) < 0x7a) {
      W32((volumeSliders + 2 * SPRITE.SIZE), (R32(gunSight) - 6) | 0);                            // 10faa..10fb2
    }
    if (R32((volumeSliders + 2 * SPRITE.SIZE)) > 0xaf) W32((volumeSliders + 2 * SPRITE.SIZE), 0xae);                       // 10fb7..10fc3
    if (R32((volumeSliders + 2 * SPRITE.SIZE)) < 0x55) W32((volumeSliders + 2 * SPRITE.SIZE), 0x56);                       // 10fcd..10fd6

    // 10fe0..10ff0: mov ax, word [0x45744]; sub eax,0x55; add eax,eax; add eax,0x4a; mov word [0x60f0e], ax
    // (only AX is stored, so the upper EAX bits left from before do not matter)
    W16(sfxVolume, (R16(volumeSliders) - 0x55) * 2 + 0x4a);
    if (R32(volumeSliders) < 0x5a) W16(sfxVolume, 0);                          // 10ff6..10fff
    if (R32(volumeSliders) > 0xaa) W16(sfxVolume, 0xff);                       // 11008..11014

    W16(musicVolume, (R16((volumeSliders + 1 * SPRITE.SIZE)) - 0x55) * 2 + 0x4a);                    // 1101d..1102d
    if (R32((volumeSliders + 1 * SPRITE.SIZE)) < 0x5a) W16(musicVolume, 0);                          // 11033..1103c
    if (R32((volumeSliders + 1 * SPRITE.SIZE)) > 0xaa) W16(musicVolume, 0xff);                       // 11045..11051
    if (R16(musicVolume) < 0x96) {                                         // 1105a..11067 (zero-extended word, jge)
      W32(musicSamplesEnabled, 0);                                                 // 11069
    }

    W16(masterVolume, (R16((volumeSliders + 2 * SPRITE.SIZE)) - 0x55) * 2 + 0x4a);                    // 11073..11083
    if (R32((volumeSliders + 2 * SPRITE.SIZE)) < 0x5a) W16(masterVolume, 0);                          // 11089..11092
    if (R32((volumeSliders + 2 * SPRITE.SIZE)) > 0xaa) W16(masterVolume, 0xff);                       // 1109b..110a7

    F.dws_XDig_1ef64(R16(sfxVolume));                              // 110b0..110be (cdecl)
    F.dws_XMusic_1eed0(R16(musicVolume));                            // 110c1..110cf (cdecl)
    F.dws_XMaster_1ee3c(R16(masterVolume));                           // 110d2..110e0 (cdecl)
    F.dws_DSoundStatus_1f348(R16((sndYaMon + DPLAY.soundnum)), soundStatus);             // 110e3..110f7 (cdecl)
    if (R16(soundStatus) === 0) {                                          // 110fa: cmp word; jne 11112
      F.dws_DPlay_1eff8(sndYaMon);                                // 11104..1110f (cdecl)
    }

    F.Erase_Sprite_Clip_211fc(gunSight, R32(doubleBuffer));            // 11112..1111d
    F.Erase_Sprite_Clip_211fc(volumeSliders, R32(doubleBuffer));            // 11122..1112d
    F.Erase_Sprite_Clip_211fc((volumeSliders + 1 * SPRITE.SIZE), R32(doubleBuffer));            // 11132..1113d
    F.Erase_Sprite_Clip_211fc((volumeSliders + 2 * SPRITE.SIZE), R32(doubleBuffer));            // 11142..1114d
    F.Behind_Sprite_Clip_2106f(gunSight, R32(doubleBuffer));           // 11152..1115d
    F.Behind_Sprite_Clip_2106f(volumeSliders, R32(doubleBuffer));           // 11162..1116d
    F.Behind_Sprite_Clip_2106f((volumeSliders + 1 * SPRITE.SIZE), R32(doubleBuffer));           // 11172..1117d
    F.Behind_Sprite_Clip_2106f((volumeSliders + 2 * SPRITE.SIZE), R32(doubleBuffer));           // 11182..1118d
    F.Draw_Sprite_Clip_212c0(soundMenu, R32(doubleBuffer), 1);          // 11192..111a2
    F.Draw_Sprite_Clip_212c0(volumeSliders, R32(doubleBuffer), 1);          // 111a7..111b7
    F.Draw_Sprite_Clip_212c0((volumeSliders + 1 * SPRITE.SIZE), R32(doubleBuffer), 1);          // 111bc..111cc
    F.Draw_Sprite_Clip_212c0((volumeSliders + 2 * SPRITE.SIZE), R32(doubleBuffer), 1);          // 111d1..111e1
    F.Draw_Sprite_Clip_212c0(gunSight, R32(doubleBuffer), 1);          // 111e6..111f6
    F.Show_Double_Buffer_21531(R32(doubleBuffer), 0);                 // 111fb..11202
    F.sub_10050();                                               // 11207
    await F.Time_Delay_20404(1);                                       // 1120c..11211
  }                                                                    // 11216: jmp 0x10d4c

  W32((gunSight + SPRITE.currFrame), 0);                                                     // 1121b
  F.Erase_Sprite_Clip_211fc(gunSight, R32(doubleBuffer));              // 11225..11230
  F.Erase_Sprite_Clip_211fc(volumeSliders, R32(doubleBuffer));              // 11235..11240
  F.Erase_Sprite_Clip_211fc((volumeSliders + 1 * SPRITE.SIZE), R32(doubleBuffer));              // 11245..11250
  F.Erase_Sprite_Clip_211fc((volumeSliders + 2 * SPRITE.SIZE), R32(doubleBuffer));              // 11255..11260
  F.Erase_Sprite_Clip_211fc(soundMenu, R32(doubleBuffer));              // 11265..11270
  F.Behind_Sprite_Clip_2106f(gunSight, R32(doubleBuffer));             // 11275..11280
});
