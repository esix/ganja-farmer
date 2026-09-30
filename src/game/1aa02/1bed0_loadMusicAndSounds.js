// Chunk I5 of main (0x1aa02): range [0x1bed0, 0x1c567), straight line (no branches, no loops).
// Entry 0x1bed0, single exit 0x1c567 (falls through to chunk I6, loadMoreSoundsAndShowLogos.js).
// No live registers/locals at either end (MAIN_PLAN.md §2); uses no frame slot.
// Callees: Load_File 0x232fb x29 (Watcom EAX=name, EDX=out; its EAX result is never read here),
//          dws_DGetRateFromDWD 0x1f5b3 x18 (cdecl: `push 0x61044` then `push [struct]`, so args are
//          (snd = [struct], rate = 0x61044); `add esp, 8`), dws_DSetRate 0x1f3c3 x1 (cdecl, 1 arg, `add esp, 4`).
// Pattern of each group: Load_File("<name>", &G); [S] = [G]; word stores into S.
//   0x610a0/0x61070/0x61080/0x61090/0x610b0..0x61110 (stride 0x10): dws_MPLAY structs (LIBRARY.md): +0 track,
//     +4 count = 1. Loaded from the f*.dwm files.
//   0x61160, 0x61240, 0x612a0.., 0x61360, 0x61380, 0x613a0, 0x613c0.. (stride 0x20): dws_DPLAY structs
//     (LIBRARY.md): +0 snd, +4 count = 1, +6 priority, +8 presnd = 0. Loaded from the *.dwd files.
//   0x61044 = dws_IDEAL +4, reused as the `rate` output of dws_DGetRateFromDWD (LIBRARY.md).
// String arguments: address, text, and the bytes read from re/unpacked/flat.bin (NUL included).
// Each line cites the instruction(s) it comes from.
import { F } from '../../runtime/registry.js';
import { R16, R32, W16, W32 } from '../../runtime/mem.js';
import { IDEAL, musicTrack0, musicTrack0Data, musicTrack1, musicTrack10, musicTrack10Data, musicTrack1Data, musicTrack2, musicTrack2Data, musicTrack3, musicTrack3Data, musicTrack4, musicTrack4Data, musicTrack5, musicTrack5Data, musicTrack6, musicTrack6Data, musicTrack7, musicTrack7Data, musicTrack8, musicTrack8Data, musicTrack9, musicTrack9Data, sndAutomatic, sndAutomaticData, sndBong, sndBongBlow, sndBongBlowData, sndBongBubble, sndBongBubbleData, sndBongData, sndBongDeath, sndBongDeathData, sndChopper, sndChopperData, sndClick, sndClickData, sndGameOver, sndGameOverData, sndIdeal, sndLogo, sndLogoData, sndMissile, sndMissileData, sndNuke, sndNukeData, sndParaDie1, sndParaDie1Data, sndParaDie2, sndParaDie2Data, sndParaDie3, sndParaDie3Data, sndParaDie5, sndParaDie5Data, sndPdie4, sndPdie4Data, sndProtect, sndProtectData, sndRastaRocket, sndRastaRocketData } from '../data.js';
import { G, dplay, ideal, mplay } from '../access.js';

