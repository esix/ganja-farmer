// main (0x1aa02) chunk I6: range [0x1c567, 0x1cbe4), entry 0x1c567, single exit 0x1cbe4 (falls through to the
// skeleton's code at 0x1cbe4, `cmp dword [0x30be4], 0x25`). Straight-line code, no branches.
// No live registers/locals at either end (MAIN_PLAN.md §2); no frame slot is used in this chunk.
// Callees: Load_File 0x232fb x22, dws_DGetRateFromDWD 0x1f5b3 x22, dws_XMusic 0x1eed0, dws_DPlay 0x1eff8,
//          showPictureFadeIn x2, updateMusic x2, showTitleScreen.
//
// 22 groups, each (addresses in the per-line comments):
//   Load_File(name, &P)            Watcom EAX = name, EDX = &P; its EAX result is not read (next insn reloads EAX)
//   dword [S] = dword [P]          `mov eax, [P]; mov [S], eax` (re-read of P after the call)
//   word [S+4] = 1; word [S+6] = c; word [S+8] = 0
//   dws_DGetRateFromDWD([S], 0x61044)   cdecl: `push 0x61044` then `push [S]` -> first arg = [S]; `add esp, 8`
// After the groups: dws_XMusic(0xfe) (cdecl, `add esp, 4`), dws_DPlay(0x613c0) (cdecl, `add esp, 4`),
// showPictureFadeIn("xlogo.pcx", 0x3c, 0), updateMusic(), showPictureFadeIn("evilx.pcx", 0x3c, 0), updateMusic(), showTitleScreen().
// No callee's EAX is read in this chunk.
import { F } from '../../runtime/registry.js';
import { R32, W16, W32 } from '../../runtime/mem.js';
import { DPLAY, IDEAL, sndDoubleClick, sndDoubleClickData, sndExplosion, sndExplosionData, sndGetSome, sndGetSomeData, sndGunShot, sndGunShotData, sndIShot, sndIShotData, sndIdeal, sndLogo, sndMusicSample1, sndMusicSample10, sndMusicSample10Data, sndMusicSample1Data, sndMusicSample2, sndMusicSample2Data, sndMusicSample3, sndMusicSample3Data, sndMusicSample4, sndMusicSample4Data, sndMusicSample5, sndMusicSample5Data, sndMusicSample6, sndMusicSample65, sndMusicSample65Data, sndMusicSample6Data, sndMusicSample7, sndMusicSample7Data, sndMusicSample8, sndMusicSample8Data, sndMusicSample9, sndMusicSample9Data, sndParaSquish, sndParaSquishData, sndRicochet, sndRicochetData, sndSmokin, sndSmokinData, sndUfo, sndUfo2, sndUfo2Data, sndUfoData, sndYaMon, sndYaMonData } from '../data.js';

