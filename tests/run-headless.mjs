// Headless runner: boots GANJAFRM.EXE exactly like the browser (src/machine.js), with a virtual clock,
// scripted keyboard/mouse input and PNG snapshots of the screen (VGA memory through the DAC).
//
// Usage: node tests/run-headless.mjs [options]
//   --out DIR          snapshot directory (default: $TMPDIR/ganja-headless)
//   --script NAME|FILE built-in script name ("tour", "idle") or a JSON file of events (see SCRIPTS)
//   --max S            stop after S virtual seconds (default 600)
//   --every S          additionally snapshot every S virtual seconds
//   --realtime         use the wall clock instead of the virtual clock (for measuring the tick rate)
//   --step MS          virtual time per yield (default 1 ms)
//   --trace FILE       every 32 yields write "yield memHash dacHash oplHash": FNV-1a of game memory (data
//                      0x30000.., VGA 0xA0000.., heap 0x100000..+2 MB) and running hashes of the sound
//                      card's DAC bytes and the music driver's OPL writes. Two runs of the same code give
//                      identical files; refactors that keep behaviour must too (see docs). The dead part
//                      of the emulated stack (below the stack pointer) is not hashed.
//   --trace-skip A-B,… hex address ranges [A, B) left out of the memory hash (state the game never reads,
//                      e.g. a removed layer's private variables)
//   --trace-visible    hash only what the player perceives instead of memory: VGA memory + the DAC palette
//                      (plus the DAC/OPL hashes as always). For refactors that move heap addresses. The last
//                      line also hashes every file the program wrote (e.g. SCORES.DAT).
//
// Virtual clock: the PIT scheduler (pit.setClock) and the VGA retrace (vga.setVgaClock) read a virtual
// millisecond counter. Every yieldCpu() (the game's busy-wait loops, runtime/cpu.js) advances it by
// --step ms and delivers the IRQ0s that became due (pit.pump()). Work between yields takes no virtual
// time (an infinitely fast CPU); the game's frame loops wait on 0x46C tick deltas, so game speed in
// ticks is the original's.
//
// Events: { t: seconds since program start, snap: "name" } | { t, key: "KeyboardEvent.code", down: bool }
//         | { t, tap: "code", ms: hold } | { t, mouse: [x 0..639, y 0..199] } | { t, buttons: mask }
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { powerOn, runProgram, pc, con } from '../src/machine.js';
import { setYieldHook, hostYield } from '../src/runtime/cpu.js';
import { R32u, u8, DATA_BASE, DATA_END, VGA_BASE, HEAP_BASE } from '../src/runtime/mem.js';
import { stackPointer, STACK_LIMIT } from '../src/runtime/stack.js';
import { F } from '../src/runtime/registry.js';
import * as vfs from '../src/platform/vfs.js';
import * as display from '../src/platform/display.js';
import * as vga from '../src/platform/vga.js';

const root = new URL('../', import.meta.url).pathname;
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const flag = (name) => args.includes(name);
const outDir = opt('--out', join(tmpdir(), 'ganja-headless'));
const maxS = +opt('--max', 600);
const everyS = opt('--every', null);
const stepMs = +opt('--step', 1);
const traceFile = opt('--trace', null);
const traceVisible = flag('--trace-visible');
const traceSkip = (opt('--trace-skip', '') || '').split(',').filter(Boolean).map((r) => r.split('-').map((x) => parseInt(x, 16)));
const realtime = flag('--realtime');
mkdirSync(outDir, { recursive: true });

