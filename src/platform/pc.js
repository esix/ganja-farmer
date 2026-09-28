// The emulated PC under GANJAFRM.EXE: an io.js backend (IN/OUT/INT of the ported code) plus the
// interrupt sources (PIT/IRQ0, keyboard/IRQ1) and the browser attachment. Inventory and citations:
// re/HARDWARE.md. Only ports and interrupt functions the program uses are accepted; anything else
// throws, so an unexpected access shows up instead of being silently "emulated".
//
//   ports  20h (OUT)            PIC EOI          pic.js
//          40h, 43h (OUT)       PIT channel 0    pit.js
//          60h (IN), 61h (IN/OUT) keyboard       kbd.js
//          3C7h/3C8h (OUT), 3C9h (IN/OUT), 3DAh (IN)  VGA  vga.js
//   INT    10h AH=00h           video BIOS       vga.js
//          21h AH=25h/35h       PMODE/W vectors  dpmi.js (other AH: setDosHandler)
//          31h                  DPMI             dpmi.js
//          33h AX=0/2/3         mouse driver     mouse.js
import { setIoBackend } from '../runtime/io.js';
import { setYieldHook } from '../runtime/cpu.js';
import * as pic from './pic.js';
import * as pit from './pit.js';
import * as kbd from './kbd.js';
import * as vga from './vga.js';
import * as mouse from './mouse.js';
import * as dpmi from './dpmi.js';

const hex = (n) => '0x' + (n >>> 0).toString(16);

export const backend = {
  out(port, size, value) {
    if (size !== 1) throw new Error('pc: OUT ' + hex(port) + ' size ' + size + ' not used by the program');
    if (vga.out(port, value)) return;
    switch (port) {
      case 0x20: pic.writeCommand(value); return;
      case 0x40: case 0x43: pit.writePort(port, value); return;
      case 0x61: kbd.out61(value); return;
    }
    throw new Error('pc: OUT ' + hex(port) + ' not used by the program');
  },
  in(port, size) {
    if (size !== 1) throw new Error('pc: IN ' + hex(port) + ' size ' + size + ' not used by the program');
    const v = vga.inp(port);
    if (v !== undefined) return v;
    switch (port) {
      case 0x60: return kbd.in60();
      case 0x61: return kbd.in61();
    }
    throw new Error('pc: IN ' + hex(port) + ' not used by the program');
  },
  int(num, regs) {
    switch (num) {
      case 0x10: return vga.int10(regs);
      case 0x21: return dpmi.int21(regs);
      case 0x31: return dpmi.int31(regs);
      case 0x33: return mouse.int33(regs);
    }
    throw new Error('pc: INT ' + hex(num) + ' not emulated');
  },
};

