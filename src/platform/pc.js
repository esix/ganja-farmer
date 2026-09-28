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
//          60h (STK vector)     STKRUN           stk.js
import { setIoBackend } from '../runtime/io.js';
import * as pic from './pic.js';
import * as pit from './pit.js';
import * as kbd from './kbd.js';
import * as vga from './vga.js';
import * as mouse from './mouse.js';
import * as dpmi from './dpmi.js';
import * as stkmod from './stk.js';

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
    if (num === stkmod.stkVector() && num !== 0) return stkmod.stkInterrupt(regs);
    // An INT 60h..66h with no STK installed: the real-mode vector is 0000:0000 (never called by the
    // client, which only uses the vector it discovered).
    throw new Error('pc: INT ' + hex(num) + ' not emulated');
  },
};

// Power-on state: BIOS tick from the time of day, BIOS INT 8/INT 9 handlers, STKRUN resident
// (GANJA.BAT runs `stkrun ganjafrm`). The DAC (display.dac) is not touched: it starts all zero, as the
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
  stkmod.installResident();
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

// Browser: keyboard on the window, mouse on the canvas, timer running.
export function attachBrowser(canvas) {
  const offK = kbd.attach(globalThis);
  const offM = mouse.attach(canvas);
  pit.start(1);
  return () => { offK(); offM(); pit.stop(); };
}

export { pic, pit, kbd, vga, mouse, dpmi };
export const stk = stkmod.stk;
export const { registerStkFunction } = stkmod;
export const { setOnStkTick, stkTimerInstall, stkTimerKill } = pit;
export const { setOnBiosKey } = kbd;
export const { selBase, rmLinear, SEL_CODE, SEL_DATA } = dpmi;
