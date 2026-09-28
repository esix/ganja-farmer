// DiamondWare STK 2.22 TSR (STKRUN.EXE), reimplemented: the API layer of segment 0380 (and the DWT timer,
// segment 0530) of STKRUN, on top
// of the verified reimplementations of its digitized mixer and DWM/OPL2 player:
//   re/digi/digi-mixer.js  (DIGI.md; verified FAITHFUL for game-reachable behaviour)
//   re/music/dwm-player.js (PLAYER.md, DWM_FORMAT.md; verified 0 diffs)
// This file is the adapter: the API layer's own state and checks, and the hardware (soundcard.js).
// Stage 2: the game calls it directly (export `stk`, used by lib/stk_client.js) with flat pointers. The
// original path, client stubs marshalling arguments into a DOS buffer and INT 60h into the TSR, is gone.
//
// Addresses: seg:off in the STKRUN.EXE load image (re/digi/stkrun.asm). Dispatch table DS(07FE):0874
// (read from the image): 00 0380:0af4, 01 0380:1af2, 02 0380:13e6, 03 0380:0864, 04 0380:0aaa,
// 05 0380:0b48, 06 0380:0bd8, 07 0380:0c54, 08 0380:1100, 09 0380:1284, 0A 0380:0f10, 0B 0380:0f80,
// 0C 0380:0ffa, 0D 0380:1172, 0E 0380:120c, 0F 0380:12f0, 10 0380:134c, 11 0380:13a8, 12 0380:0cf6,
// 13 0380:0d6a, 14 0380:0dd2, 15 0380:0e30, 16 0380:0e8e, 17 0530:009e, 18 0530:0069, 19 0530:013f,
// 1A 0530:0147, 1B 0530:0125.
//
// API-layer state, DS(0A0F): [0x290] errno, [0x292] initted, [0x294] init in progress, [0x296]
// mixer initialised, [0x298] FM active, [0x29a] digital active.
//
// Not modelled (not observable by the program):
//  - The busy lock 07cb:008f/00b0 (error 0x13) and the ISR/tick deferral through it (DIGI.md §0,
//    PLAYER.md §2): an API call and an interrupt never overlap in the port (calls are synchronous JS;
//    interrupts are delivered between them by pit.pump), so the lock is always free and nothing is
//    ever deferred. Error 0x13 is unreachable.
//  - The IF test of Init/Kill/DetectHardWare (0380:0880, 0abd, 140d; error 0x14): the handler does
//    `sti` before the call (07f0:008f), so IF is always set.
//  - The licence/tamper checks 0380:0006 (Init) and 02f1:0004/0503 (DIGI.md §5): assumed to pass.
//  - TSR-internal memory: DMA buffer allocation 0380:0706 and its release in Kill ([0x5f0], 0380:0a08..0a5f).
//
// Functions the game uses: 2, 3, 4, 5, 6, 7, 8, 9, 0xA, 0xC, 0xD, 0x10, 0x11, 0x12, 0x13, 0x14 (from
// dws_MPlay), 0x15, 0x16, 0x17, 0x18. Not implemented: 1, 0xB, 0xE, 0xF, 0x19, 0x1A, 0x1B.
import { u8, R16, R32, W16 } from '../../runtime/mem.js';
import * as pit from '../pit.js';
import * as card from './soundcard.js';
import { DigiMixer, BLOCK_SIZE_BY_ENV } from './digi-mixer.js';
import { STKMusic } from './dwm-player.js';
import * as musicOut from './music-out.js';

