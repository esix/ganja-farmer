// 0x10cac  void runSoundOptionsMenu(void)   [Watcom, no args, no return value]
// Args: none — no register is read before being written (10cb6..10cbb are callee saves popped at 11287..1128c).
// Return: EAX at RET is the leftover of Behind_Sprite_Clip (11280); neither caller reads it (0x11a3a is followed
// by 11a3f `xor eax, eax`; 0x1d194 by 1d199 `cmp dword [0x64ff8], 0`) -> nothing returned (signatures.json
// returns=false).
// Summary (facts from the disassembly): saves the backgrounds of the sprites at 0x33aa4, 0x45be8, 0x45744,
// 0x458d0, 0x45a5c (Behind/Erase_Sprite_Clip on double_buffer [0x64e7c], LIBRARY.md), sets [0x33c0c] = 1, then
// loops until the local `done` becomes 1:
//   [0x45d50] = ([0x30c20] == 0); cycleRastaColors(); Squeeze_Mouse(3, 0x60b48, 0x60b4c, 0x60b50);
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
//   erase / save background / draw (transparent) the sprites, Show_Double_Buffer, updateMusic(), Time_Delay(1).
// After the loop: [0x33c0c] = 0, erases the five sprites and saves the background of 0x33aa4 again.
// Evidence for pointer kinds: 0x33aa4, 0x45744, 0x458d0, 0x45a5c, 0x45be8 are passed as the sprite* of
// Behind_Sprite_Clip / Erase_Sprite_Clip / Draw_Sprite_Clip (LIBRARY.md), so +0 is x and +4 is y (0x33aa8).
// 0x61180 / 0x611c0 are passed as dws_DPLAY* to dws_DPlay; 0x611ca = 0x611c0 + 0xA = its soundnum word
// (LIBRARY.md dws_DPLAY), passed to dws_DSoundStatus with result pointer 0x60f14 (LIBRARY.md: `*result & 1` =
// still playing). 0x60b48 / 0x60b4c / 0x60b50: the x / y / buttons pointers of Squeeze_Mouse cmd 3 (per
// 230df_Squeeze_Mouse.js). 0x33c0c, 0x45d50, 0x30c20, 0x60f0e, 0x60f10, 0x60f12: address only (0x30c20 is also
// the DPlay gate tested in updateMusic, per 10050_sub_10050.js).
// All comparisons of dwords are signed (jg/jl/jle/jge); the word [0x60f10] test is on the zero-extended word
// (1105a `xor eax,eax; mov ax,[0x60f10]; cmp eax,0x96; jge`).
// No x87 instructions in this function.
import { F, register } from '../runtime/registry.js';
import { R16, R32, W16, W32 } from '../runtime/mem.js';
import { KEY, SPRITE, gunSight, mouseButtons, mouseX, mouseY, sndDoubleClick, sndYaMon, soundMenu, soundStatus, volumeSliders } from './data.js';
import { G, dplay, keyDown, sprite } from './access.js';