export function loadMusicAndSounds() {
  F.Load_File_232fb(0x3029f /* "f0.dwm" bytes 66302e64776d00 */, musicTrack0Data);                // 1bed0..1beda
  mplay(musicTrack0).track = G.musicTrack0Data;                                                                   // 1bedf..1bee4
  mplay(musicTrack0).count = 1;                                                                              // 1bee9
  F.Load_File_232fb(0x302a6 /* "f1.dwm" bytes 66312e64776d00 */, musicTrack1Data);                // 1bef2..1befc
  mplay(musicTrack1).track = G.musicTrack1Data;                                                                   // 1bf01..1bf06
  mplay(musicTrack1).count = 1;                                                                              // 1bf0b
  F.Load_File_232fb(0x302ad /* "f2.dwm" bytes 66322e64776d00 */, musicTrack2Data);                // 1bf14..1bf1e
  mplay(musicTrack2).track = G.musicTrack2Data;                                                                   // 1bf23..1bf28
  mplay(musicTrack2).count = 1;                                                                              // 1bf2d
  F.Load_File_232fb(0x302b4 /* "f3.dwm" bytes 66332e64776d00 */, musicTrack3Data);                // 1bf36..1bf40
  mplay(musicTrack3).track = G.musicTrack3Data;                                                                   // 1bf45..1bf4a
  mplay(musicTrack3).count = 1;                                                                              // 1bf4f
  F.Load_File_232fb(0x302bb /* "f4.dwm" bytes 66342e64776d00 */, musicTrack4Data);                // 1bf58..1bf62
  mplay(musicTrack4).track = G.musicTrack4Data;                                                                   // 1bf67..1bf6c
  mplay(musicTrack4).count = 1;                                                                              // 1bf71
  F.Load_File_232fb(0x302c2 /* "f5.dwm" bytes 66352e64776d00 */, musicTrack5Data);                // 1bf7a..1bf84
  mplay(musicTrack5).track = G.musicTrack5Data;                                                                   // 1bf89..1bf8e
  mplay(musicTrack5).count = 1;                                                                              // 1bf93
  F.Load_File_232fb(0x302c9 /* "f6.dwm" bytes 66362e64776d00 */, musicTrack6Data);                // 1bf9c..1bfa6
  mplay(musicTrack6).track = G.musicTrack6Data;                                                                   // 1bfab..1bfb0
  mplay(musicTrack6).count = 1;                                                                              // 1bfb5
  F.Load_File_232fb(0x302d0 /* "f7.dwm" bytes 66372e64776d00 */, musicTrack7Data);                // 1bfbe..1bfc8
  mplay(musicTrack7).track = G.musicTrack7Data;                                                                   // 1bfcd..1bfd2
  mplay(musicTrack7).count = 1;                                                                              // 1bfd7
  F.Load_File_232fb(0x302d7 /* "f8.dwm" bytes 66382e64776d00 */, musicTrack8Data);                // 1bfe0..1bfea
  mplay(musicTrack8).track = G.musicTrack8Data;                                                                   // 1bfef..1bff4
  mplay(musicTrack8).count = 1;                                                                              // 1bff9
  F.Load_File_232fb(0x302de /* "f9.dwm" bytes 66392e64776d00 */, musicTrack9Data);                // 1c002..1c00c
  mplay(musicTrack9).track = G.musicTrack9Data;                                                                   // 1c011..1c016
  mplay(musicTrack9).count = 1;                                                                              // 1c01b
  F.Load_File_232fb(0x302e5 /* "f10.dwm" bytes 6631302e64776d00 */, musicTrack10Data);             // 1c024..1c02e
  mplay(musicTrack10).track = G.musicTrack10Data;                                                                   // 1c033..1c038
  mplay(musicTrack10).count = 1;                                                                              // 1c03d
  F.Load_File_232fb(0x302ed /* "gameover.dwd" bytes 67616d656f7665722e64776400 */, sndGameOverData);// 1c046..1c050
  dplay(sndGameOver).snd = G.sndGameOverData;                                                                   // 1c055..1c05a
  dplay(sndGameOver).count = 1;                                                                              // 1c05f
  dplay(sndGameOver).priority = 0x384;                                                                          // 1c068
  dplay(sndGameOver).presnd = 0;                                                                              // 1c071
  F.dws_DGetRateFromDWD_1f5b3(dplay(sndGameOver).snd, (sndIdeal + IDEAL.digitalRate));                                     // 1c07a..1c08b cdecl, pushes 0x61044 then [0x61360]
  F.dws_DSetRate_1f3c3(ideal(sndIdeal).digitalRate);                                                     // 1c08e..1c09c cdecl; xor eax,eax; mov ax,[0x61044] (zero-extended word)
  F.Load_File_232fb(0x302fa /* "click.dwd" bytes 636c69636b2e64776400 */, sndClickData);       // 1c09f..1c0a9
  dplay(sndClick).snd = G.sndClickData;                                                                   // 1c0ae..1c0b3
  dplay(sndClick).count = 1;                                                                              // 1c0b8
  dplay(sndClick).priority = 0x1f4;                                                                          // 1c0c1
  dplay(sndClick).presnd = 0;                                                                              // 1c0ca
  F.dws_DGetRateFromDWD_1f5b3(dplay(sndClick).snd, (sndIdeal + IDEAL.digitalRate));                                     // 1c0d3..1c0e4 cdecl, pushes 0x61044 then [0x61160]
  F.Load_File_232fb(0x30304 /* "Undlogo.dwd" bytes 556e646c6f676f2e64776400 */, sndLogoData); // 1c0e7..1c0f1
  dplay(sndLogo).snd = G.sndLogoData;                                                                   // 1c0f6..1c0fb
  dplay(sndLogo).count = 1;                                                                              // 1c100
  dplay(sndLogo).priority = 0x1f4;                                                                          // 1c109
  dplay(sndLogo).presnd = 0;                                                                              // 1c112
  F.dws_DGetRateFromDWD_1f5b3(dplay(sndLogo).snd, (sndIdeal + IDEAL.digitalRate));                                     // 1c11b..1c12c cdecl, pushes 0x61044 then [0x613c0]
  F.Load_File_232fb(0x30310 /* "missle.dwd" bytes 6d6973736c652e64776400 */, sndMissileData);    // 1c12f..1c139
  dplay(sndMissile).snd = G.sndMissileData;                                                                   // 1c13e..1c143
  dplay(sndMissile).count = 1;                                                                              // 1c148
  dplay(sndMissile).priority = 0x1f4;                                                                          // 1c151
  dplay(sndMissile).presnd = 0;                                                                              // 1c15a
  F.dws_DGetRateFromDWD_1f5b3(dplay(sndMissile).snd, (sndIdeal + IDEAL.digitalRate));                                     // 1c163..1c174 cdecl, pushes 0x61044 then [0x613a0]
  F.Load_File_232fb(0x3031b /* "chopper.dwd" bytes 63686f707065722e64776400 */, sndChopperData); // 1c177..1c181
  dplay(sndChopper).snd = G.sndChopperData;                                                                   // 1c186..1c18b
  dplay(sndChopper).count = 1;                                                                              // 1c190
  dplay(sndChopper).priority = 0x12c;                                                                          // 1c199
  dplay(sndChopper).presnd = 0;                                                                              // 1c1a2
  F.dws_DGetRateFromDWD_1f5b3(dplay(sndChopper).snd, (sndIdeal + IDEAL.digitalRate));                                     // 1c1ab..1c1bc cdecl, pushes 0x61044 then [0x61240]
  F.Load_File_232fb(0x30327 /* "protect.dwd" bytes 70726f746563742e64776400 */, sndProtectData); // 1c1bf..1c1c9
  dplay(sndProtect).snd = G.sndProtectData;                                                                   // 1c1ce..1c1d3
  dplay(sndProtect).count = 1;                                                                              // 1c1d8
  dplay(sndProtect).priority = 0x258;                                                                          // 1c1e1
  dplay(sndProtect).presnd = 0;                                                                              // 1c1ea
  F.dws_DGetRateFromDWD_1f5b3(dplay(sndProtect).snd, (sndIdeal + IDEAL.digitalRate));                                     // 1c1f3..1c204 cdecl, pushes 0x61044 then [0x61380]
  F.Load_File_232fb(0x30333 /* "nuke.dwd" bytes 6e756b652e64776400 */, sndNukeData);          // 1c207..1c211
  dplay(sndNuke).snd = G.sndNukeData;                                                                   // 1c216..1c21b
  dplay(sndNuke).count = 1;                                                                              // 1c220
  dplay(sndNuke).priority = 0x384;                                                                          // 1c229
  dplay(sndNuke).presnd = 0;                                                                              // 1c232
  F.dws_DGetRateFromDWD_1f5b3(dplay(sndNuke).snd, (sndIdeal + IDEAL.digitalRate));                                     // 1c23b..1c24c cdecl, pushes 0x61044 then [0x614a0]
  F.Load_File_232fb(0x3033c /* "bongbub.dwd" bytes 626f6e676275622e64776400 */, sndBongBubbleData); // 1c24f..1c259
  dplay(sndBongBubble).snd = G.sndBongBubbleData;                                                                   // 1c25e..1c263
  dplay(sndBongBubble).count = 1;                                                                              // 1c268
  dplay(sndBongBubble).priority = 0x258;                                                                          // 1c271
  dplay(sndBongBubble).presnd = 0;                                                                              // 1c27a
  F.dws_DGetRateFromDWD_1f5b3(dplay(sndBongBubble).snd, (sndIdeal + IDEAL.digitalRate));                                     // 1c283..1c294 cdecl, pushes 0x61044 then [0x613e0]
  F.Load_File_232fb(0x30348 /* "bongblow.dwd" bytes 626f6e67626c6f772e64776400 */, sndBongBlowData);// 1c297..1c2a1
  dplay(sndBongBlow).snd = G.sndBongBlowData;                                                                   // 1c2a6..1c2ab
  dplay(sndBongBlow).count = 1;                                                                              // 1c2b0
  dplay(sndBongBlow).priority = 0x258;                                                                          // 1c2b9
  dplay(sndBongBlow).presnd = 0;                                                                              // 1c2c2
  F.dws_DGetRateFromDWD_1f5b3(dplay(sndBongBlow).snd, (sndIdeal + IDEAL.digitalRate));                                     // 1c2cb..1c2dc cdecl, pushes 0x61044 then [0x61400]
  F.Load_File_232fb(0x30355 /* "bong.dwd" bytes 626f6e672e64776400 */, sndBongData);          // 1c2df..1c2e9
  dplay(sndBong).snd = G.sndBongData;                                                                   // 1c2ee..1c2f3
  dplay(sndBong).count = 1;                                                                              // 1c2f8
  dplay(sndBong).priority = 0x258;                                                                          // 1c301
  dplay(sndBong).presnd = 0;                                                                              // 1c30a
  F.dws_DGetRateFromDWD_1f5b3(dplay(sndBong).snd, (sndIdeal + IDEAL.digitalRate));                                     // 1c313..1c324 cdecl, pushes 0x61044 then [0x61420]
  F.Load_File_232fb(0x3035e /* "rastarok.dwd" bytes 7261737461726f6b2e64776400 */, sndRastaRocketData);// 1c327..1c331
  dplay(sndRastaRocket).snd = G.sndRastaRocketData;                                                                   // 1c336..1c33b
  dplay(sndRastaRocket).count = 1;                                                                              // 1c340
  dplay(sndRastaRocket).priority = 0x320;                                                                          // 1c349
  dplay(sndRastaRocket).presnd = 0;                                                                              // 1c352
  F.dws_DGetRateFromDWD_1f5b3(dplay(sndRastaRocket).snd, (sndIdeal + IDEAL.digitalRate));                                     // 1c35b..1c36c cdecl, pushes 0x61044 then [0x61460]
  F.Load_File_232fb(0x3036b /* "bongdth.dwd" bytes 626f6e676474682e64776400 */, sndBongDeathData); // 1c36f..1c379
  dplay(sndBongDeath).snd = G.sndBongDeathData;                                                                   // 1c37e..1c383
  dplay(sndBongDeath).count = 1;                                                                              // 1c388
  dplay(sndBongDeath).priority = 0x258;                                                                          // 1c391
  dplay(sndBongDeath).presnd = 0;                                                                              // 1c39a
  F.dws_DGetRateFromDWD_1f5b3(dplay(sndBongDeath).snd, (sndIdeal + IDEAL.digitalRate));                                     // 1c3a3..1c3b4 cdecl, pushes 0x61044 then [0x61480]
  F.Load_File_232fb(0x30377 /* "automan.dwd" bytes 6175746f6d616e2e64776400 */, sndAutomaticData); // 1c3b7..1c3c1
  dplay(sndAutomatic).snd = G.sndAutomaticData;                                                                   // 1c3c6..1c3cb
  dplay(sndAutomatic).count = 1;                                                                              // 1c3d0
  dplay(sndAutomatic).priority = 0x258;                                                                          // 1c3d9
  dplay(sndAutomatic).presnd = 0;                                                                              // 1c3e2
  F.dws_DGetRateFromDWD_1f5b3(dplay(sndAutomatic).snd, (sndIdeal + IDEAL.digitalRate));                                     // 1c3eb..1c3fc cdecl, pushes 0x61044 then [0x61440]
  F.Load_File_232fb(0x30383 /* "pdie1.dwd" bytes 70646965312e64776400 */, sndParaDie1Data);       // 1c3ff..1c409
  dplay(sndParaDie1).snd = G.sndParaDie1Data;                                                                   // 1c40e..1c413
  dplay(sndParaDie1).count = 1;                                                                              // 1c418
  dplay(sndParaDie1).priority = 0x258;                                                                          // 1c421
  dplay(sndParaDie1).presnd = 0;                                                                              // 1c42a
  F.dws_DGetRateFromDWD_1f5b3(dplay(sndParaDie1).snd, (sndIdeal + IDEAL.digitalRate));                                     // 1c433..1c444 cdecl, pushes 0x61044 then [0x612a0]
  F.Load_File_232fb(0x3038d /* "pdie2.dwd" bytes 70646965322e64776400 */, sndParaDie2Data);       // 1c447..1c451
  dplay(sndParaDie2).snd = G.sndParaDie2Data;                                                                   // 1c456..1c45b
  dplay(sndParaDie2).count = 1;                                                                              // 1c460
  dplay(sndParaDie2).priority = 0x258;                                                                          // 1c469
  dplay(sndParaDie2).presnd = 0;                                                                              // 1c472
  F.dws_DGetRateFromDWD_1f5b3(dplay(sndParaDie2).snd, (sndIdeal + IDEAL.digitalRate));                                     // 1c47b..1c48c cdecl, pushes 0x61044 then [0x612c0]
  F.Load_File_232fb(0x30397 /* "pdie3.dwd" bytes 70646965332e64776400 */, sndParaDie3Data);       // 1c48f..1c499
  dplay(sndParaDie3).snd = G.sndParaDie3Data;                                                                   // 1c49e..1c4a3
  dplay(sndParaDie3).count = 1;                                                                              // 1c4a8
  dplay(sndParaDie3).priority = 0x258;                                                                          // 1c4b1
  dplay(sndParaDie3).presnd = 0;                                                                              // 1c4ba
  F.dws_DGetRateFromDWD_1f5b3(dplay(sndParaDie3).snd, (sndIdeal + IDEAL.digitalRate));                                     // 1c4c3..1c4d4 cdecl, pushes 0x61044 then [0x612e0]
  F.Load_File_232fb(0x303a1 /* "pdie4.dwd" bytes 70646965342e64776400 */, sndPdie4Data);       // 1c4d7..1c4e1
  dplay(sndPdie4).snd = G.sndPdie4Data;                                                                   // 1c4e6..1c4eb
  dplay(sndPdie4).count = 1;                                                                              // 1c4f0
  dplay(sndPdie4).priority = 0x258;                                                                          // 1c4f9
  dplay(sndPdie4).presnd = 0;                                                                              // 1c502
  F.dws_DGetRateFromDWD_1f5b3(dplay(sndPdie4).snd, (sndIdeal + IDEAL.digitalRate));                                     // 1c50b..1c51c cdecl, pushes 0x61044 then [0x61300]
  F.Load_File_232fb(0x303ab /* "pdie5.dwd" bytes 70646965352e64776400 */, sndParaDie5Data);       // 1c51f..1c529
  dplay(sndParaDie5).snd = G.sndParaDie5Data;                                                                   // 1c52e..1c533
  dplay(sndParaDie5).count = 1;                                                                              // 1c538
  dplay(sndParaDie5).priority = 0x12c;                                                                          // 1c541
  dplay(sndParaDie5).presnd = 0;                                                                              // 1c54a
  F.dws_DGetRateFromDWD_1f5b3(dplay(sndParaDie5).snd, (sndIdeal + IDEAL.digitalRate));                                     // 1c553..1c564 cdecl, pushes 0x61044 then [0x61320]
} // 0x1c567: single exit (falls through to I6)
