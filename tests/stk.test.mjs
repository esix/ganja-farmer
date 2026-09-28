// STK service layer (src/platform/sound/stkrun.js) driven through the real INT path: the ported
// client stubs (src/lib/*dws_*.js) -> INT 60h -> stk.js -> stkrun.js -> digi-mixer.js /
// dwm-player.js, with the emulated clock (pit.js) driving the STK timer and the sound card.
// Run: node --test tests/stk.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { loadInitialData, loadRomFont, u8, R8, R16, R32, W16, W32, writeCString } from '../src/runtime/mem.js';
import { F } from '../src/runtime/registry.js';
import * as vfs from '../src/platform/vfs.js';
import * as pc from '../src/platform/pc.js';
import * as con from '../src/platform/console.js';
import { crtInit } from '../src/lib/index.js';
import * as stkrun from '../src/platform/sound/stkrun.js';
import * as card from '../src/platform/sound/soundcard.js';
import * as musicOut from '../src/platform/sound/music-out.js';
import { DigiMixer } from '../src/platform/sound/digi-mixer.js';
import { STKMusic } from '../src/platform/sound/dwm-player.js';
import * as sounds from '../src/platform/sounds.js';

const root = new URL('../', import.meta.url).pathname;
const GANJA = root + 'assets/game/';
loadInitialData(readFileSync(root + 'assets/boot/data_init.bin'));
loadRomFont(readFileSync(root + 'assets/boot/font8x8.bin'));
for (const n of readdirSync(GANJA)) vfs.mountBytes(n, readFileSync(GANJA + n));
sounds.mountAll(); // *.WAV -> *.DWD, as runProgram does
const snapshot = u8.slice(0, 0x800000);

let fakeMs = 0;
let dig = [];      // DAC bytes played (sound card tap)
let oplw = [];     // OPL register writes (sound card tap)
function boot() {
  u8.set(snapshot);
  pc.install({ onBiosKey: con.push, msSinceMidnight: 0 });
  crtInit();
  stkrun.install();
  fakeMs = 0;
  pc.pit.setClock(() => fakeMs);
  pc.pit.setMaxCatchUp(Infinity);
  pc.pit.pump();
  dig = []; oplw = [];
  card.setDigitalTap((b) => { for (const x of b) dig.push(x); });
  card.setOplTap((r, v) => oplw.push((r << 8) | v));
  card.setSink(null);
}
// Advance emulated time in 1 ms steps (as the browser's setInterval(pump, 1) does).
function runMs(ms) { for (let i = 0; i < ms; i++) { fakeMs += 1; pc.pit.pump(); } }
function runStkTicks(n) {
  const target = pc.pit.stkTimerCounter() + n;
  while (pc.pit.stkTimerCounter() < target) { fakeMs += 1; pc.pit.pump(); }
  assert.equal(pc.pit.stkTimerCounter(), target);
}
function str(s) { const a = F.malloc_23dab(s.length + 1); writeCString(a, s); return a; }
function loadFile(name) { // the game's Load_File 0x232fb (fopen/fread through the CRT and the VFS)
  const pp = F.malloc_23dab(4);
  F.Load_File_232fb(str(name), pp);
  return R32(pp);
}
// The game's start-up (0x1aa49..0x1aac4): overrides 0xFFFF, dws_DetectHardWare, dws_IDEAL, dws_Init, dwt_Init(2).
async function gameInit() {
  W16(0x60ff0, 0xffff); W16(0x60ff2, 0xffff); W16(0x60ff4, 0xffff);
  await F.dws_DetectHardWare_1ea27(0x60ff0, 0x61000);
  W16(0x61040, 1); W16(0x61042, 8); W16(0x61044, 0x2aed); W16(0x61046, 0x10); W16(0x61048, 1);
  await F.dws_Init_1ebe4(0x61000, 0x61040);
  await F.dwt_Init_1ff4f(2);
}
const clientErr = () => R32(0x30c7f); // STK client last-error dword (0x1e3c0 stores fn 0's result)
const dwdHdr = (b) => ({ rate: b[0x20] | (b[0x21] << 8), len: b[0x26] | (b[0x27] << 8), off: b[0x2e] | (b[0x2f] << 8) });