// ---- the machine STKRUN detects ------------------------------------------------------------------
// UNCERTAIN (setup-dependent): what dws_DetectHardWare finds depends on the user's card and DOS
// environment. The port assumes a Sound Blaster 2.0-class card (DSP 2.xx, OPL2, no mixer chip) at
// the default resources, no BLASTER/SNDSCAPE/MAD16 environment variables and no VDS/EMM. This is the
// one setup whose whole behaviour is defined by STKRUN's code: mixer type 1 (the software mixer, the
// default of both verified reimplementations, DIGI.md §6.1 / PLAYER.md §5), DMA mode 2 (auto-init,
// DSP >= 2.00, the mode digi-mixer.js models, DIGI.md §2) and 256-byte blocks (environment code 0).
export const SETUP = {
  sbPort: 0x220,      // first entry of the probe table DS(0A0F):029C {220,240,260,210,230,250,270,280}
  dspVersion: 0x0201, // DSP reset/version probe 0380:13d4 (-> 06cc:0246)
  oplType: 2,         // OPL detect 05c1:000a at sbPort+8: status low nibble 6 -> 2 (05c1:0143..0155)
  mixerType: 1,       // mixer detect 067d:0061: type 4, then 3, else 1 (DIGI.md §3/§6.1)
  dma: 1,             // DMA probe 06cc:0456/03e0/052c/05f7 (0380:17b6..17fb)
  irq: 7,             // IRQ probe 06cc:0302 (0380:198b)
  envCode: 0,         // 0380:07e4 (INT 67h / VDS probe): 0 = none (plain DOS, DOSBox)
};

// ---- state ----------------------------------------------------------------------------------------
const S = { errno: 0, initted: 0, initBusy: 0, mixerInit: 0, fmOn: 0, digOn: 0 };
let digi = null;   // DigiMixer: the digitized half (segments 02f1/0750)
let music = null;  // STKMusic: sequencer 068a + OPL driver 05c1 (+ software mixer 07ac)
let everInit = false;
const dwdViews = new Map();

export const state = () => ({ ...S, digi, music });

// A DWD as the mixer sees it (stage 2): the game's buffer in the heap, addressed directly by its flat
// address (the client used to copy it to DOS memory for every play). One live view per address, registered
// with the mixer under its own buffer number (digi-mixer.js registerBuffer); the mixer identifies a sound
// by that number (DDiscard's AO matching compares it).
function dwdView(addr) {
  let v = dwdViews.get(addr);
  if (!v) {
    v = u8.subarray(addr);
    digi.registerBuffer(v);
    dwdViews.set(addr, v);
  }
  return v;
}

const initOk = () => S.initted === 1 && S.initBusy === 0;   // [0x292]==1 && [0x294]==0
function fail(e) { S.errno = e; return 0; }

// ---- 00 dws_ErrNo (0380:0af4): AX = [0x290] ------------------------------------------------------
function fnErrNo() { return S.errno; }