// ---- scripts ------------------------------------------------------------------------------------
// Menu hit boxes (0x11659, 11659_sub_11659.js): the pointer sprite is at x = (mouse_x sar 1) - 16,
// y = mouse_y; left button ([0x60b50] == 1):
//   start game  0x0f < x < 0x7e and 0x09 < y < 0x34  -> mouse (2*(x+16), y), e.g. x=60,y=30 -> (152, 30)
//   quit        0xca < x < 0x132 and 0x93 < y < 0xb5 -> e.g. x=250,y=160 -> (532, 160)
const SCRIPTS = {
  idle: [],
  tour: null, // filled below
};
function mouseClick(t, x, y) {
  return [{ t, mouse: [x, y] }, { t: t + 0.2, buttons: 1 }, { t: t + 0.5, buttons: 0 }];
}
SCRIPTS.tour = [
  { t: 2, snap: 'logo-xtreme' },
  { t: 7, snap: 'logo-evilx' },
  { t: 13, snap: 'title' },
  { t: 20, snap: 'menu' },
  ...mouseClick(21, 152, 30),          // PLAY
  { t: 23, snap: 'game-start' },
  { t: 26, snap: 'gameplay-5s' },
  { t: 26.5, key: 'ArrowLeft', down: true }, { t: 28, key: 'ArrowLeft', down: false },
  { t: 28.5, mouse: [300, 60] }, { t: 29, buttons: 1 }, { t: 29.4, snap: 'gameplay-firing' }, { t: 29.6, buttons: 0 },
  { t: 32, snap: 'gameplay-11s' },
  { t: 33, tap: 'Escape', ms: 200 },   // quit prompt (0x1d178: keyboard_state[1] -> confirmQuit)
  { t: 34, snap: 'quit-prompt' },
  { t: 35, tap: 'KeyY', ms: 200 },     // confirmQuit: keyboard_state[0x15] -> [0x30be4] = 0x1c
  { t: 38, snap: 'after-quit-game' },
  { t: 42, snap: 'after-quit-game-2' },
  ...mouseClick(44, 532, 160),         // QUIT on the menu -> [0x30be4] = 0x25 -> shutdown
];
let script = opt('--script', 'tour');
let events = SCRIPTS[script] ?? JSON.parse(readFileSync(script, 'utf8'));
events = events.map((e, i) => ({ ...e, i })).sort((a, b) => a.t - b.t || a.i - b.i);
if (everyS) for (let t = +everyS; t <= maxS; t += +everyS) events.push({ t, snap: `t${t.toFixed(1)}` });
events.sort((a, b) => a.t - b.t || (a.i ?? 1e9) - (b.i ?? 1e9));