test('handshake, detect results, init state', async () => {
  boot();
  await gameInit();
  assert.equal(R8(0x31087), 0x60, 'client found the STK vector');
  assert.equal(clientErr(), 0);
  const s = stkrun.state();
  // errno 0xDE: left by the client's handshake XMaster(6969h) (0380:0b5c); no later call failed
  assert.deepEqual([s.errno, s.initted, s.initBusy, s.mixerInit, s.fmOn, s.digOn], [0xde, 1, 0, 1, 1, 1]);
  // dws_DETECTRESULTS as written by 0380:13e6 for the assumed setup (stkrun.js SETUP)
  const w = (o) => R16(0x61000 + o);
  assert.deepEqual([w(0), w(2), w(4), w(6), w(8), w(0xa), w(0xc), w(0xe), w(0x10), w(0x12)],
    [0x220, 3, 1, 1, 0xb, 8, 1, 1, 7, 1]);
  assert.deepEqual([w(0x18), w(0x1a), w(0x1c), w(0x1e), w(0x26), w(0x28), w(0x2c)], [0, 0xffff, 2, 0x228, 0x201, 0x220, 0]);
  assert.deepEqual([R16(0x61044), R16(0x61046)], [10989, 16], 'dws_IDEAL copied back unchanged');
  assert.equal(s.digi.outputRate, 1000000 / 91);
  assert.equal(s.digi.blockSize, 256);
  // STK timer: 72.8 Hz, BIOS tick still 18.2 Hz
  const t0 = R32(0x46c);
  runMs(10000);
  assert.ok(Math.abs(pc.pit.stkTimerCounter() - 728.26) <= 1, 'STK ticks ' + pc.pit.stkTimerCounter());
  assert.ok(Math.abs(R32(0x46c) - t0 - 182.06) <= 1, 'BIOS ticks ' + (R32(0x46c) - t0));
  // shutdown as 0x1e018: Timer_Program(0x40, 0xffff), dwt_Kill, dws_Kill
  await F.dwt_Kill_1ffe0();
  assert.equal(pc.pit.rmInt8IsBios(), true);
  await F.dws_Kill_1eda6();
  assert.equal(stkrun.state().initted, 0);
  assert.equal(card.digitalRunning(), false);
});

test('errors reach the client through fn 0 (dws_ErrNo)', async () => {
  boot();
  W32(0x61280, loadFile('explo.dwd')); W16(0x61284, 1); W16(0x61286, 0x320); W16(0x61288, 0);
  await F.dws_DPlay_1eff8(0x61280);         // before dws_Init: 0380:1043 -> errno 1
  assert.equal(clientErr(), 1);
  const res = F.malloc_23dab(2);
  await F.dws_MSongStatus_1fc3f(res);
  assert.equal(clientErr(), 1);
  // DGetRateFromDWD has no initted check (0380:0fb8)
  W16(0x61044, 0);
  await F.dws_DGetRateFromDWD_1f5b3(R32(0x61280), 0x61044);
  assert.equal(R16(0x61044), 10989);
  await gameInit();
  await F.dws_XDig_1ef64(256);              // 0380:0c27 -> 9
  assert.equal(clientErr(), 9);
  await F.dws_DSetRate_1f3c3(3000);         // 0380:0ee3 -> 0xE
  assert.equal(clientErr(), 0xe);
});