// ---- 02 dws_DetectHardWare (0380:13e6, retf 8): [bp+6] = dr, [bp+0xa] = dov -----------------------
// Block (client 0x1ea27): word 0/1 = far ptr to the dov copy, word 2/3 = far ptr to the results area.
function fnDetectHardWare(dov, dr) {
  if (S.initted !== 0 || S.initBusy !== 0) return fail(2);            // 0380:13f1..13ff -> 1ac0
  // Overrides (dov +0 port, +2 DMA, +4 IRQ; 0xFFFF = autodetect). The game passes 0xFFFF for all three
  // (0x1aa49..0x1aa5b); the override paths (0380:1447, 16e6, 1712) are not implemented.
  if (R16(dov) !== 0xffff || R16(dov + 2) !== 0xffff || R16(dov + 4) !== 0xffff) {
    throw new Error('stk DetectHardWare: dws_DETECTOVERRIDES other than autodetect not implemented');
  }
  const P = SETUP.sbPort;
  // 0380:142e -> 0380:078e: words +0x0E, +0x10, +0x14..+0x30 = 0xFFFF (AX = 0xFFFF at 0x1429)
  for (const o of [0x0e, 0x10, 0x14, 0x16, 0x18, 0x1a, 0x1c, 0x1e, 0x20, 0x22, 0x24, 0x26, 0x28, 0x2a, 0x2c, 0x2e, 0x30]) {
    W16(dr + o, 0xffff);
  }
  W16(dr + 2, 0); W16(dr + 0x2c, 0);                                   // 0380:1436, 143a
  // dov+0 == -1: getenv("BLASTER") fails (0380:147f) -> probe loop 0380:150c..1536 over the table at
  // DS(0A0F):029C; the first port whose DSP answers: +0x28 = port, [bp-0xc] = DSP version.
  W16(dr + 0x28, P);                                                   // 0380:1528
  const ver = SETUP.dspVersion;                                        // 0380:1531
  // 0380:153e..1562: no SNDSCAPE variable, 06cc:07bb != 1 -> version kept.
  // FM, dov+0 == -1 and a DSP was found (0380:158e): +0x1E = port+8, OPL detect there (0380:15a5).
  W16(dr + 0x1e, (P + 8) & 0xffff);                                    // 0380:159e
  W16(dr + 0x1c, SETUP.oplType);                                       // 0380:15cf
  W16(dr + 2, R16(dr + 2) | 1);                                        // 0380:15da
  W16(dr + 4, 1); W16(dr + 6, 1); W16(dr + 8, 0x0b);                   // 0380:15de..15e6
  // Mixer: +0x28 != -1 -> BLASTER 'T' absent (0380:1625) -> mixer detect 067d:0061 (0380:1659).
  W16(dr + 0x12, SETUP.mixerType);                                     // 0380:1663
  // 0380:1667: env code 5 check (not 5); 0380:1691: no MAD16 variable.
  W16(dr + 0x1a, SETUP.mixerType === 1 ? 0xffff : P);                  // 0380:16ad / 16b9
  if (SETUP.mixerType === 4) throw new Error('stk DetectHardWare: SB16 path (0380:16c7) not implemented');
  // DMA, dov+2 == -1 (0380:16f9 -> 176b): 0642:0090 (no other card), probe -> +0x0E (0380:17ca)
  W16(dr + 0x0e, SETUP.dma);
  // IRQ, dov+4 == -1 (0380:174c -> 192e): probe 06cc:0302 -> +0x10 (0380:1993); IRQ 2 -> 9 (0380:18d8)
  W16(dr + 0x10, SETUP.irq === 2 ? 9 : SETUP.irq);
  W16(dr + 0x18, 0);                                                   // 0380:18e1
  // DSP found, IRQ and DMA valid (0380:18e7..190e) -> digital available
  W16(dr + 2, R16(dr + 2) | 2);                                        // 0380:1913
  W16(dr + 0, P);                                                      // 0380:191c
  W16(dr + 0x0a, 8); W16(dr + 0x0c, 1);                                // 0380:191f, 1925
  W16(dr + 0x26, ver);                                                 // 0380:1a6b
  // 0380:1a6f..1aa4: no error flagged -> AX = 1. Words +0x32..+0x3E are not written.
  return 1;
}

// ---- 03 dws_Init (0380:0864, retf 8): [bp+6] = ideal, [bp+0xa] = dr --------------------------------
// Block (client 0x1ebe4): word 0/1 = far ptr to the dr copy, word 2/3 = far ptr to the ideal copy.
// ideal is not written (the client copies it back unchanged).
function fnInit(dr, ideal) {
  if (S.initted !== 0 || S.initBusy !== 0) return fail(2);            // 0380:086f..087d -> 09d2
  // UNCERTAIN: a second Init after Kill would keep the TSR's data (e.g. the soundnum counter, OPL
  // driver state); rebuilding the mixer/player would not. The game calls dws_Init once (0x1aab1).
  if (everInit) throw new Error('stk Init: re-initialisation after dws_Kill not modelled');
  S.initBusy = 1; S.initted = 1;                                       // 0380:088e..0894
  const env = SETUP.envCode;                                           // 0380:0899 -> 07e4
  // 0380:098f..09a8: mixer type = dr+0x12 if 1, 3, 4 or 5, else 1.
  let mt = R16(dr + 0x12);
  if (mt > 5 || mt === 0 || mt === 2) mt = 1;
  if (mt === 5) throw new Error('stk Init: mixer type 5 (07b2) not ported (DIGI.md §6.1)');
  // FM (0380:08a9..08d2): ideal.+0 != 0 and dr+2 bit 0 -> FM init at port dr+0x1E (05c1:0542),
  // rhythm setup (0380:00b6), sequencer init (068a:027f), [0x298] = 1. The software mixer's init
  // (07ac:0058, called at 0380:09b2) is also in STKMusic's constructor (dwsInit): it only re-levels
  // the OPL carriers (setMusVol(255)).
  if (R16(ideal) !== 0 && (R16(dr + 2) & 1)) {
    music = new STKMusic(card.oplWrite, { mixer: mt === 1 ? 'software' : 'hardware' });
    S.fmOn = 1;
  }
  // Digital (0380:08d8..0986): ideal.+2 != 0 and dr+2 bit 1 -> 02f1:0819 with rate ideal.+4, voices
  // ideal.+6, block DS(0A0F):0190[env], DMA mode from DS(0A0F):01C8 by DSP version dr+0x26 (DIGI.md §2);
  // the DSP/DMA starts; [0x29a] = 1.
  if (R16(ideal + 2) !== 0 && (R16(dr + 2) & 2)) {
    if (R16(dr + 0x26) < 0x200) throw new Error('stk Init: DSP < 2.00 (DMA mode 0/1) not modelled (DIGI.md §6.6)');
    digi = new DigiMixer({
      rate: R16(ideal + 4), nvoices: R16(ideal + 6), blockSize: BLOCK_SIZE_BY_ENV[env],
      mixerType: mt === 1 ? 'software' : mt === 3 ? 'sbpro' : 'sb16',
    });
    dwdViews.clear();
    card.startDigital(digi);
    S.digOn = 1;                                                       // 0380:0986
  }
  S.mixerInit = 1;                                                     // 0380:09b7
  S.initBusy = 0;                                                      // 0380:09bd
  everInit = true;
  return 1;                                                            // 0380:09c3
}

