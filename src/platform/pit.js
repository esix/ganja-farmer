// 8253/8254 PIT channel 0 -> IRQ0, the BIOS INT 8 tick at 0x46C, and the DiamondWare STK timer
// ISR (the part of STKRUN.EXE that sits on INT 8). See re/HARDWARE.md §2.
//
// Who programs the PIT:
//   - STKRUN dwt install (fn 0x17, STKRUN 0530:009e): OUT 43h,36h; OUT 40h, divisor lo, hi with
//     divisor = {0x0000,0x8000,0x4000,0x2000}[rate] (table 0530:0022) and chain count {1,2,4,8}[rate]
//     (table 0530:001a). The game calls dwt_Init(2) (0x1aabf): divisor 0x4000 -> 72.8 Hz, chain every 4th.
//   - Timer_Program 0x2362c, called once at exit (0x1e022) with (0x40, 0xFFFF): OUT 43h,3Ch (0x23653),
//     OUT 40h,FFh (0x23664), OUT 40h,FFh (0x23678).
//   - STKRUN dwt kill (fn 0x18, STKRUN 0530:0069): OUT 43h,36h; OUT 40h,0; OUT 40h,0; restores INT 8.
// Who reads 0x46C: Timer_Query 0x2361b and Time_Delay 0x20429/0x20431 read the dword at flat 0x46C
// directly (DS base 0 under PMODE/W, so offset 0x46C is linear 0x46C = BIOS data area 0040:006C).
//
// Rates: PIT input clock 1193182 Hz (14.31818 MHz / 12). IRQ0 period = divisor clocks, divisor 0 = 65536
// (modes 2 and 3 alike).
import { u8 } from '../runtime/mem.js';
import * as pic from './pic.js';
import { setRmHandler, getRmHandler, hardwareInterrupt } from './dpmi.js';

export const PIT_HZ = 1193182;
const TICK_ADDR = 0x46c;
const MIDNIGHT_ADDR = 0x470;
const TICKS_PER_DAY = 0x1800b0; // BIOS rolls 0x46C over at 1573040 ticks

// ---- channel 0 ----------------------------------------------------------------------------------
let divisor = 65536;      // counts per IRQ0
let mode = 3;
let access = 3;           // 1 lo, 2 hi, 3 lo/hi
let writeHi = false;      // lo/hi flip-flop
let pendingLo = 0;
let phase = 0;            // PIT clocks elapsed in the current period (fractional)

function loadCount(c) {
  divisor = c === 0 ? 65536 : c;
  // Modes 2/3: writing the control word stops the count; the new count starts counting after it is
  // written, so the period restarts here.
  phase = 0;
}

export function writePort(port, v) {
  v &= 0xff;
  if (port === 0x43) {
    const sc = v >> 6;
    if (sc !== 0) throw new Error('pit: only channel 0 is programmed by the program (control 0x' + v.toString(16) + ')');
    const rw = (v >> 4) & 3;
    if (rw === 0) throw new Error('pit: counter latch command is not used by the program');
    access = rw;
    mode = (v >> 1) & 7;
    if (mode > 5) mode -= 4; // modes 6/7 are aliases of 2/3
    writeHi = false;
    return;
  }
  if (port === 0x40) {
    if (access === 1) loadCount(v);
    else if (access === 2) loadCount(v << 8);
    else if (!writeHi) { pendingLo = v; writeHi = true; }
    else { writeHi = false; loadCount(pendingLo | (v << 8)); }
    return;
  }
  throw new Error('pit: port 0x' + port.toString(16) + ' not used');
}
export const pitDivisor = () => divisor;
export const pitMode = () => mode;

// ---- BIOS INT 8 ---------------------------------------------------------------------------------
// IBM PC BIOS TIMER_INT: increment dword 0040:006C; at 0x1800B0 reset to 0 and set 0040:0070;
// then INT 1Ch and EOI. (The floppy motor count at 0040:0040 and INT 1Ch are not emulated: no code
// in this program reads the former or hooks the latter.)
function biosInt8() {
  let t = (u8[TICK_ADDR] | (u8[TICK_ADDR + 1] << 8) | (u8[TICK_ADDR + 2] << 16) | (u8[TICK_ADDR + 3] << 24)) >>> 0;
  t = (t + 1) >>> 0;
  if (t >= TICKS_PER_DAY) { t = 0; u8[MIDNIGHT_ADDR] = 1; }
  u8[TICK_ADDR] = t & 0xff; u8[TICK_ADDR + 1] = (t >>> 8) & 0xff;
  u8[TICK_ADDR + 2] = (t >>> 16) & 0xff; u8[TICK_ADDR + 3] = (t >>> 24) & 0xff;
  pic.writeCommand(0x20);
}

// BIOS boot: the tick count is set from the RTC time of day (seconds since midnight * 1193182/65536).
export function setBiosTicksFromTime(msSinceMidnight) {
  const t = Math.floor(msSinceMidnight * PIT_HZ / 65536 / 1000) % TICKS_PER_DAY;
  u8[TICK_ADDR] = t & 0xff; u8[TICK_ADDR + 1] = (t >>> 8) & 0xff;
  u8[TICK_ADDR + 2] = (t >>> 16) & 0xff; u8[TICK_ADDR + 3] = (t >>> 24) & 0xff;
}