test('DPlay: EXPLO.DWD through the DOS copy, DAC bytes = 0x80 + samples from block 2 on', async () => {
  boot();
  await gameInit();
  const snd = loadFile('explo.dwd');
  const bytes = vfs.read('EXPLO.DWD'); // rebuilt from EXPLO.WAV by sounds.mountAll()
  const h = dwdHdr(bytes);
  // the game's struct for explo.dwd (0x1c5af..0x1c5ef)
  W32(0x61280, snd); W16(0x61284, 1); W16(0x61286, 0x320); W16(0x61288, 0);
  await F.dws_DGetRateFromDWD_1f5b3(R32(0x61280), 0x61044);
  assert.equal(R16(0x61044), 10989);
  await F.dws_DPlay_1eff8(0x61280);
  assert.equal(clientErr(), 0);
  assert.equal(R16(0x6128a), 11, 'soundnum');
  const st = F.malloc_23dab(2);
  await F.dws_DSoundStatus_1f348(11, st);
  assert.equal(R16(st), 1);
  runMs(Math.ceil((h.len + 1024) / 10.989) + 50);
  // DIGI.md §2: a call after p = 0 bytes is heard from byte 2*B; the two blocks before are the
  // DMA buffer's initial contents (0x80). §4: out = 0x80 + signed sample (byte add), no scaling.
  assert.ok(dig.length > 512 + h.len + 256);
  for (let i = 0; i < 512; i++) assert.equal(dig[i], 0x80, 'byte ' + i);
  for (let i = 0; i < h.len; i++) assert.equal(dig[512 + i], (0x80 + bytes[h.off + i]) & 0xff, 'sample ' + i);
  for (let i = 512 + h.len; i < dig.length; i++) assert.equal(dig[i], 0x80, 'byte ' + i);
  await F.dws_DSoundStatus_1f348(11, st);
  assert.equal(R16(st), 0, 'finished');
});

test('DPlay/DDiscard/DSoundStatus/DPause sequence equals the reference mixer at the same byte positions', async () => {
  boot();
  await gameInit();
  const names = ['click.dwd', 'gewtshot.dwd', 'ufo2.dwd', 'explo.dwd'];
  const ptr = {}, file = {};
  for (const n of names) { ptr[n] = loadFile(n); file[n] = vfs.read(n); }
  const S = F.malloc_23dab(0x20 * names.length);
  const res = F.malloc_23dab(2);
  // reference: re/digi/digi-mixer.js fed with the file bytes, the same calls at the same DAC byte positions
  const ref = new DigiMixer({ rate: 10989, nvoices: 16 });
  const out = [];
  const refRun = (p) => { if (p > out.length) for (const x of ref.renderU8(new Uint8Array(p - out.length))) out.push(x); };
  const ops = [
    [0, 'play', 'ufo2.dwd', 0, 50], [0, 'play', 'click.dwd', 3, 200], [300, 'play', 'gewtshot.dwd', 1, 100],
    [900, 'status', 11], [1300, 'discard', 11], [1500, 'pause'], [1700, 'unpause'], [1800, 'play', 'explo.dwd', 1, 800],
    [2600, 'status', 11], [2600, 'status', 14], [3500, 'rate', 11025], [4200, 'discard', 14],
  ];
  const statuses = [];
  let k = 0;
  for (const [ms, op, a, b, c] of ops) {
    runMs(ms - (fakeMs - 0));
    refRun(dig.length);
    if (op === 'play') {
      const s = S + 0x20 * (k++ % names.length);
      W32(s, ptr[a]); W16(s + 4, b); W16(s + 6, c); W16(s + 8, 0);
      await F.dws_DPlay_1eff8(s);
      const d = { snd: file[a], count: b, priority: c, presnd: 0 };
      ref.DPlay(d);
      assert.equal(R16(s + 0xa), d.soundnum);
    } else if (op === 'status') {
      await F.dws_DSoundStatus_1f348(a, res);
      statuses.push(R16(res));
      assert.equal(R16(res), ref.DSoundStatus(a).status);
    } else if (op === 'discard') { await F.dws_DDiscard_1f770(a); ref.DDiscard(a); }
    else if (op === 'pause') { await F.dws_DPause_1f98a(); ref.DPause(); }
    else if (op === 'unpause') { await F.dws_DUnPause_1fa16(); ref.DUnPause(); }
    else if (op === 'rate') { await F.dws_DSetRate_1f3c3(a); ref.DSetRate(a); }
  }
  runMs(1000);
  refRun(dig.length);
  assert.equal(clientErr(), 0);
  assert.ok(dig.some((x) => x !== 0x80));
  assert.deepEqual(statuses.slice(0, 1), [1]);
  assert.equal(dig.length, out.length);
  for (let i = 0; i < dig.length; i++) if (dig[i] !== out[i]) assert.fail('DAC byte ' + i + ': ' + dig[i] + ' != ' + out[i]);
});