register(0x10cac, 'runSoundOptionsMenu_10cac', async function runSoundOptionsMenu() {
  let done;  // [ebp-8]
  let latch; // [ebp-4]

  done = 0;                                                            // 10cc4
  latch = 0;                                                           // 10ccb
  F.Behind_Sprite_Clip_2106f(gunSight, G.doubleBuffer);             // 10cd2..10cdd
  F.Behind_Sprite_Clip_2106f(soundMenu, G.doubleBuffer);             // 10ce2..10ced
  F.Erase_Sprite_Clip_211fc(gunSight, G.doubleBuffer);              // 10cf2..10cfd
  F.Behind_Sprite_Clip_2106f(gunSight, G.doubleBuffer);             // 10d02..10d0d
  F.Behind_Sprite_Clip_2106f(volumeSliders, G.doubleBuffer);             // 10d12..10d1d
  F.Behind_Sprite_Clip_2106f((sprite(volumeSliders, 1).addr), G.doubleBuffer);             // 10d22..10d2d
  F.Behind_Sprite_Clip_2106f((sprite(volumeSliders, 2).addr), G.doubleBuffer);             // 10d32..10d3d
  sprite(gunSight).currFrame = 1;                                                     // 10d42

  // 10d4c: cmp [ebp-8], 1; je 0x1121b. Busy-wait: the exit also depends on keyboard_state [0x64f08] /
  // [0x64fe8], written by the keyboard ISR Keyboard_Driver 0x22b04 (LIBRARY.md); no extra yieldCpu is added:
  // the body awaits Time_Delay(1), which always yields at least once while waiting for the BIOS tick
  // (20404_Time_Delay.js; same reasoning as 1098f_sub_1098f.js / 1128e_sub_1128e.js).
  while (done !== 1) {
    if (G.musicSamplesEnabled !== 0) {                                          // 10d56: cmp; je 10d6b
      sprite(soundMenu).currFrame = 0;                                                 // 10d5f
    } else {
      sprite(soundMenu).currFrame = 1;                                                 // 10d6b
    }
    F.cycleRastaColors_14fba();                                               // 10d75
    F.Squeeze_Mouse_230df(3, mouseX, mouseY, mouseButtons);         // 10d7a..10d8e (result not read)
    sprite(gunSight).x = ((G.mouseX >> 1) - 0x10) | 0;                    // 10d93..10d9d: sar eax,1; sub eax,0x10
    sprite(gunSight).y = G.mouseY;                                        // 10da2..10da7

    // 10dac..10dc9
    if (G.mouseButtons === 2 || keyDown(KEY.esc) !== 0 || keyDown(KEY.space) !== 0) {
      done = 1;                                                        // 10dc9
    }
    // 10dd0..10e0e
    if (G.mouseButtons === 1 && sprite(gunSight).x > 0xab && sprite(gunSight).x < 0xb4 &&
        sprite(gunSight).y > 0x7d && sprite(gunSight).y < 0x84) {
      done = 1;                                                        // 10e0e
    }
    // 10e15..10e4e
    if (G.mouseButtons === 1 && sprite(gunSight).x > 0x53 && sprite(gunSight).x < 0x63 &&
        sprite(gunSight).y > 0x66 && sprite(gunSight).y < 0x70 && latch === 0) {
      if (G.musicSamplesEnabled !== 0) {                                        // 10e52: cmp; je 10e67
        G.musicSamplesEnabled = 0;                                               // 10e5b
      } else {
        G.musicSamplesEnabled = 1;                                               // 10e67
      }
      F.dws_DPlay_1eff8(sndDoubleClick);                                // 10e71..10e7c (cdecl)
      latch = 1;                                                       // 10e7f
    }
    if (G.mouseButtons !== 1) {                                          // 10e86: cmp; je 10e96
      latch = 0;                                                       // 10e8f
    }

    // 10e96..10ece
    if (G.mouseButtons === 1 && sprite(gunSight).x > 0x55 && sprite(gunSight).x < 0xaf &&
        sprite(gunSight).y > 0x48 && sprite(gunSight).y < 0x52) {
      sprite(volumeSliders).x = (sprite(gunSight).x - 6) | 0;                            // 10ece..10ed6
    }
    if (sprite(volumeSliders).x > 0xaf) sprite(volumeSliders).x = 0xae;                       // 10edb..10ee7 (jle)
    if (sprite(volumeSliders).x < 0x55) sprite(volumeSliders).x = 0x56;                       // 10ef1..10efa (jge)

    // 10f04..10f3c
    if (G.mouseButtons === 1 && sprite(gunSight).x > 0x55 && sprite(gunSight).x < 0xaf &&
        sprite(gunSight).y > 0x5c && sprite(gunSight).y < 0x66) {
      sprite(volumeSliders, 1).x = (sprite(gunSight).x - 6) | 0;                            // 10f3c..10f44
    }
    if (sprite(volumeSliders, 1).x > 0xaf) sprite(volumeSliders, 1).x = 0xae;                       // 10f49..10f55
    if (sprite(volumeSliders, 1).x < 0x55) sprite(volumeSliders, 1).x = 0x56;                       // 10f5f..10f68

    // 10f72..10faa
    if (G.mouseButtons === 1 && sprite(gunSight).x > 0x55 && sprite(gunSight).x < 0xaf &&
        sprite(gunSight).y > 0x70 && sprite(gunSight).y < 0x7a) {
      sprite(volumeSliders, 2).x = (sprite(gunSight).x - 6) | 0;                            // 10faa..10fb2
    }
    if (sprite(volumeSliders, 2).x > 0xaf) sprite(volumeSliders, 2).x = 0xae;                       // 10fb7..10fc3
    if (sprite(volumeSliders, 2).x < 0x55) sprite(volumeSliders, 2).x = 0x56;                       // 10fcd..10fd6

    // 10fe0..10ff0: mov ax, word [0x45744]; sub eax,0x55; add eax,eax; add eax,0x4a; mov word [0x60f0e], ax
    // (only AX is stored, so the upper EAX bits left from before do not matter)
    G.sfxVolume = (R16(volumeSliders) - 0x55) * 2 + 0x4a;
    if (sprite(volumeSliders).x < 0x5a) G.sfxVolume = 0;                          // 10ff6..10fff
    if (sprite(volumeSliders).x > 0xaa) G.sfxVolume = 0xff;                       // 11008..11014

    G.musicVolume = (R16((volumeSliders + 1 * SPRITE.SIZE)) - 0x55) * 2 + 0x4a;                    // 1101d..1102d
    if (sprite(volumeSliders, 1).x < 0x5a) G.musicVolume = 0;                          // 11033..1103c
    if (sprite(volumeSliders, 1).x > 0xaa) G.musicVolume = 0xff;                       // 11045..11051
    if (G.musicVolume < 0x96) {                                         // 1105a..11067 (zero-extended word, jge)
      G.musicSamplesEnabled = 0;                                                 // 11069
    }

    G.masterVolume = (R16((volumeSliders + 2 * SPRITE.SIZE)) - 0x55) * 2 + 0x4a;                    // 11073..11083
    if (sprite(volumeSliders, 2).x < 0x5a) G.masterVolume = 0;                          // 11089..11092
    if (sprite(volumeSliders, 2).x > 0xaa) G.masterVolume = 0xff;                       // 1109b..110a7

    F.dws_XDig_1ef64(G.sfxVolume);                              // 110b0..110be (cdecl)
    F.dws_XMusic_1eed0(G.musicVolume);                            // 110c1..110cf (cdecl)
    F.dws_XMaster_1ee3c(G.masterVolume);                           // 110d2..110e0 (cdecl)
    F.dws_DSoundStatus_1f348(dplay(sndYaMon).soundnum, soundStatus);             // 110e3..110f7 (cdecl)
    if (G.soundStatus === 0) {                                          // 110fa: cmp word; jne 11112
      F.dws_DPlay_1eff8(sndYaMon);                                // 11104..1110f (cdecl)
    }

    F.Erase_Sprite_Clip_211fc(gunSight, G.doubleBuffer);            // 11112..1111d
    F.Erase_Sprite_Clip_211fc(volumeSliders, G.doubleBuffer);            // 11122..1112d
    F.Erase_Sprite_Clip_211fc((sprite(volumeSliders, 1).addr), G.doubleBuffer);            // 11132..1113d
    F.Erase_Sprite_Clip_211fc((sprite(volumeSliders, 2).addr), G.doubleBuffer);            // 11142..1114d
    F.Behind_Sprite_Clip_2106f(gunSight, G.doubleBuffer);           // 11152..1115d
    F.Behind_Sprite_Clip_2106f(volumeSliders, G.doubleBuffer);           // 11162..1116d
    F.Behind_Sprite_Clip_2106f((sprite(volumeSliders, 1).addr), G.doubleBuffer);           // 11172..1117d
    F.Behind_Sprite_Clip_2106f((sprite(volumeSliders, 2).addr), G.doubleBuffer);           // 11182..1118d
    F.Draw_Sprite_Clip_212c0(soundMenu, G.doubleBuffer, 1);          // 11192..111a2
    F.Draw_Sprite_Clip_212c0(volumeSliders, G.doubleBuffer, 1);          // 111a7..111b7
    F.Draw_Sprite_Clip_212c0((sprite(volumeSliders, 1).addr), G.doubleBuffer, 1);          // 111bc..111cc
    F.Draw_Sprite_Clip_212c0((sprite(volumeSliders, 2).addr), G.doubleBuffer, 1);          // 111d1..111e1
    F.Draw_Sprite_Clip_212c0(gunSight, G.doubleBuffer, 1);          // 111e6..111f6
    F.Show_Double_Buffer_21531(G.doubleBuffer, 0);                 // 111fb..11202
    F.updateMusic_10050();                                               // 11207
    await F.Time_Delay_20404(1);                                       // 1120c..11211
  }                                                                    // 11216: jmp 0x10d4c

  sprite(gunSight).currFrame = 0;                                                     // 1121b
  F.Erase_Sprite_Clip_211fc(gunSight, G.doubleBuffer);              // 11225..11230
  F.Erase_Sprite_Clip_211fc(volumeSliders, G.doubleBuffer);              // 11235..11240
  F.Erase_Sprite_Clip_211fc((sprite(volumeSliders, 1).addr), G.doubleBuffer);              // 11245..11250
  F.Erase_Sprite_Clip_211fc((sprite(volumeSliders, 2).addr), G.doubleBuffer);              // 11255..11260
  F.Erase_Sprite_Clip_211fc(soundMenu, G.doubleBuffer);              // 11265..11270
  F.Behind_Sprite_Clip_2106f(gunSight, G.doubleBuffer);             // 11275..11280
});