// ---- 04 dws_Kill (0380:0aaa -> 09e2) -----------------------------------------------------------------
function fnKill() {
  if (!initOk()) return fail(1);                                       // 0380:09e5..09f2 -> 0a93
  if (S.digOn === 1) {                                                 // 0380:09f5
    // 02f1:07b7 stops the DSP/DMA. UNCERTAIN: its failure path (result != 1 -> errno 8, 0380:0a2b)
    // depends on the DSP answering; not modelled.
    card.stopDigital();
    S.digOn = 0;                                                       // 0380:0a04
  }
  if (S.mixerInit === 1) S.mixerInit = 0;                              // 0380:0a62..0a6e (07ac:002b: retf)
  if (S.fmOn === 1) {                                                  // 0380:0a74
    music.clear();                                                     // 068a:02ca
    musicOut.stop();
    music.fmKill();                                                    // 05c1:05ad
    S.fmOn = 0;                                                        // 0380:0a85
  }
  S.initted = 0;                                                       // 0380:0a8b
  return 1;                                                            // 0380:0aa3
}

// ---- 05/06/07 dws_XMaster / XMusic / XDig (0380:0b48 / 0bd8 / 0c54 -> 0b00 / 0b90 / 0c0c) ----------
// Checks (e.g. 0380:0b03..0b1f): initted else 1; [0x296] else 3; v > 255 else 9. Then the mixer-type
// table 067d:0000/0020/0040 -> software mixer 07ac:0046 (master: music and dig re-applied), 07ac:0039
// (music -> setMusVol), 07ac:002c (dig -> volume table). The master/music/dig bytes [0x83c..0x83e]
// are shared by both halves; each reimplementation keeps its copy, so both are called.
function xCheck(v) {
  if (!initOk()) return fail(1);
  if (S.mixerInit !== 1) return fail(3);
  if (v > 0xff) return fail(9);
  return 1;
}
function fnXMaster(v) {
  v &= 0xffff;
  if (v === 0x6969) { S.errno = 0xde; return 0x0b; }                 // 0380:0b56..0b62 (client handshake)
  if (!xCheck(v)) return 0;
  if (music) { music.setMasterVolume(v); musicOut.setMusVol(music.musVol); }
  if (digi) digi.XMaster(v);
  return 1;                                                            // 0380:0b27
}
function fnXMusic(v) {
  v &= 0xffff;
  if (!xCheck(v)) return 0;
  if (music) { music.setMusicVolume(v); musicOut.setMusVol(music.musVol); }
  if (digi) digi.XMusic(v);
  return 1;                                                            // 0380:0bb7
}
function fnXDig(v) {
  v &= 0xffff;
  if (!xCheck(v)) return 0;
  if (digi) digi.XDig(v);
  return 1;                                                            // 0380:0c33
}

