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
import { DPLAY, IDEAL, MPLAY, musicTrack0, musicTrack0Data, musicTrack1, musicTrack10, musicTrack10Data, musicTrack1Data, musicTrack2, musicTrack2Data, musicTrack3, musicTrack3Data, musicTrack4, musicTrack4Data, musicTrack5, musicTrack5Data, musicTrack6, musicTrack6Data, musicTrack7, musicTrack7Data, musicTrack8, musicTrack8Data, musicTrack9, musicTrack9Data, sndAutomatic, sndAutomaticData, sndBong, sndBongBlow, sndBongBlowData, sndBongBubble, sndBongBubbleData, sndBongData, sndBongDeath, sndBongDeathData, sndChopper, sndChopperData, sndClick, sndClickData, sndGameOver, sndGameOverData, sndIdeal, sndLogo, sndLogoData, sndMissile, sndMissileData, sndNuke, sndNukeData, sndParaDie1, sndParaDie1Data, sndParaDie2, sndParaDie2Data, sndParaDie3, sndParaDie3Data, sndParaDie5, sndParaDie5Data, sndPdie4, sndPdie4Data, sndProtect, sndProtectData, sndRastaRocket, sndRastaRocketData } from '../data.js';

export function loadMusicAndSounds() {
  F.Load_File_232fb(0x3029f /* "f0.dwm" bytes 66302e64776d00 */, musicTrack0Data);                // 1bed0..1beda
  W32(musicTrack0, R32(musicTrack0Data));                                                                   // 1bedf..1bee4
  W16((musicTrack0 + MPLAY.count), 1);                                                                              // 1bee9
  F.Load_File_232fb(0x302a6 /* "f1.dwm" bytes 66312e64776d00 */, musicTrack1Data);                // 1bef2..1befc
  W32(musicTrack1, R32(musicTrack1Data));                                                                   // 1bf01..1bf06
  W16((musicTrack1 + MPLAY.count), 1);                                                                              // 1bf0b
  F.Load_File_232fb(0x302ad /* "f2.dwm" bytes 66322e64776d00 */, musicTrack2Data);                // 1bf14..1bf1e
  W32(musicTrack2, R32(musicTrack2Data));                                                                   // 1bf23..1bf28
  W16((musicTrack2 + MPLAY.count), 1);                                                                              // 1bf2d
  F.Load_File_232fb(0x302b4 /* "f3.dwm" bytes 66332e64776d00 */, musicTrack3Data);                // 1bf36..1bf40
  W32(musicTrack3, R32(musicTrack3Data));                                                                   // 1bf45..1bf4a
  W16((musicTrack3 + MPLAY.count), 1);                                                                              // 1bf4f
  F.Load_File_232fb(0x302bb /* "f4.dwm" bytes 66342e64776d00 */, musicTrack4Data);                // 1bf58..1bf62
  W32(musicTrack4, R32(musicTrack4Data));                                                                   // 1bf67..1bf6c
  W16((musicTrack4 + MPLAY.count), 1);                                                                              // 1bf71
  F.Load_File_232fb(0x302c2 /* "f5.dwm" bytes 66352e64776d00 */, musicTrack5Data);                // 1bf7a..1bf84
  W32(musicTrack5, R32(musicTrack5Data));                                                                   // 1bf89..1bf8e
  W16((musicTrack5 + MPLAY.count), 1);                                                                              // 1bf93
  F.Load_File_232fb(0x302c9 /* "f6.dwm" bytes 66362e64776d00 */, musicTrack6Data);                // 1bf9c..1bfa6
  W32(musicTrack6, R32(musicTrack6Data));                                                                   // 1bfab..1bfb0
  W16((musicTrack6 + MPLAY.count), 1);                                                                              // 1bfb5
  F.Load_File_232fb(0x302d0 /* "f7.dwm" bytes 66372e64776d00 */, musicTrack7Data);                // 1bfbe..1bfc8
  W32(musicTrack7, R32(musicTrack7Data));                                                                   // 1bfcd..1bfd2
  W16((musicTrack7 + MPLAY.count), 1);                                                                              // 1bfd7
  F.Load_File_232fb(0x302d7 /* "f8.dwm" bytes 66382e64776d00 */, musicTrack8Data);                // 1bfe0..1bfea
  W32(musicTrack8, R32(musicTrack8Data));                                                                   // 1bfef..1bff4
  W16((musicTrack8 + MPLAY.count), 1);                                                                              // 1bff9
  F.Load_File_232fb(0x302de /* "f9.dwm" bytes 66392e64776d00 */, musicTrack9Data);                // 1c002..1c00c
  W32(musicTrack9, R32(musicTrack9Data));                                                                   // 1c011..1c016
  W16((musicTrack9 + MPLAY.count), 1);                                                                              // 1c01b
  F.Load_File_232fb(0x302e5 /* "f10.dwm" bytes 6631302e64776d00 */, musicTrack10Data);             // 1c024..1c02e
  W32(musicTrack10, R32(musicTrack10Data));                                                                   // 1c033..1c038
  W16((musicTrack10 + MPLAY.count), 1);                                                                              // 1c03d
  F.Load_File_232fb(0x302ed /* "gameover.dwd" bytes 67616d656f7665722e64776400 */, sndGameOverData);// 1c046..1c050
  W32(sndGameOver, R32(sndGameOverData));                                                                   // 1c055..1c05a
  W16((sndGameOver + DPLAY.count), 1);                                                                              // 1c05f
  W16((sndGameOver + DPLAY.priority), 0x384);                                                                          // 1c068
  W16((sndGameOver + DPLAY.presnd), 0);                                                                              // 1c071
  F.dws_DGetRateFromDWD_1f5b3(R32(sndGameOver), (sndIdeal + IDEAL.digitalRate));                                     // 1c07a..1c08b cdecl, pushes 0x61044 then [0x61360]
  F.dws_DSetRate_1f3c3(R16((sndIdeal + IDEAL.digitalRate)));                                                     // 1c08e..1c09c cdecl; xor eax,eax; mov ax,[0x61044] (zero-extended word)
  F.Load_File_232fb(0x302fa /* "click.dwd" bytes 636c69636b2e64776400 */, sndClickData);       // 1c09f..1c0a9
  W32(sndClick, R32(sndClickData));                                                                   // 1c0ae..1c0b3
  W16((sndClick + DPLAY.count), 1);                                                                              // 1c0b8
  W16((sndClick + DPLAY.priority), 0x1f4);                                                                          // 1c0c1
  W16((sndClick + DPLAY.presnd), 0);                                                                              // 1c0ca
  F.dws_DGetRateFromDWD_1f5b3(R32(sndClick), (sndIdeal + IDEAL.digitalRate));                                     // 1c0d3..1c0e4 cdecl, pushes 0x61044 then [0x61160]
  F.Load_File_232fb(0x30304 /* "Undlogo.dwd" bytes 556e646c6f676f2e64776400 */, sndLogoData); // 1c0e7..1c0f1
  W32(sndLogo, R32(sndLogoData));                                                                   // 1c0f6..1c0fb
  W16((sndLogo + DPLAY.count), 1);                                                                              // 1c100
  W16((sndLogo + DPLAY.priority), 0x1f4);                                                                          // 1c109
  W16((sndLogo + DPLAY.presnd), 0);                                                                              // 1c112
  F.dws_DGetRateFromDWD_1f5b3(R32(sndLogo), (sndIdeal + IDEAL.digitalRate));                                     // 1c11b..1c12c cdecl, pushes 0x61044 then [0x613c0]
  F.Load_File_232fb(0x30310 /* "missle.dwd" bytes 6d6973736c652e64776400 */, sndMissileData);    // 1c12f..1c139
  W32(sndMissile, R32(sndMissileData));                                                                   // 1c13e..1c143
  W16((sndMissile + DPLAY.count), 1);                                                                              // 1c148
  W16((sndMissile + DPLAY.priority), 0x1f4);                                                                          // 1c151
  W16((sndMissile + DPLAY.presnd), 0);                                                                              // 1c15a
  F.dws_DGetRateFromDWD_1f5b3(R32(sndMissile), (sndIdeal + IDEAL.digitalRate));                                     // 1c163..1c174 cdecl, pushes 0x61044 then [0x613a0]
  F.Load_File_232fb(0x3031b /* "chopper.dwd" bytes 63686f707065722e64776400 */, sndChopperData); // 1c177..1c181
  W32(sndChopper, R32(sndChopperData));                                                                   // 1c186..1c18b
  W16((sndChopper + DPLAY.count), 1);                                                                              // 1c190
  W16((sndChopper + DPLAY.priority), 0x12c);                                                                          // 1c199
  W16((sndChopper + DPLAY.presnd), 0);                                                                              // 1c1a2
  F.dws_DGetRateFromDWD_1f5b3(R32(sndChopper), (sndIdeal + IDEAL.digitalRate));                                     // 1c1ab..1c1bc cdecl, pushes 0x61044 then [0x61240]
  F.Load_File_232fb(0x30327 /* "protect.dwd" bytes 70726f746563742e64776400 */, sndProtectData); // 1c1bf..1c1c9
  W32(sndProtect, R32(sndProtectData));                                                                   // 1c1ce..1c1d3
  W16((sndProtect + DPLAY.count), 1);                                                                              // 1c1d8
  W16((sndProtect + DPLAY.priority), 0x258);                                                                          // 1c1e1
  W16((sndProtect + DPLAY.presnd), 0);                                                                              // 1c1ea
  F.dws_DGetRateFromDWD_1f5b3(R32(sndProtect), (sndIdeal + IDEAL.digitalRate));                                     // 1c1f3..1c204 cdecl, pushes 0x61044 then [0x61380]
  F.Load_File_232fb(0x30333 /* "nuke.dwd" bytes 6e756b652e64776400 */, sndNukeData);          // 1c207..1c211
  W32(sndNuke, R32(sndNukeData));                                                                   // 1c216..1c21b
  W16((sndNuke + DPLAY.count), 1);                                                                              // 1c220
  W16((sndNuke + DPLAY.priority), 0x384);                                                                          // 1c229
  W16((sndNuke + DPLAY.presnd), 0);                                                                              // 1c232
  F.dws_DGetRateFromDWD_1f5b3(R32(sndNuke), (sndIdeal + IDEAL.digitalRate));                                     // 1c23b..1c24c cdecl, pushes 0x61044 then [0x614a0]
  F.Load_File_232fb(0x3033c /* "bongbub.dwd" bytes 626f6e676275622e64776400 */, sndBongBubbleData); // 1c24f..1c259
  W32(sndBongBubble, R32(sndBongBubbleData));                                                                   // 1c25e..1c263
  W16((sndBongBubble + DPLAY.count), 1);                                                                              // 1c268
  W16((sndBongBubble + DPLAY.priority), 0x258);                                                                          // 1c271
  W16((sndBongBubble + DPLAY.presnd), 0);                                                                              // 1c27a
  F.dws_DGetRateFromDWD_1f5b3(R32(sndBongBubble), (sndIdeal + IDEAL.digitalRate));                                     // 1c283..1c294 cdecl, pushes 0x61044 then [0x613e0]
  F.Load_File_232fb(0x30348 /* "bongblow.dwd" bytes 626f6e67626c6f772e64776400 */, sndBongBlowData);// 1c297..1c2a1
  W32(sndBongBlow, R32(sndBongBlowData));                                                                   // 1c2a6..1c2ab
  W16((sndBongBlow + DPLAY.count), 1);                                                                              // 1c2b0
  W16((sndBongBlow + DPLAY.priority), 0x258);                                                                          // 1c2b9
  W16((sndBongBlow + DPLAY.presnd), 0);                                                                              // 1c2c2
  F.dws_DGetRateFromDWD_1f5b3(R32(sndBongBlow), (sndIdeal + IDEAL.digitalRate));                                     // 1c2cb..1c2dc cdecl, pushes 0x61044 then [0x61400]
  F.Load_File_232fb(0x30355 /* "bong.dwd" bytes 626f6e672e64776400 */, sndBongData);          // 1c2df..1c2e9
  W32(sndBong, R32(sndBongData));                                                                   // 1c2ee..1c2f3
  W16((sndBong + DPLAY.count), 1);                                                                              // 1c2f8
  W16((sndBong + DPLAY.priority), 0x258);                                                                          // 1c301
  W16((sndBong + DPLAY.presnd), 0);                                                                              // 1c30a
  F.dws_DGetRateFromDWD_1f5b3(R32(sndBong), (sndIdeal + IDEAL.digitalRate));                                     // 1c313..1c324 cdecl, pushes 0x61044 then [0x61420]
  F.Load_File_232fb(0x3035e /* "rastarok.dwd" bytes 7261737461726f6b2e64776400 */, sndRastaRocketData);// 1c327..1c331
  W32(sndRastaRocket, R32(sndRastaRocketData));                                                                   // 1c336..1c33b
  W16((sndRastaRocket + DPLAY.count), 1);                                                                              // 1c340
  W16((sndRastaRocket + DPLAY.priority), 0x320);                                                                          // 1c349
  W16((sndRastaRocket + DPLAY.presnd), 0);                                                                              // 1c352
  F.dws_DGetRateFromDWD_1f5b3(R32(sndRastaRocket), (sndIdeal + IDEAL.digitalRate));                                     // 1c35b..1c36c cdecl, pushes 0x61044 then [0x61460]
  F.Load_File_232fb(0x3036b /* "bongdth.dwd" bytes 626f6e676474682e64776400 */, sndBongDeathData); // 1c36f..1c379
  W32(sndBongDeath, R32(sndBongDeathData));                                                                   // 1c37e..1c383
  W16((sndBongDeath + DPLAY.count), 1);                                                                              // 1c388
  W16((sndBongDeath + DPLAY.priority), 0x258);                                                                          // 1c391
  W16((sndBongDeath + DPLAY.presnd), 0);                                                                              // 1c39a
  F.dws_DGetRateFromDWD_1f5b3(R32(sndBongDeath), (sndIdeal + IDEAL.digitalRate));                                     // 1c3a3..1c3b4 cdecl, pushes 0x61044 then [0x61480]
  F.Load_File_232fb(0x30377 /* "automan.dwd" bytes 6175746f6d616e2e64776400 */, sndAutomaticData); // 1c3b7..1c3c1
  W32(sndAutomatic, R32(sndAutomaticData));                                                                   // 1c3c6..1c3cb
  W16((sndAutomatic + DPLAY.count), 1);                                                                              // 1c3d0
  W16((sndAutomatic + DPLAY.priority), 0x258);                                                                          // 1c3d9
  W16((sndAutomatic + DPLAY.presnd), 0);                                                                              // 1c3e2
  F.dws_DGetRateFromDWD_1f5b3(R32(sndAutomatic), (sndIdeal + IDEAL.digitalRate));                                     // 1c3eb..1c3fc cdecl, pushes 0x61044 then [0x61440]
  F.Load_File_232fb(0x30383 /* "pdie1.dwd" bytes 70646965312e64776400 */, sndParaDie1Data);       // 1c3ff..1c409
  W32(sndParaDie1, R32(sndParaDie1Data));                                                                   // 1c40e..1c413
  W16((sndParaDie1 + DPLAY.count), 1);                                                                              // 1c418
  W16((sndParaDie1 + DPLAY.priority), 0x258);                                                                          // 1c421
  W16((sndParaDie1 + DPLAY.presnd), 0);                                                                              // 1c42a
  F.dws_DGetRateFromDWD_1f5b3(R32(sndParaDie1), (sndIdeal + IDEAL.digitalRate));                                     // 1c433..1c444 cdecl, pushes 0x61044 then [0x612a0]
  F.Load_File_232fb(0x3038d /* "pdie2.dwd" bytes 70646965322e64776400 */, sndParaDie2Data);       // 1c447..1c451
  W32(sndParaDie2, R32(sndParaDie2Data));                                                                   // 1c456..1c45b
  W16((sndParaDie2 + DPLAY.count), 1);                                                                              // 1c460
  W16((sndParaDie2 + DPLAY.priority), 0x258);                                                                          // 1c469
  W16((sndParaDie2 + DPLAY.presnd), 0);                                                                              // 1c472
  F.dws_DGetRateFromDWD_1f5b3(R32(sndParaDie2), (sndIdeal + IDEAL.digitalRate));                                     // 1c47b..1c48c cdecl, pushes 0x61044 then [0x612c0]
  F.Load_File_232fb(0x30397 /* "pdie3.dwd" bytes 70646965332e64776400 */, sndParaDie3Data);       // 1c48f..1c499
  W32(sndParaDie3, R32(sndParaDie3Data));                                                                   // 1c49e..1c4a3
  W16((sndParaDie3 + DPLAY.count), 1);                                                                              // 1c4a8
  W16((sndParaDie3 + DPLAY.priority), 0x258);                                                                          // 1c4b1
  W16((sndParaDie3 + DPLAY.presnd), 0);                                                                              // 1c4ba
  F.dws_DGetRateFromDWD_1f5b3(R32(sndParaDie3), (sndIdeal + IDEAL.digitalRate));                                     // 1c4c3..1c4d4 cdecl, pushes 0x61044 then [0x612e0]
  F.Load_File_232fb(0x303a1 /* "pdie4.dwd" bytes 70646965342e64776400 */, sndPdie4Data);       // 1c4d7..1c4e1
  W32(sndPdie4, R32(sndPdie4Data));                                                                   // 1c4e6..1c4eb
  W16((sndPdie4 + DPLAY.count), 1);                                                                              // 1c4f0
  W16((sndPdie4 + DPLAY.priority), 0x258);                                                                          // 1c4f9
  W16((sndPdie4 + DPLAY.presnd), 0);                                                                              // 1c502
  F.dws_DGetRateFromDWD_1f5b3(R32(sndPdie4), (sndIdeal + IDEAL.digitalRate));                                     // 1c50b..1c51c cdecl, pushes 0x61044 then [0x61300]
  F.Load_File_232fb(0x303ab /* "pdie5.dwd" bytes 70646965352e64776400 */, sndParaDie5Data);       // 1c51f..1c529
  W32(sndParaDie5, R32(sndParaDie5Data));                                                                   // 1c52e..1c533
  W16((sndParaDie5 + DPLAY.count), 1);                                                                              // 1c538
  W16((sndParaDie5 + DPLAY.priority), 0x12c);                                                                          // 1c541
  W16((sndParaDie5 + DPLAY.presnd), 0);                                                                              // 1c54a
  F.dws_DGetRateFromDWD_1f5b3(R32(sndParaDie5), (sndIdeal + IDEAL.digitalRate));                                     // 1c553..1c564 cdecl, pushes 0x61044 then [0x61320]
} // 0x1c567: single exit (falls through to I6)