test('MPlay: OPL register writes equal re/music player output for the same file and ticks (F1.DWM, F6.DWM)', async () => {
  boot();
  await gameInit();
  // reference: re/music/dwm-player.js (verified against STKRUN) driven directly
  const ref = [];
  const drv = new STKMusic((r, v) => ref.push((r << 8) | v));
  assert.deepEqual(oplw, ref, 'dws_Init: FM reset, rhythm setup, mixer init (159 writes)');
  assert.equal(ref.length, 159);
  await F.dws_XMusic_1eed0(0xfe);           // as the game (0x1c567 chunk)
  drv.setMusicVolume(0xfe);
  const mp = F.malloc_23dab(0x10);
  const st = F.malloc_23dab(2);
  for (const [name, ticks] of [['F1.DWM', 402], ['F6.DWM', 146]]) {
    W32(mp, loadFile(name.toLowerCase())); W16(mp + 4, 1);
    await F.dws_MPlay_1faa2(mp);            // client: fn 0x14 (MClear, 0x1fd9b) then fn 0x12
    assert.equal(clientErr(), 0);
    const buf = new Uint8Array(readFileSync(GANJA + name));
    drv.clear(); drv.play(buf, 1);
    await F.dws_MSongStatus_1fc3f(st);
    assert.equal(R16(st), 1);
    runStkTicks(ticks - 1);
    for (let i = 0; i < ticks - 1; i++) drv.tick();
    assert.deepEqual(oplw, ref);
    await F.dws_MSongStatus_1fc3f(st);
    assert.equal(R16(st), 1, name + ' still playing after ' + (ticks - 1) + ' ticks');
    runStkTicks(1); drv.tick();
    await F.dws_MSongStatus_1fc3f(st);
    assert.equal(R16(st), 0, name + ' ends on tick ' + ticks + ' (PLAYER.md §3)');
    assert.deepEqual(oplw, ref);
  }
  // pause / unpause / kill
  W32(mp, loadFile('f0.dwm')); W16(mp + 4, 1);
  await F.dws_MPlay_1faa2(mp); drv.clear(); drv.play(new Uint8Array(readFileSync(GANJA + 'F0.DWM')), 1);
  runStkTicks(100); for (let i = 0; i < 100; i++) drv.tick();
  await F.dws_MPause_1fe37(); drv.pause();
  await F.dws_MSongStatus_1fc3f(st);
  assert.equal(R16(st), 3);
  runStkTicks(50);
  await F.dws_MUnPause_1fec3(); drv.unpause();
  runStkTicks(200); for (let i = 0; i < 200; i++) drv.tick();
  await F.dwt_Kill_1ffe0();
  await F.dws_Kill_1eda6(); drv.clear(); drv.fmKill();
  assert.deepEqual(oplw, ref);
  assert.ok(ref.length > 1000);
});

test('sound card output: the DAC is resampled to the host rate; dws_MPlay names the recording to play', async () => {
  boot();
  const frames = [];
  card.setSink({ rate: 48000, write(f) { for (const x of f) frames.push(x); } });
  await gameInit();
  W32(0x61280, loadFile('explo.dwd')); W16(0x61284, 1); W16(0x61286, 0x320); W16(0x61288, 0);
  await F.dws_DPlay_1eff8(0x61280);
  const mp = F.malloc_23dab(0x10);
  const song = loadFile('f1.dwm');
  W32(mp, song); W16(mp + 4, 1);
  await F.dws_MPlay_1faa2(mp);
  assert.equal(musicOut.songName(u8.subarray(song)), 'F1');
  runMs(2000);
  assert.ok(Math.abs(frames.length - 96000) <= 2, 'frames ' + frames.length);
  let peak = 0; for (const x of frames) peak = Math.max(peak, Math.abs(x));
  assert.ok(peak > 0.01 && peak <= 1, 'peak ' + peak);
  card.setSink(null);
});

test('music volume curve: silent at 0, unity at 255, rising in between', () => {
  assert.equal(musicOut.gainFor(0), 0);
  assert.equal(musicOut.gainFor(255), 1);
  let last = 0;
  for (let v = 1; v <= 255; v++) { const g = musicOut.gainFor(v); assert.ok(g > last, 'v ' + v); last = g; }
});