// ---- PNG ----------------------------------------------------------------------------------------
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(width, height, pixels /* Uint32 ABGR */) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (width * 3 + 1);
    for (let x = 0; x < width; x++) {
      const p = pixels[y * width + x];
      raw[o + 1 + x * 3] = p & 0xff; raw[o + 2 + x * 3] = (p >>> 8) & 0xff; raw[o + 3 + x * 3] = (p >>> 16) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ---- machine ------------------------------------------------------------------------------------
for (const n of readdirSync(root + 'assets/game')) vfs.mountBytes(n, readFileSync(root + 'assets/game/' + n));
// No store: SCORES.DAT writes stay in memory (the original directory is not modified).

let vms = 0; // virtual milliseconds since power-on
const clockMs = realtime ? () => performance.now() : () => vms;
pc.pit.setClock(clockMs);
vga.setVgaClock(clockMs);
powerOn({
  dataInit: readFileSync(root + 'assets/boot/data_init.bin'),
  font: readFileSync(root + 'assets/boot/font8x8.bin'),
  msSinceMidnight: realtime ? undefined : 12 * 3600 * 1000, // fixed BIOS time of day for reproducible runs
});

// ---- sound --------------------------------------------------------------------------------------
// SINGLE CALL SITE for the sound layer (platform/sound/index.js), as in boot.js. No host audio output
// (attachBrowserAudio) headless.
const sound = await import('../src/platform/sound/index.js');
sound.install();

// ---- events, snapshots ----------------------------------------------------------------------------
const tick = () => R32u(0x46c);
let t0 = null, tick0 = 0;
const nowS = () => (clockMs() - t0) / 1000;
const shots = [];
function snap(name) {
  const f = display.renderFrame();
  const file = join(outDir, `${String(shots.length).padStart(2, '0')}-${name}.png`);
  writeFileSync(file, png(f.width, f.height, f.pixels));
  const line = `${file}  t=${nowS().toFixed(2)}s ticks=${tick() - tick0} mode=${vga.videoMode.toString(16)}h`;
  shots.push(line);
  console.log('snap', line);
}
const held = [];
function runEvents() {
  const s = nowS();
  while (events.length && events[0].t <= s) {
    const e = events.shift();
    if (e.snap) snap(e.snap);
    else if (e.key) pc.kbd.sendBytes(pc.kbd.keyBytes(e.key, !!e.down));
    else if (e.tap) {
      pc.kbd.sendBytes(pc.kbd.keyBytes(e.tap, true));
      events.push({ t: e.t + (e.ms ?? 100) / 1000, key: e.tap, down: false });
      events.sort((a, b) => a.t - b.t);
    } else if (e.mouse) pc.mouse.hostMove(e.mouse[0] / 640, e.mouse[1] / 200);
    else if (e.buttons !== undefined) pc.mouse.hostButtons(e.buttons);
  }
}

// ---- trace (--trace) ------------------------------------------------------------------------------
const traceLines = [];
const writtenFiles = new Set();
if (traceFile) {
  vfs.setStore({ load: () => null, save: (name) => writtenFiles.add(name) });
}
const fnv = (h, b) => Math.imul(h ^ b, 0x01000193);
let dacHash = 0x811c9dc5 | 0, oplHash = 0x811c9dc5 | 0;
function memHash() {
  let h = 0x811c9dc5 | 0;
  if (traceVisible) {
    for (let x = VGA_BASE; x < VGA_BASE + 64000; x++) h = Math.imul(h ^ u8[x], 0x01000193);
    for (const b of display.dac) h = Math.imul(h ^ b, 0x01000193);
    return h >>> 0;
  }
  const skip = [[STACK_LIMIT, stackPointer()], ...traceSkip].sort((p, q) => p[0] - q[0]);
  for (const [a, b] of [[DATA_BASE, DATA_END], [VGA_BASE, VGA_BASE + 64000], [HEAP_BASE, HEAP_BASE + 0x200000]]) {
    let x = a;
    for (const [p, q] of [...skip.filter(([p, q]) => q > a && p < b), [b, b]]) {
      for (const e = Math.min(p, b); x < e; x++) h = Math.imul(h ^ u8[x], 0x01000193);
      x = Math.max(x, q);
    }
  }
  return h >>> 0;
}
function traceLine() { traceLines.push(`${yields} ${memHash().toString(16)} ${(dacHash >>> 0).toString(16)} ${(oplHash >>> 0).toString(16)}`); }
if (traceFile) {
  const card = await import('../src/platform/sound/soundcard.js');
  card.setDigitalTap((bytes) => { for (const b of bytes) dacHash = fnv(dacHash, b); });
  card.setOplTap((r, v) => { oplHash = fnv(fnv(oplHash, r), v); });
}

let yields = 0;
class Stop extends Error {}
setYieldHook(() => {
  yields++;
  if (traceFile && (yields & 31) === 0) traceLine();
  if (!realtime) vms += stepMs;
  pc.pit.pump();
  if (t0 !== null) {
    runEvents();
    if (nowS() > maxS) throw new Stop(`stopped at the --max limit (${maxS} s)`);
  }
  if (realtime || (yields & 0xfff) === 0) return realtime ? hostYield() : new Promise((r) => setImmediate(r));
  return Promise.resolve();
});
if (realtime) pc.pit.start(1);

// ---- run ----------------------------------------------------------------------------------------
t0 = clockMs(); tick0 = tick();
const wall0 = performance.now();
let result = null, crash = null;
try {
  result = await runProgram();
} catch (e) {
  crash = e;
}
if (traceFile) {
  traceLine();
  let fh = 0x811c9dc5 | 0;
  for (const n of [...writtenFiles].sort()) { for (const c of n) fh = fnv(fh, c.charCodeAt(0)); for (const b of vfs.read(n)) fh = fnv(fh, b); }
  traceLines.push(`files ${[...writtenFiles].sort().join(',') || '-'} ${(fh >>> 0).toString(16)}`);
  writeFileSync(traceFile, traceLines.join('\n') + '\n'); console.log('trace:', traceFile, traceLines.length, 'lines'); }
const elapsed = nowS();
const ticks = tick() - tick0;
if (crash && !(crash instanceof Stop)) {
  snap('crash');
  console.log('CRASH:', crash.stack);
} else if (crash) {
  snap('stopped');
  console.log(crash.message);
} else {
  snap('exit');
  console.log('main returned', result.ret, '-> exit code', result.exitCode);
}
console.log(`time: ${elapsed.toFixed(2)} s ${realtime ? 'wall' : 'virtual'} (${((performance.now() - wall0) / 1000).toFixed(2)} s wall), ` +
  `BIOS ticks: ${ticks} -> ${(ticks / elapsed).toFixed(4)} ticks/s (PIT: 1193182/65536 = 18.2065), yields: ${yields}`);
console.log('STK timer counter:', pc.pit.stkTimerCounter?.());
console.log('console output:', JSON.stringify(con.outputText()));
pc.pit.stop();
process.exit(crash && !(crash instanceof Stop) ? 1 : 0);
