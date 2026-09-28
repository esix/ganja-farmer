// DiamondWare STK client: the dws_* / dwt_* functions the game calls (0x1ea27..0x1ffe0), stage 2.
// The original client (19 wrappers + 30 helpers, ported in stage 1) located the resident driver through
// the real-mode interrupt vectors, copied every argument block (and every DWD / DWM) into a DOS buffer
// and called it with INT 60h. Here each function calls the reimplemented driver (platform/sound/stkrun.js)
// directly with the game's flat pointers. What the game observes is the same: the structs it passes are
// read and written at the same offsets, and no function returns a value (the game never reads EAX).
// Dropped with the old client: its private state (0x30c60..0x3108c: session count, error code 0x30c7f,
// DOS-copy table), the stale scratch bytes it copied back into dr+0x32..0x3F (DetectHardWare) or into a
// status word when the driver refused the call, and its ORIGINAL BUG in 0x1e5f6 (a leftover EAX that
// could cancel a dws_DPlay / dws_MPlay although nothing failed).
import { register } from '../runtime/registry.js';
import { u8, R32 } from '../runtime/mem.js';
import { stk } from '../platform/sound/stkrun.js';

// The signature checks the client made before copying a DWD (0x1e43b) or DWM (0x1e3d9): 16 bytes.
const DIGI_SIG = 'DiamondWare Digi', MUSI_SIG = 'DiamondWare Musi';
function hasSig(addr, sig) {
  for (let i = 0; i < 16; i++) if (u8[addr + i] !== sig.charCodeAt(i)) return false;
  return true;
}

// dws_DetectHardWare(dov, dr): dov = dws_DETECTOVERRIDES (16 bytes), dr = dws_DETECTRESULTS (64 bytes).
register(0x1ea27, 'dws_DetectHardWare_1ea27', function dws_DetectHardWare(dov, dr) { stk.DetectHardWare(dov, dr); });

// dws_Init(dr, ideal): dr = detect results, ideal = dws_IDEAL (16 bytes, not written).
register(0x1ebe4, 'dws_Init_1ebe4', function dws_Init(dr, ideal) { stk.Init(dr, ideal); });

register(0x1eda6, 'dws_Kill_1eda6', function dws_Kill() { stk.Kill(); });
register(0x1ee3c, 'dws_XMaster_1ee3c', function dws_XMaster(vol) { stk.XMaster(vol); });
register(0x1eed0, 'dws_XMusic_1eed0', function dws_XMusic(vol) { stk.XMusic(vol); });
register(0x1ef64, 'dws_XDig_1ef64', function dws_XDig(vol) { stk.XDig(vol); });

// dws_DPlay(dp): dp = dws_DPLAY { snd +0 (DWD pointer), count +4, priority +6, presnd +8, soundnum +0xA };
// the driver writes soundnum.
register(0x1eff8, 'dws_DPlay_1eff8', function dws_DPlay(dp) {
  if (!hasSig(R32(dp) >>> 0, DIGI_SIG)) return;
  stk.DPlay(dp);
});

// dws_DSoundStatus(soundnum, result): *result (WORD) = bit 0 playing, bit 1 sequenced.
register(0x1f348, 'dws_DSoundStatus_1f348', function dws_DSoundStatus(soundnum, result) { stk.DSoundStatus(soundnum, result); });

register(0x1f3c3, 'dws_DSetRate_1f3c3', function dws_DSetRate(rate) { stk.DSetRate(rate); });

// dws_DGetRateFromDWD(snd, rate): *rate (WORD) = the DWD's sample rate.
register(0x1f5b3, 'dws_DGetRateFromDWD_1f5b3', function dws_DGetRateFromDWD(snd, rate) { stk.DGetRateFromDWD(snd, rate); });

register(0x1f770, 'dws_DDiscard_1f770', function dws_DDiscard(soundnum) { stk.DDiscard(soundnum); });
register(0x1f98a, 'dws_DPause_1f98a', function dws_DPause() { stk.DPause(); });
register(0x1fa16, 'dws_DUnPause_1fa16', function dws_DUnPause() { stk.DUnPause(); });

// dws_MPlay(mp): mp = dws_MPLAY { track +0 (DWM pointer), count +4 }. The client cleared the previous song
// (driver fn 0x14) before starting the new one.
register(0x1faa2, 'dws_MPlay_1faa2', function dws_MPlay(mp) {
  if (!hasSig(R32(mp) >>> 0, MUSI_SIG)) return;
  if (!stk.MClear()) return;
  stk.MPlay(mp);
});

// dws_MSongStatus(result): *result (WORD) = bit 0 playing, bit 1 paused.
register(0x1fc3f, 'dws_MSongStatus_1fc3f', function dws_MSongStatus(result) { stk.MSongStatus(result); });

register(0x1fe37, 'dws_MPause_1fe37', function dws_MPause() { stk.MPause(); });
register(0x1fec3, 'dws_MUnPause_1fec3', function dws_MUnPause() { stk.MUnPause(); });

// dwt_Init(rate) / dwt_Kill(): the STK timer on INT 8 (platform/pit.js).
register(0x1ff4f, 'dwt_Init_1ff4f', function dwt_Init(rate) { stk.dwtInit(rate); });
register(0x1ffe0, 'dwt_Kill_1ffe0', function dwt_Kill() { stk.dwtKill(); });