// Power-on state: BIOS tick from the time of day, BIOS INT 8/INT 9 handlers. (The STK driver is called
// directly by lib/stk_client.js; nothing of STKRUN is resident in memory any more.) The DAC (display.dac) is not touched: it starts all zero, as the
// VGA BIOS leaves entries it does not load after POST ("The last 8 colors of the palette are only
// initialized to 0 at BIOS init", DOSBox-X int10_modes.cpp). The program's first video access is the
// mode 13h set at 0x1aa2b, which loads entries 0..247; entries 248..255 stay 0 until PCX_Load writes
// all 256. UNCERTAIN: the DAC register indices at program start are not reset here (the mode set
// resets them before any program access).
export function reset({ msSinceMidnight } = {}) {
  pic.reset(); dpmi.resetDpmi(); vga.reset(); mouse.reset(); kbd.reset();
  pit.install(); pit.reset(); kbd.install();
  if (msSinceMidnight === undefined) {
    const d = new Date();
    msSinceMidnight = ((d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds()) * 1000 + d.getMilliseconds();
  }
  pit.setBiosTicksFromTime(msSinceMidnight);
}

// Install as the io.js backend. Options:
//   onBiosKey(scan, ascii): BIOS keyboard buffer sink (console layer's push)
//   onStkTick(): STK update, called on every STK timer interrupt (sound layer)
//   dosHandler(regs): INT 21h functions other than 25h/35h (CRT/DOS layer), if they come through io.js
export function install(opts = {}) {
  reset(opts);
  if (opts.onBiosKey) kbd.setOnBiosKey(opts.onBiosKey);
  if (opts.onStkTick) pit.setOnStkTick(opts.onStkTick);
  if (opts.dosHandler) dpmi.setDosHandler(opts.dosHandler);
  return setIoBackend(backend);
}

// Browser: keyboard on the window, mouse on the canvas, the PIT clock, and the yield hook.
//
// Idle sleep (stage 2, not in the original): every yield comes from a busy-wait loop (PORTING.md), and
// what those loops wait for only changes on a timer interrupt (0x46C, STK counter, VGA retrace <= 14.3 ms)
// or an input event (keyboard ISR, mouse). So a yield brings the PIT up to date, then sleeps until the next
// IRQ0 is due or an input event arrives, and delivers the IRQ0s that fell due. The original polled
// thousands of times per tick; the loops see the same state changes, without a core spinning at 100%.
// Keyboard IRQs are delivered from the DOM event itself (kbd.js sendBytes), so waking is enough.
//
// Hidden tab: the machine is suspended (pause chosen by the user, 2026-09-28). While document.hidden, the
// next yield does not return until the page is visible again, and the PIT clock is stopped, so no
// instruction runs and no IRQ0 is delivered. On return pit.start() takes a new time base (lastMs = null),
// so the hidden time is skipped rather than caught up: the program resumes exactly where it was, like a
// machine that was paused (DOSBox's "pause" priority setting for an unfocused window). The BIOS time of
// day (0x46C) then lags the wall clock by the hidden time; apart from srand(Timer_Query()) once at
// start-up (0x1aa3f) the program uses 0x46C only for differences (Timer_Query, Time_Delay), so the lag is
// not observable. Why not keep running with PIT catch-up: browsers throttle timers in hidden tabs to about
// 1 per second (Chrome: 1 per minute after 5 minutes), so every yield would advance the clock by ~1 s
// (maxCatchUp, pit.js): an 18x "slow PC" with tick bursts the original never sees. Keys and mouse buttons
// held when the page was hidden are released by kbd.js/mouse.js (blur/visibilitychange).
const MAX_SLEEP_MS = 14; // about one VGA frame, so a retrace wait also wakes in time
const WAKE_EVENTS = ['keydown', 'keyup', 'pointerdown', 'pointerup', 'pointermove'];

export function attachBrowser(canvas) {
  const win = canvas.ownerDocument?.defaultView ?? globalThis;
  const doc = win.document;
  const offK = kbd.attach(win);
  const offM = mouse.attach(canvas);

  let resumeWaiters = [];
  const onVisibility = () => {
    if (doc.hidden) { pit.stop(); return; }
    pit.start(0);
    const w = resumeWaiters; resumeWaiters = [];
    for (const r of w) r();
  };
  let wakeSleeper = null;
  const wake = () => { if (wakeSleeper) wakeSleeper(); };
  doc.addEventListener('visibilitychange', onVisibility);
  for (const ev of WAKE_EVENTS) win.addEventListener(ev, wake, { capture: true });

  pit.start(0);
  if (doc.hidden) pit.stop(); // loaded in a background tab: suspended until first shown
  setYieldHook(async () => {
    if (doc.hidden) await new Promise((r) => resumeWaiters.push(r));
    pit.pump();
    const ms = Math.min(MAX_SLEEP_MS, pit.msUntilNextIrq());
    await new Promise((resolve) => {
      const done = () => { clearTimeout(t); wakeSleeper = null; resolve(); };
      const t = setTimeout(done, ms);
      wakeSleeper = done;
    });
    pit.pump();
  });

  return () => {
    offK(); offM(); pit.stop(); setYieldHook(null);
    doc.removeEventListener('visibilitychange', onVisibility);
    for (const ev of WAKE_EVENTS) win.removeEventListener(ev, wake, { capture: true });
  };
}

export { pic, pit, kbd, vga, mouse, dpmi };
export const { setOnStkTick, stkTimerInstall, stkTimerKill } = pit;
export const { setOnBiosKey } = kbd;
export const { selBase, rmLinear, SEL_CODE, SEL_DATA } = dpmi;