// ---- digitized: checks initted else 1, [0x29a] else 3 (e.g. 0380:103c..1054) ----------------------
function digCheck() {
  if (!initOk()) return fail(1);
  if (S.digOn !== 1) return fail(3);
  return 1;
}
// 08 dws_DPlay (0380:1100 -> 1038, retf 4): far ptr to dws_DPLAY {snd far ptr (off +0, seg +2),
// count +4, priority +6, presnd +8, soundnum +0xA}. soundnum always receives the worker's raw result.
function fnDPlay(dp) {
  if (!digCheck()) return 0;
  const req = {
    snd: dwdView(R32(dp) >>> 0), count: R16(dp + 4), priority: R16(dp + 6), presnd: R16(dp + 8),
  };
  const r = digi.DPlay(req);
  W16(dp + 0x0a, req.soundnum);                                        // 0380:107f / 10a2
  if (!r) S.errno = digi.errno;                                        // 0380:10b5..10e2
  return r;
}
// 09 dws_DSoundStatus (0380:1284 -> 1244, retf 6): [bp+0xa] = soundnum (word 0), [bp+6] = far ptr
// to the result (words 1/2).
function fnDSoundStatus(sn, result) {
  if (!digCheck()) return 0;
  W16(result, digi.DSoundStatus(sn & 0xffff).status);                   // 02f1:06af -> 0380:1267
  return 1;
}
// 0A dws_DSetRate (0380:0f10 -> 0eba): > 0x5DC0 -> 0xF, < 0xF44 -> 0xE, else 02f1:06dc.
function fnDSetRate(rate) {
  if (!digCheck()) return 0;
  const r = digi.DSetRate(rate & 0xffff);
  if (!r) S.errno = digi.errno;
  return r;
}
// 0C dws_DGetRateFromDWD (0380:0ffa -> 0fb8, retf 8): [bp+0xa] = far ptr to the DWD (words 0/1),
// [bp+6] = far ptr to the result (words 2/3). No initted/digital checks in 0fb8. *result is written
// before the check (0380:0fce).
function fnDGetRateFromDWD(sndAddr, res) {
  const snd = u8.subarray(sndAddr);
  // The worker (02f1:06b4 -> 0750:03e5) needs no mixer state; DigiMixer.DGetRateFromDWD only sets
  // errno on its object, so it can run on a scratch object when the digital side is not initialised.
  const obj = digi ?? { errno: 0 };
  const r = DigiMixer.prototype.DGetRateFromDWD.call(obj, snd);
  W16(res, r.rate);
  if (!r.ok) S.errno = obj.errno;                                      // 0380:0fd7 / 0fe9
  return r.ok;
}
// 0D dws_DDiscard (0380:1172 -> 1138): 02f1:06a5, always 1.
function fnDDiscard(sn) {
  if (!digCheck()) return 0;
  digi.DDiscard(sn & 0xffff);
  return 1;                                                            // 0380:1158
}
// 10/11 dws_DPause / dws_DUnPause (0380:134c -> 131c / 0380:13a8 -> 1378): 02f1:06be / 06cd.
function fnDPause() { if (!digCheck()) return 0; digi.DPause(); return 1; }
function fnDUnPause() { if (!digCheck()) return 0; digi.DUnPause(); return 1; }