// ---- STKRUN INT 8 ISR (0530:002a) ---------------------------------------------------------------
//   if (!paused) counter++;               0530:002d..0035  (dword cs:[6]; paused flag cs:[0x18])
//   if (--chainLeft == 0) { chainLeft = chainReload; pushf; call far oldInt8; }   0530:003b..004b
//   else out(0x20, 0x60);                 0530:0052  specific EOI IRQ0
//   sti; if (updateHook) updateHook();    0530:0056..0060  hook = 0380:1af2 (dws_Update entry)
let stkInstalled = false;
let stkChainReload = 1, stkChainLeft = 1, stkCounter = 0, stkPaused = 0;
let stkOldInt8 = null;
let onStkTick = null; // sound layer: the STK update routine called on every STK timer tick
export function setOnStkTick(fn) { onStkTick = fn; }

function stkInt8() {
  if (stkPaused !== 1) stkCounter = (stkCounter + 1) >>> 0;
  if (--stkChainLeft === 0) {
    stkChainLeft = stkChainReload;
    stkOldInt8();
  } else {
    pic.writeCommand(0x60);
  }
  if (onStkTick) onStkTick();
}

const STK_CHAIN = [1, 2, 4, 8];                  // 0530:001a
const STK_DIVISOR = [0x0000, 0x8000, 0x4000, 0x2000]; // 0530:0022

// STKRUN 0530:009e (dwt install, fn 0x17). Returns nothing; a second install is ignored (cs:[0x16]==1).
export function stkTimerInstall(rate) {
  if (stkInstalled) return;
  stkInstalled = true;
  const r = rate & 0xffff;
  // UNCERTAIN: STKRUN indexes the tables with `bx = rate*2` without a range check; rates > 3 read past
  // the tables. The game only passes 2.
  if (r > 3) throw new Error('stk timer: rate ' + r + ' outside the 4-entry tables');
  stkChainReload = stkChainLeft = STK_CHAIN[r];
  stkCounter = 0; stkPaused = 0;
  writePort(0x43, 0x36);
  writePort(0x40, STK_DIVISOR[r] & 0xff);
  writePort(0x40, STK_DIVISOR[r] >> 8);
  stkOldInt8 = setRmHandler(8, stkInt8); // INT 21h 3508h / 2508h (0530:00fb, 0530:0112)
}

// STKRUN 0530:0069 (dwt kill, fn 0x18).
export function stkTimerKill() {
  if (!stkInstalled) return;
  stkInstalled = false;
  writePort(0x43, 0x36);
  writePort(0x40, 0);
  writePort(0x40, 0);
  setRmHandler(8, stkOldInt8); // INT 21h 2508h (0530:0090)
}
export const stkTimerCounter = () => stkCounter;

// ---- scheduler ----------------------------------------------------------------------------------
// Browser timers are coarse and drift; IRQ0s are generated from the elapsed wall-clock time
// (performance.now()) in PIT clocks, so the long-run rate is exact whatever the callback jitter.
// All IRQ0s that became due since the last pump are delivered, each serviced separately.
let clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
let lastMs = null;
// DELIBERATE DEVIATION (re/HARDWARE.md §2): a host stall longer than this (background tab, debugger,
// GC pause) is dropped, not replayed, so 0x46C loses those ticks — as if the PC had been suspended.
// Replaying e.g. an hour of hidden-tab time would fire ~65000 BIOS ticks and ~262000 STK updates in
// one burst. setMaxCatchUp(Infinity) gives exact wall-clock replay.
let maxCatchUpMs = 1000;
export function setClock(fn) { clock = fn; lastMs = null; }
export function setMaxCatchUp(ms) { maxCatchUpMs = ms; }

// Other devices clocked by the same emulated time (the sound card: SB DMA byte clock and OPL2
// sample clock, platform/sound/soundcard.js). fn(pitClocks) is called for every stretch of time
// between IRQ0s, before the IRQ0 that ends it, so a device sees time in order with the STK timer
// ticks (e.g. OPL writes made by a tick land after the samples generated up to that tick).
let onAdvance = null;
export function setOnAdvance(fn) { onAdvance = fn; }

export function pump() {
  const now = clock();
  if (lastMs === null) { lastMs = now; return 0; }
  let dt = now - lastMs;
  lastMs = now;
  if (dt <= 0) return 0;
  if (dt > maxCatchUpMs) dt = maxCatchUpMs;
  let clocks = dt * PIT_HZ / 1000;
  let n = 0;
  while (phase + clocks >= divisor) {
    const step = divisor - phase;
    clocks -= step;
    phase = 0;
    if (onAdvance) onAdvance(step);
    pic.request(0);
    pic.service();
    n++;
  }
  phase += clocks;
  if (onAdvance && clocks > 0) onAdvance(clocks);
  return n;
}

let timer = null;
export function start(intervalMs = 1) {
  stop();
  lastMs = null;
  pump();
  timer = setInterval(pump, intervalMs);
}
export function stop() { if (timer) clearInterval(timer); timer = null; }

export function reset() {
  divisor = 65536; mode = 3; access = 3; writeHi = false; phase = 0; lastMs = null;
  stkInstalled = false; stkChainReload = stkChainLeft = 1; stkCounter = 0; stkPaused = 0; stkOldInt8 = null;
  setRmHandler(8, biosInt8);
}

// IRQ0 -> INT 8 (protected-mode vector; default reflects to the real-mode handler: BIOS or STKRUN).
export function install() {
  pic.setIrqHandler(0, () => hardwareInterrupt(8));
  setRmHandler(8, biosInt8);
}
export const rmInt8IsBios = () => getRmHandler(8) === biosInt8;