export async function loadMoreSoundsAndShowLogos() {
  // 1c567: "psquish.dwd" (0x303b5: 70 73 71 75 69 73 68 2e 64 77 64 00)
  F.Load_File_232fb(0x303b5, sndParaSquishData);   // 1c567 mov edx, 1c56c mov eax, 1c571 call (EAX result unused)
  W32(sndParaSquish, R32(sndParaSquishData));   // 1c576 mov eax,[0x60f5c]; 1c57b mov [0x61340],eax
  W16((sndParaSquish + DPLAY.count), 0x1);   // 1c580
  W16((sndParaSquish + DPLAY.priority), 0x2bc);   // 1c589
  W16((sndParaSquish + DPLAY.presnd), 0x0);   // 1c592
  F.dws_DGetRateFromDWD_1f5b3(R32(sndParaSquish), (sndIdeal + IDEAL.digitalRate));   // 1c59b/1c5a0 push 0x61044, 1c5a1 push [0x61340], 1c5a7 call, 1c5ac add esp,8

  // 1c5af: "explo.dwd" (0x303c1: 65 78 70 6c 6f 2e 64 77 64 00)
  F.Load_File_232fb(0x303c1, sndExplosionData);   // 1c5af mov edx, 1c5b4 mov eax, 1c5b9 call (EAX result unused)
  W32(sndExplosion, R32(sndExplosionData));   // 1c5be mov eax,[0x60f44]; 1c5c3 mov [0x61280],eax
  W16((sndExplosion + DPLAY.count), 0x1);   // 1c5c8
  W16((sndExplosion + DPLAY.priority), 0x320);   // 1c5d1
  W16((sndExplosion + DPLAY.presnd), 0x0);   // 1c5da
  F.dws_DGetRateFromDWD_1f5b3(R32(sndExplosion), (sndIdeal + IDEAL.digitalRate));   // 1c5e3/1c5e8 push 0x61044, 1c5e9 push [0x61280], 1c5ef call, 1c5f4 add esp,8

  // 1c5f7: "dclick.dwd" (0x303cb: 64 63 6c 69 63 6b 2e 64 77 64 00)
  F.Load_File_232fb(0x303cb, sndDoubleClickData);   // 1c5f7 mov edx, 1c5fc mov eax, 1c601 call (EAX result unused)
  W32(sndDoubleClick, R32(sndDoubleClickData));   // 1c606 mov eax,[0x60f24]; 1c60b mov [0x61180],eax
  W16((sndDoubleClick + DPLAY.count), 0x1);   // 1c610
  W16((sndDoubleClick + DPLAY.priority), 0x2bc);   // 1c619
  W16((sndDoubleClick + DPLAY.presnd), 0x0);   // 1c622
  F.dws_DGetRateFromDWD_1f5b3(R32(sndDoubleClick), (sndIdeal + IDEAL.digitalRate));   // 1c62b/1c630 push 0x61044, 1c631 push [0x61180], 1c637 call, 1c63c add esp,8

  // 1c63f: "gewtshot.dwd" (0x303d6: 67 65 77 74 73 68 6f 74 2e 64 77 64 00)
  F.Load_File_232fb(0x303d6, sndGunShotData);   // 1c63f mov edx, 1c644 mov eax, 1c649 call (EAX result unused)
  W32(sndGunShot, R32(sndGunShotData));   // 1c64e mov eax,[0x60f28]; 1c653 mov [0x611a0],eax
  W16((sndGunShot + DPLAY.count), 0x1);   // 1c658
  W16((sndGunShot + DPLAY.priority), 0x258);   // 1c661
  W16((sndGunShot + DPLAY.presnd), 0x0);   // 1c66a
  F.dws_DGetRateFromDWD_1f5b3(R32(sndGunShot), (sndIdeal + IDEAL.digitalRate));   // 1c673/1c678 push 0x61044, 1c679 push [0x611a0], 1c67f call, 1c684 add esp,8

  // 1c687: "riq.dwd" (0x303e3: 72 69 71 2e 64 77 64 00)
  F.Load_File_232fb(0x303e3, sndRicochetData);   // 1c687 mov edx, 1c68c mov eax, 1c691 call (EAX result unused)
  W32(sndRicochet, R32(sndRicochetData));   // 1c696 mov eax,[0x60f40]; 1c69b mov [0x61260],eax
  W16((sndRicochet + DPLAY.count), 0x1);   // 1c6a0
  W16((sndRicochet + DPLAY.priority), 0x12c);   // 1c6a9
  W16((sndRicochet + DPLAY.presnd), 0x0);   // 1c6b2
  F.dws_DGetRateFromDWD_1f5b3(R32(sndRicochet), (sndIdeal + IDEAL.digitalRate));   // 1c6bb/1c6c0 push 0x61044, 1c6c1 push [0x61260], 1c6c7 call, 1c6cc add esp,8

  // 1c6cf: "ishot.dwd" (0x303eb: 69 73 68 6f 74 2e 64 77 64 00)
  F.Load_File_232fb(0x303eb, sndIShotData);   // 1c6cf mov edx, 1c6d4 mov eax, 1c6d9 call (EAX result unused)
  W32(sndIShot, R32(sndIShotData));   // 1c6de mov eax,[0x60f38]; 1c6e3 mov [0x61220],eax
  W16((sndIShot + DPLAY.count), 0x1);   // 1c6e8
  W16((sndIShot + DPLAY.priority), 0x3d4);   // 1c6f1
  W16((sndIShot + DPLAY.presnd), 0x0);   // 1c6fa
  F.dws_DGetRateFromDWD_1f5b3(R32(sndIShot), (sndIdeal + IDEAL.digitalRate));   // 1c703/1c708 push 0x61044, 1c709 push [0x61220], 1c70f call, 1c714 add esp,8

  // 1c717: "yamon.dwd" (0x303f5: 79 61 6d 6f 6e 2e 64 77 64 00)
  F.Load_File_232fb(0x303f5, sndYaMonData);   // 1c717 mov edx, 1c71c mov eax, 1c721 call (EAX result unused)
  W32(sndYaMon, R32(sndYaMonData));   // 1c726 mov eax,[0x60f2c]; 1c72b mov [0x611c0],eax
  W16((sndYaMon + DPLAY.count), 0x1);   // 1c730
  W16((sndYaMon + DPLAY.priority), 0x3d4);   // 1c739
  W16((sndYaMon + DPLAY.presnd), 0x0);   // 1c742
  F.dws_DGetRateFromDWD_1f5b3(R32(sndYaMon), (sndIdeal + IDEAL.digitalRate));   // 1c74b/1c750 push 0x61044, 1c751 push [0x611c0], 1c757 call, 1c75c add esp,8

  // 1c75f: "smokin.dwd" (0x303ff: 73 6d 6f 6b 69 6e 2e 64 77 64 00)
  F.Load_File_232fb(0x303ff, sndSmokinData);   // 1c75f mov edx, 1c764 mov eax, 1c769 call (EAX result unused)
  W32(sndSmokin, R32(sndSmokinData));   // 1c76e mov eax,[0x60f30]; 1c773 mov [0x611e0],eax
  W16((sndSmokin + DPLAY.count), 0x1);   // 1c778
  W16((sndSmokin + DPLAY.priority), 0x3d4);   // 1c781
  W16((sndSmokin + DPLAY.presnd), 0x0);   // 1c78a
  F.dws_DGetRateFromDWD_1f5b3(R32(sndSmokin), (sndIdeal + IDEAL.digitalRate));   // 1c793/1c798 push 0x61044, 1c799 push [0x611e0], 1c79f call, 1c7a4 add esp,8

  // 1c7a7: "getsome.dwd" (0x3040a: 67 65 74 73 6f 6d 65 2e 64 77 64 00)
  F.Load_File_232fb(0x3040a, sndGetSomeData);   // 1c7a7 mov edx, 1c7ac mov eax, 1c7b1 call (EAX result unused)
  W32(sndGetSome, R32(sndGetSomeData));   // 1c7b6 mov eax,[0x60f34]; 1c7bb mov [0x61200],eax
  W16((sndGetSome + DPLAY.count), 0x1);   // 1c7c0
  W16((sndGetSome + DPLAY.priority), 0x3d4);   // 1c7c9
  W16((sndGetSome + DPLAY.presnd), 0x0);   // 1c7d2
  F.dws_DGetRateFromDWD_1f5b3(R32(sndGetSome), (sndIdeal + IDEAL.digitalRate));   // 1c7db/1c7e0 push 0x61044, 1c7e1 push [0x61200], 1c7e7 call, 1c7ec add esp,8

  // 1c7ef: "f1.dwd" (0x30416: 66 31 2e 64 77 64 00)
  F.Load_File_232fb(0x30416, sndMusicSample1Data);   // 1c7ef mov edx, 1c7f4 mov eax, 1c7f9 call (EAX result unused)
  W32(sndMusicSample1, R32(sndMusicSample1Data));   // 1c7fe mov eax,[0x60fa0]; 1c803 mov [0x614c0],eax
  W16((sndMusicSample1 + DPLAY.count), 0x1);   // 1c808
  W16((sndMusicSample1 + DPLAY.priority), 0x190);   // 1c811
  W16((sndMusicSample1 + DPLAY.presnd), 0x0);   // 1c81a
  F.dws_DGetRateFromDWD_1f5b3(R32(sndMusicSample1), (sndIdeal + IDEAL.digitalRate));   // 1c823/1c828 push 0x61044, 1c829 push [0x614c0], 1c82f call, 1c834 add esp,8

  // 1c837: "f2.dwd" (0x3041d: 66 32 2e 64 77 64 00)
  F.Load_File_232fb(0x3041d, sndMusicSample2Data);   // 1c837 mov edx, 1c83c mov eax, 1c841 call (EAX result unused)
  W32(sndMusicSample2, R32(sndMusicSample2Data));   // 1c846 mov eax,[0x60fa4]; 1c84b mov [0x614e0],eax
  W16((sndMusicSample2 + DPLAY.count), 0x1);   // 1c850
  W16((sndMusicSample2 + DPLAY.priority), 0x190);   // 1c859
  W16((sndMusicSample2 + DPLAY.presnd), 0x0);   // 1c862
  F.dws_DGetRateFromDWD_1f5b3(R32(sndMusicSample2), (sndIdeal + IDEAL.digitalRate));   // 1c86b/1c870 push 0x61044, 1c871 push [0x614e0], 1c877 call, 1c87c add esp,8

  // 1c87f: "f3.dwd" (0x30424: 66 33 2e 64 77 64 00)
  F.Load_File_232fb(0x30424, sndMusicSample3Data);   // 1c87f mov edx, 1c884 mov eax, 1c889 call (EAX result unused)
  W32(sndMusicSample3, R32(sndMusicSample3Data));   // 1c88e mov eax,[0x60fa8]; 1c893 mov [0x61500],eax
  W16((sndMusicSample3 + DPLAY.count), 0x1);   // 1c898
  W16((sndMusicSample3 + DPLAY.priority), 0x190);   // 1c8a1
  W16((sndMusicSample3 + DPLAY.presnd), 0x0);   // 1c8aa
  F.dws_DGetRateFromDWD_1f5b3(R32(sndMusicSample3), (sndIdeal + IDEAL.digitalRate));   // 1c8b3/1c8b8 push 0x61044, 1c8b9 push [0x61500], 1c8bf call, 1c8c4 add esp,8

  // 1c8c7: "f4.dwd" (0x3042b: 66 34 2e 64 77 64 00)
  F.Load_File_232fb(0x3042b, sndMusicSample4Data);   // 1c8c7 mov edx, 1c8cc mov eax, 1c8d1 call (EAX result unused)
  W32(sndMusicSample4, R32(sndMusicSample4Data));   // 1c8d6 mov eax,[0x60fac]; 1c8db mov [0x61520],eax
  W16((sndMusicSample4 + DPLAY.count), 0x1);   // 1c8e0
  W16((sndMusicSample4 + DPLAY.priority), 0x190);   // 1c8e9
  W16((sndMusicSample4 + DPLAY.presnd), 0x0);   // 1c8f2
  F.dws_DGetRateFromDWD_1f5b3(R32(sndMusicSample4), (sndIdeal + IDEAL.digitalRate));   // 1c8fb/1c900 push 0x61044, 1c901 push [0x61520], 1c907 call, 1c90c add esp,8

  // 1c90f: "f5.dwd" (0x30432: 66 35 2e 64 77 64 00)
  F.Load_File_232fb(0x30432, sndMusicSample5Data);   // 1c90f mov edx, 1c914 mov eax, 1c919 call (EAX result unused)
  W32(sndMusicSample5, R32(sndMusicSample5Data));   // 1c91e mov eax,[0x60fb0]; 1c923 mov [0x61540],eax
  W16((sndMusicSample5 + DPLAY.count), 0x1);   // 1c928
  W16((sndMusicSample5 + DPLAY.priority), 0x190);   // 1c931
  W16((sndMusicSample5 + DPLAY.presnd), 0x0);   // 1c93a
  F.dws_DGetRateFromDWD_1f5b3(R32(sndMusicSample5), (sndIdeal + IDEAL.digitalRate));   // 1c943/1c948 push 0x61044, 1c949 push [0x61540], 1c94f call, 1c954 add esp,8

  // 1c957: "f6.dwd" (0x30439: 66 36 2e 64 77 64 00)
  F.Load_File_232fb(0x30439, sndMusicSample6Data);   // 1c957 mov edx, 1c95c mov eax, 1c961 call (EAX result unused)
  W32(sndMusicSample6, R32(sndMusicSample6Data));   // 1c966 mov eax,[0x60fb4]; 1c96b mov [0x61560],eax
  W16((sndMusicSample6 + DPLAY.count), 0x1);   // 1c970
  W16((sndMusicSample6 + DPLAY.priority), 0x190);   // 1c979
  W16((sndMusicSample6 + DPLAY.presnd), 0x0);   // 1c982
  F.dws_DGetRateFromDWD_1f5b3(R32(sndMusicSample6), (sndIdeal + IDEAL.digitalRate));   // 1c98b/1c990 push 0x61044, 1c991 push [0x61560], 1c997 call, 1c99c add esp,8

  // 1c99f: "f65.dwd" (0x30440: 66 36 35 2e 64 77 64 00)
  F.Load_File_232fb(0x30440, sndMusicSample65Data);   // 1c99f mov edx, 1c9a4 mov eax, 1c9a9 call (EAX result unused)
  W32(sndMusicSample65, R32(sndMusicSample65Data));   // 1c9ae mov eax,[0x60fb8]; 1c9b3 mov [0x61580],eax
  W16((sndMusicSample65 + DPLAY.count), 0x1);   // 1c9b8
  W16((sndMusicSample65 + DPLAY.priority), 0x190);   // 1c9c1
  W16((sndMusicSample65 + DPLAY.presnd), 0x0);   // 1c9ca
  F.dws_DGetRateFromDWD_1f5b3(R32(sndMusicSample65), (sndIdeal + IDEAL.digitalRate));   // 1c9d3/1c9d8 push 0x61044, 1c9d9 push [0x61580], 1c9df call, 1c9e4 add esp,8

  // 1c9e7: "f7.dwd" (0x30448: 66 37 2e 64 77 64 00)
  F.Load_File_232fb(0x30448, sndMusicSample7Data);   // 1c9e7 mov edx, 1c9ec mov eax, 1c9f1 call (EAX result unused)
  W32(sndMusicSample7, R32(sndMusicSample7Data));   // 1c9f6 mov eax,[0x60fbc]; 1c9fb mov [0x615a0],eax
  W16((sndMusicSample7 + DPLAY.count), 0x1);   // 1ca00
  W16((sndMusicSample7 + DPLAY.priority), 0x190);   // 1ca09
  W16((sndMusicSample7 + DPLAY.presnd), 0x0);   // 1ca12
  F.dws_DGetRateFromDWD_1f5b3(R32(sndMusicSample7), (sndIdeal + IDEAL.digitalRate));   // 1ca1b/1ca20 push 0x61044, 1ca21 push [0x615a0], 1ca27 call, 1ca2c add esp,8

  // 1ca2f: "f8.dwd" (0x3044f: 66 38 2e 64 77 64 00)
  F.Load_File_232fb(0x3044f, sndMusicSample8Data);   // 1ca2f mov edx, 1ca34 mov eax, 1ca39 call (EAX result unused)
  W32(sndMusicSample8, R32(sndMusicSample8Data));   // 1ca3e mov eax,[0x60fc0]; 1ca43 mov [0x615c0],eax
  W16((sndMusicSample8 + DPLAY.count), 0x1);   // 1ca48
  W16((sndMusicSample8 + DPLAY.priority), 0x190);   // 1ca51
  W16((sndMusicSample8 + DPLAY.presnd), 0x0);   // 1ca5a
  F.dws_DGetRateFromDWD_1f5b3(R32(sndMusicSample8), (sndIdeal + IDEAL.digitalRate));   // 1ca63/1ca68 push 0x61044, 1ca69 push [0x615c0], 1ca6f call, 1ca74 add esp,8

  // 1ca77: "f9.dwd" (0x30456: 66 39 2e 64 77 64 00)
  F.Load_File_232fb(0x30456, sndMusicSample9Data);   // 1ca77 mov edx, 1ca7c mov eax, 1ca81 call (EAX result unused)
  W32(sndMusicSample9, R32(sndMusicSample9Data));   // 1ca86 mov eax,[0x60fc4]; 1ca8b mov [0x615e0],eax
  W16((sndMusicSample9 + DPLAY.count), 0x1);   // 1ca90
  W16((sndMusicSample9 + DPLAY.priority), 0x190);   // 1ca99
  W16((sndMusicSample9 + DPLAY.presnd), 0x0);   // 1caa2
  F.dws_DGetRateFromDWD_1f5b3(R32(sndMusicSample9), (sndIdeal + IDEAL.digitalRate));   // 1caab/1cab0 push 0x61044, 1cab1 push [0x615e0], 1cab7 call, 1cabc add esp,8

  // 1cabf: "f10.dwd" (0x3045d: 66 31 30 2e 64 77 64 00)
  F.Load_File_232fb(0x3045d, sndMusicSample10Data);   // 1cabf mov edx, 1cac4 mov eax, 1cac9 call (EAX result unused)
  W32(sndMusicSample10, R32(sndMusicSample10Data));   // 1cace mov eax,[0x60fc8]; 1cad3 mov [0x61600],eax
  W16((sndMusicSample10 + DPLAY.count), 0x1);   // 1cad8
  W16((sndMusicSample10 + DPLAY.priority), 0x190);   // 1cae1
  W16((sndMusicSample10 + DPLAY.presnd), 0x0);   // 1caea
  F.dws_DGetRateFromDWD_1f5b3(R32(sndMusicSample10), (sndIdeal + IDEAL.digitalRate));   // 1caf3/1caf8 push 0x61044, 1caf9 push [0x61600], 1caff call, 1cb04 add esp,8

  // 1cb07: "ufo.dwd" (0x30465: 75 66 6f 2e 64 77 64 00)
  F.Load_File_232fb(0x30465, sndUfoData);   // 1cb07 mov edx, 1cb0c mov eax, 1cb11 call (EAX result unused)
  W32(sndUfo, R32(sndUfoData));   // 1cb16 mov eax,[0x60fe8]; 1cb1b mov [0x61620],eax
  W16((sndUfo + DPLAY.count), 0x1);   // 1cb20
  W16((sndUfo + DPLAY.priority), 0x12c);   // 1cb29
  W16((sndUfo + DPLAY.presnd), 0x0);   // 1cb32
  F.dws_DGetRateFromDWD_1f5b3(R32(sndUfo), (sndIdeal + IDEAL.digitalRate));   // 1cb3b/1cb40 push 0x61044, 1cb41 push [0x61620], 1cb47 call, 1cb4c add esp,8

  // 1cb4f: "ufo2.dwd" (0x3046d: 75 66 6f 32 2e 64 77 64 00)
  F.Load_File_232fb(0x3046d, sndUfo2Data);   // 1cb4f mov edx, 1cb54 mov eax, 1cb59 call (EAX result unused)
  W32(sndUfo2, R32(sndUfo2Data));   // 1cb5e mov eax,[0x60fec]; 1cb63 mov [0x61640],eax
  W16((sndUfo2 + DPLAY.count), 0x1);   // 1cb68
  W16((sndUfo2 + DPLAY.priority), 0xc8);   // 1cb71
  W16((sndUfo2 + DPLAY.presnd), 0x0);   // 1cb7a
  F.dws_DGetRateFromDWD_1f5b3(R32(sndUfo2), (sndIdeal + IDEAL.digitalRate));   // 1cb83/1cb88 push 0x61044, 1cb89 push [0x61640], 1cb8f call, 1cb94 add esp,8

  F.dws_XMusic_1eed0(0xfe);          // 1cb97 mov eax, 0xfe; 1cb9c push eax; 1cb9d call; 1cba2 add esp, 4
  F.dws_DPlay_1eff8(sndLogo);        // 1cba5 mov eax, 0x613c0; 1cbaa push eax; 1cbab call; 1cbb0 add esp, 4
  // 0x30476 "xlogo.pcx" (78 6c 6f 67 6f 2e 70 63 78 00)
  await F.showPictureFadeIn_102d1(0x30476, 0x3c, 0);     // 1cbb3 xor ebx, ebx; 1cbb5 mov edx, 0x3c; 1cbba mov eax, 0x30476; 1cbbf call
  F.updateMusic_10050();                     // 1cbc4
  // 0x30480 "evilx.pcx" (65 76 69 6c 78 2e 70 63 78 00)
  await F.showPictureFadeIn_102d1(0x30480, 0x3c, 0);     // 1cbc9 xor ebx, ebx; 1cbcb mov edx, 0x3c; 1cbd0 mov eax, 0x30480; 1cbd5 call
  F.updateMusic_10050();                     // 1cbda
  await F.showTitleScreen_115bc();                     // 1cbdf
  // exit 0x1cbe4
}