// ---- music: checks initted else 1, [0x298] else 3 (e.g. 0380:0c8c..0c9f) ---------------------------
function fmCheck() {
  if (!initOk()) return fail(1);
  if (S.fmOn !== 1) return fail(3);
  return 1;
}
// 12 dws_MPlay (0380:0cf6 -> 0c88, retf 4): far ptr to dws_MPLAY {track far ptr (off +0, seg +2),
// count +4}; 068a:02e8(track, count): 0 -> 1; 1 -> errno 3; 2 -> 0x10; 3 -> 0x11; other -> 0x12.
// The player reads the song through a live view of real-mode memory at the far pointer.
function fnMPlay(mp) {
  if (!fmCheck()) return 0;
  const track = u8.subarray(R32(mp) >>> 0);
  const r = music.play(track, R16(mp + 4));
  if (r === 0) { musicSong = musicOut.songName(track); musicOut.start(musicSong); return 1; } // 0380:0ccc
  return fail(r === 1 ? 3 : r === 2 ? 0x10 : r === 3 ? 0x11 : 0x12);  // 0380:0cd1..0cef
}
// 13 dws_MSongStatus (0380:0d6a -> 0d2e, retf 4): *result = 068a:03e1.
function fnMSongStatus(result) {
  if (!fmCheck()) return 0;
  W16(result, music.status());                                   // 0380:0d4e
  return 1;
}
// 14 dws_MClear (0380:0dd2 -> 0da2): 068a:02ca.
function fnMClear() { if (!fmCheck()) return 0; music.clear(); musicOut.stop(); return 1; }
// 15/16 dws_MPause / dws_MUnPause (0380:0e30 -> 0dfe / 0380:0e8e -> 0e5c): 068a:0401(1 / 0).
function fnMPause() { if (!fmCheck()) return 0; music.pause(); musicOut.pause(); return 1; }
function fnMUnPause() { if (!fmCheck()) return 0; music.unpause(); musicOut.resume(); return 1; }

// ---- DWT timer (segment 0530) ----------------------------------------------------------------------
// 17 dwt_Init (0530:009e, retf 2): pit.stkTimerInstall reproduces it (PIT 36h + divisor table
// 0530:0022, chain count 0530:001a, INT 8 hook; see pit.js). AX is pushed/popped around the body
// (0530:00a1 / 0120), so AX = its value at the call = the argument word (07f0:006e).
function fnDwtInit(rate) { pit.stkTimerInstall(rate & 0xffff); return rate & 0xffff; }
// 18 dwt_Kill (0530:0069, retf): pit.stkTimerKill. AX pushed/popped (0530:0069 / 009c): AX at the
// call = the client's EAX = 0 (0x1e319 `xor eax, eax`).
function fnDwtKill() { pit.stkTimerKill(); return 0; }

// dws_Update as called by the STK timer ISR 0530:002a every tick (cs:[0xe] = 0380:1af2 -> 1ad0):
// if [0x292] == 1 and [0x298] == 1: one sequencer step 068a:00cb.
// The music itself is a recording (music-out.js): after a step that rewound a looping song (tickCount is
// 0 only right after play/rewind), the recording restarts.
let musicSong = null;
function stkUpdate() {
  if (S.initted === 1 && S.fmOn === 1) {
    const wasPlaying = music.playing;
    music.tick();
    if (wasPlaying && music.playing && music.tickCount === 0) musicOut.start(musicSong);
  }
}

// ---- installation ----------------------------------------------------------------------------------
// Registers the functions with stk.js, the update with the STK timer (pit.setOnStkTick) and the sound
// card with the emulated clock (pit.setOnAdvance). Call after pc.install(); resets the TSR state.
// The driver API, called directly by the game's dws_* / dwt_* functions (lib/stk_client.js). Pointer
// arguments are flat addresses; each returns the driver's AX (1 ok / 0 error, see errno()).
export const stk = {
  errno: fnErrNo, DetectHardWare: fnDetectHardWare, Init: fnInit, Kill: fnKill,
  XMaster: fnXMaster, XMusic: fnXMusic, XDig: fnXDig,
  DPlay: fnDPlay, DSoundStatus: fnDSoundStatus, DSetRate: fnDSetRate, DGetRateFromDWD: fnDGetRateFromDWD,
  DDiscard: fnDDiscard, DPause: fnDPause, DUnPause: fnDUnPause,
  MPlay: fnMPlay, MSongStatus: fnMSongStatus, MClear: fnMClear, MPause: fnMPause, MUnPause: fnMUnPause,
  dwtInit: fnDwtInit, dwtKill: fnDwtKill,
};

export function install() {
  S.errno = 0; S.initted = 0; S.initBusy = 0; S.mixerInit = 0; S.fmOn = 0; S.digOn = 0;
  digi = null; music = null; everInit = false; dwdViews.clear();
  musicSong = null; musicOut.reset();
  card.reset();
  pit.setOnStkTick(stkUpdate);
  pit.setOnAdvance(card.advance);
}
