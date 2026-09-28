// Tests for the emulated PC layer (src/platform/pc.js and parts). Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { u8, R32 } from '../src/runtime/mem.js';
import { outb, inb, int86 } from '../src/runtime/io.js';
import { register } from '../src/runtime/registry.js';
import { dac } from '../src/platform/display.js';
import { VGA_PALETTE_248, TEXT_PALETTE_64 } from '../src/platform/vga_palettes.js';
import * as pc from '../src/platform/pc.js';
import { keyBytes } from '../src/platform/kbd.js';
import * as con from '../src/platform/console.js';

let fakeMs = 0;
function fresh() {
  pc.install({ msSinceMidnight: 0 });
  fakeMs = 0;
  pc.pit.setClock(() => fakeMs);
  pc.pit.setMaxCatchUp(Infinity);
  pc.pit.pump(); // establish the time base
}

// ---------------- VGA DAC ----------------
test('DAC write: index auto-increment, 6-bit mask, update after blue', () => {
  fresh();
  dac.fill(0);
  outb(0x3c8, 5);
  outb(0x3c9, 0x3f); outb(0x3c9, 0x41); // r, g (0x41 & 0x3f = 1)
  assert.deepEqual([...dac.slice(15, 18)], [0, 0, 0], 'entry not written before blue');
  outb(0x3c9, 0xff);
  assert.deepEqual([...dac.slice(15, 18)], [0x3f, 0x01, 0x3f]);
  outb(0x3c9, 1); outb(0x3c9, 2); outb(0x3c9, 3); // continues at 6
  assert.deepEqual([...dac.slice(18, 21)], [1, 2, 3]);
  outb(0x3c8, 255); outb(0x3c9, 7); outb(0x3c9, 8); outb(0x3c9, 9); outb(0x3c9, 10); outb(0x3c9, 11); outb(0x3c9, 12);
  assert.deepEqual([...dac.slice(765, 768)], [7, 8, 9]);
  assert.deepEqual([...dac.slice(0, 3)], [10, 11, 12], 'index wraps 255 -> 0');
});

test('DAC read: 3C7 index, r,g,b then next entry; write index = read index + 1', () => {
  fresh();
  for (let i = 0; i < 768; i++) dac[i] = i & 0x3f;
  outb(0x3c7, 10);
  assert.deepEqual([inb(0x3c9), inb(0x3c9), inb(0x3c9)], [30 & 63, 31 & 63, 32 & 63]);
  assert.deepEqual([inb(0x3c9), inb(0x3c9), inb(0x3c9)], [33 & 63, 34 & 63, 35 & 63]);
  // Read_Color_Reg / Write_Color_Reg pattern used by Screen_Transition: read entry i, write entry i
  outb(0x3c7, 40); const r = inb(0x3c9), g = inb(0x3c9), b = inb(0x3c9);
  outb(0x3c8, 40); outb(0x3c9, r - 3); outb(0x3c9, g - 3); outb(0x3c9, b - 3);
  assert.deepEqual([...dac.slice(120, 123)], [r - 3, g - 3, b - 3]);
});

test('INT 10h AH=00h: mode 13h loads 248 default colors, clears VRAM; mode 3 loads 64 text colors', () => {
  fresh();
  dac.fill(33);
  u8.fill(0x55, 0xa0000, 0xb0000);
  int86(0x10, { ah: 0, al: 0x13 });
  assert.deepEqual([...dac.slice(0, 744)], [...VGA_PALETTE_248]);
  assert.deepEqual([...dac.slice(744)], new Array(24).fill(33), 'entries 248..255 untouched');
  assert.equal(u8.subarray(0xa0000, 0xb0000).every((x) => x === 0), true);
  assert.equal(pc.vga.videoMode, 0x13);
  // BIOS ends with OUT 3C7h,0; OUT 3C8h,0 -> write index 0 (read index 0-1 = 255)
  assert.deepEqual(pc.vga.dacState(), { writeIndex: 0, readIndex: 255, pel: 0 });
  // palette table spot checks against the IBM default: 0x0F white, gray ramp 16..31
  assert.deepEqual([...dac.slice(15 * 3, 16 * 3)], [63, 63, 63]);
  assert.deepEqual([...dac.slice(31 * 3, 32 * 3)], [63, 63, 63]);
  int86(0x10, { ah: 0, al: 0x03 });
  assert.deepEqual([...dac.slice(0, 192)], [...TEXT_PALETTE_64]);
  assert.equal(u8[0xb8000], 0x20); assert.equal(u8[0xb8001], 0x07);
  assert.throws(() => int86(0x10, { ah: 0x0b }));
});

test('3DAh bit 3: every vertical retrace is seen once by a polling loop (70.086 Hz)', () => {
  fresh();
  let t = 0;
  pc.vga.setVgaClock(() => t);
  let seen = 0, prev = 0;
  for (t = 0; t < 1000; t += 0.7) { // poll every 0.7 ms for 1 s
    const v = inb(0x3da) & 8;
    if (v && !prev) seen++;
    prev = v;
  }
  assert.ok(Math.abs(seen - 70) <= 1, 'retraces seen: ' + seen);
});

// ---------------- PIT / BIOS tick ----------------
test('BIOS tick at 18.2065 Hz from performance.now catch-up, exact over 1 hour', () => {
  fresh();
  const t0 = R32(0x46c);
  let irqs = 0;
  // coarse, jittery timer callbacks
  for (let ms = 0; ms < 3600000;) { ms += 3 + ((ms * 7) % 13); fakeMs = ms; irqs += pc.pit.pump(); }
  fakeMs = 3600000; irqs += pc.pit.pump();
  const expect = Math.floor(3600 * 1193182 / 65536);
  assert.equal(R32(0x46c) - t0, expect);
  assert.equal(irqs, expect);
});

test('STK timer rate 2: IRQ0 at 72.8 Hz, onStkTick every IRQ, BIOS tick still 18.2 Hz', () => {
  fresh();
  let stkTicks = 0;
  pc.pit.setOnStkTick(() => stkTicks++);
  pc.pit.stkTimerInstall(2);
  assert.equal(pc.pit.pitDivisor(), 0x4000);
  const t0 = R32(0x46c);
  fakeMs = 60000; pc.pit.pump();
  const irq = Math.floor(60 * 1193182 / 16384);
  assert.equal(stkTicks, irq);
  assert.equal(R32(0x46c) - t0, Math.floor(irq / 4));
  // exit sequence of the game: Timer_Program(0x40, 0xFFFF) then dwt_Kill
  outb(0x43, 0x3c); outb(0x40, 0xff); outb(0x40, 0xff);
  assert.equal(pc.pit.pitDivisor(), 0xffff);
  assert.equal(pc.pit.pitMode(), 2);
  pc.pit.stkTimerKill();
  assert.equal(pc.pit.pitDivisor(), 65536);
  assert.equal(pc.pit.rmInt8IsBios(), true);
  pc.pit.setOnStkTick(null);
});

test('BIOS tick midnight rollover', () => {
  fresh();
  u8[0x46c] = 0xaf; u8[0x46d] = 0x00; u8[0x46e] = 0x18; u8[0x46f] = 0; // 0x1800AF
  fakeMs = 1000 * 65536 / 1193182 + 0.001; pc.pit.pump();
  assert.equal(R32(0x46c), 0);
  assert.equal(u8[0x470], 1);
});

// ---------------- keyboard ----------------
test('scancode mapping (set 1, E0 keys, fake shifts, Pause)', () => {
  fresh();
  assert.deepEqual(keyBytes('Escape', true), [0x01]);
  assert.deepEqual(keyBytes('Escape', false), [0x81]);
  assert.deepEqual(keyBytes('KeyY', true), [0x15]);
  assert.deepEqual(keyBytes('Space', true), [0x39]);
  assert.deepEqual(keyBytes('Enter', true), [0x1c]);
  assert.deepEqual(keyBytes('NumpadEnter', true), [0xe0, 0x1c]);
  assert.deepEqual(keyBytes('ArrowUp', true), [0xe0, 0x48]);
  assert.deepEqual(keyBytes('ArrowUp', false), [0xe0, 0xc8]);
  assert.deepEqual(keyBytes('ControlRight', true), [0xe0, 0x1d]);
  keyBytes('ControlRight', false);
  keyBytes('ShiftLeft', true);
  assert.deepEqual(keyBytes('ArrowLeft', true), [0xe0, 0xaa, 0xe0, 0x4b]);
  assert.deepEqual(keyBytes('ArrowLeft', false), [0xe0, 0xcb, 0xe0, 0x2a]);
  keyBytes('ShiftLeft', false);
  assert.deepEqual(keyBytes('Pause', true), [0xe1, 0x1d, 0x45, 0xe1, 0x9d, 0xc5]);
  assert.deepEqual(keyBytes('Pause', false), []);
  assert.deepEqual(keyBytes('PrintScreen', true), [0xe0, 0x2a, 0xe0, 0x37]);
  assert.deepEqual(keyBytes('Numpad8', true), [0x48]);
  assert.deepEqual(keyBytes('F13', true), []);
});

// A stand-in for the ported Keyboard_Driver (0x22b04): what matters here is the port protocol.
const isrLog = [];
let isrHook = null;
register(0x22b04, 'Keyboard_Driver_test_stub_22b04', function () {
  if (isrHook) isrHook();
  const raw = inb(0x60);
  const v = inb(0x61) | 0x82; outb(0x61, v); outb(0x61, v & 0x7f);
  outb(0x20, 0x20);
  isrLog.push(raw);
});

test('IRQ1 -> installed PM INT 9 handler (INT 21h 25h/35h), one byte per interrupt', () => {
  fresh();
  const bios = [];
  pc.kbd.setOnBiosKey((s, a) => bios.push([s, a]));
  const old = int86(0x21, { ah: 0x35, al: 9 });
  int86(0x21, { ah: 0x25, al: 9, ds: pc.SEL_CODE, edx: 0x22b04 });
  isrLog.length = 0;
  pc.kbd.sendBytes(keyBytes('ArrowRight', true));
  pc.kbd.sendBytes(keyBytes('ArrowRight', false));
  assert.deepEqual(isrLog, [0xe0, 0x4d, 0xe0, 0xcd]);
  assert.deepEqual(bios, [], 'the game ISR does not chain: nothing reaches the BIOS buffer');
  // Keyboard_Remove_Driver restores the saved vector -> BIOS INT 9 is active again
  int86(0x21, { ah: 0x25, al: 9, ds: old.es, edx: old.ebx });
  pc.kbd.sendBytes(keyBytes('KeyA', true)); pc.kbd.sendBytes(keyBytes('KeyA', false));
  pc.kbd.sendBytes(keyBytes('ShiftLeft', true));
  pc.kbd.sendBytes(keyBytes('KeyA', true)); pc.kbd.sendBytes(keyBytes('KeyA', false));
  pc.kbd.sendBytes(keyBytes('ShiftLeft', false));
  pc.kbd.sendBytes(keyBytes('Enter', true));
  pc.kbd.sendBytes(keyBytes('Backspace', true));
  pc.kbd.sendBytes(keyBytes('F1', true));
  pc.kbd.sendBytes(keyBytes('ArrowUp', true));
  assert.deepEqual(bios, [[0x1e, 0x61], [0x1e, 0x41], [0x1c, 0x0d], [0x0e, 0x08], [0x3b, 0x00], [0x48, 0xe0]]);
  assert.equal(pc.pic.inService(1), 0);
  pc.kbd.setOnBiosKey(null);
});

test('key delivery first brings the PIT up to date: an overdue IRQ0 is serviced before IRQ1', () => {
  fresh();
  const old = int86(0x21, { ah: 0x35, al: 9 });
  int86(0x21, { ah: 0x25, al: 9, ds: pc.SEL_CODE, edx: 0x22b04 });
  const tick0 = R32(0x46c);
  const seen = [];
  isrHook = () => seen.push(R32(0x46c) - tick0);
  fakeMs += 60; // > one 18.2 Hz period (54.9 ms): IRQ0 is due, no pump has run yet
  pc.kbd.sendBytes(keyBytes('KeyA', true));
  pc.kbd.sendBytes(keyBytes('KeyA', false));
  isrHook = null;
  assert.deepEqual(seen, [1, 1], 'the BIOS tick was counted before the keyboard ISR ran');
  int86(0x21, { ah: 0x25, al: 9, ds: old.es, edx: old.ebx });
});

// ---------------- mouse ----------------
test('INT 33h in mode 13h: reset, hide, position 0..639 (even) x 0..199', () => {
  fresh();
  int86(0x10, { ah: 0, al: 0x13 });
  const r = int86(0x33, { ax: 0 });
  assert.equal(r.ax, 0xffff); assert.equal(r.bx, 2);
  int86(0x33, { ax: 2 });
  assert.equal(pc.mouse.state().showCount, -2);
  let p = int86(0x33, { ax: 3 });
  assert.deepEqual([p.cx, p.dx, p.bx], [320, 100, 0]);
  pc.mouse.hostMove(0, 0); p = int86(0x33, { ax: 3 });
  assert.deepEqual([p.cx, p.dx], [0, 0]);
  pc.mouse.hostMove(0.9999, 0.9999); p = int86(0x33, { ax: 3 });
  assert.deepEqual([p.cx, p.dx], [638, 199]);
  pc.mouse.hostMove(101.5 / 320, 57.5 / 200); pc.mouse.hostButtons(1); // pixel centres
  p = int86(0x33, { ax: 3 });
  assert.deepEqual([p.cx, p.dx, p.bx], [202, 57, 1]);
  assert.equal((p.cx >> 1) - 16, 85); // the game's conversion
  pc.mouse.hostButtons(3); assert.equal(int86(0x33, { ax: 3 }).bx, 3);
  assert.throws(() => int86(0x33, { ax: 1 }));
});

// ---------------- host integration: keyboard / DOS console ----------------
function readAll() { const r = []; for (let c; (c = con.dosReadCharNoEcho()) !== null;) r.push(c); return r; }

test('DOS getch (AH=08h, CON CHRIN): grey keys give 00h + scan, E0h only as a character', () => {
  fresh();
  con.clearKeys();
  pc.kbd.setOnBiosKey(con.push); // BIOS INT 9 is the active vector after power-on
  const tap = (code) => { pc.kbd.sendBytes(keyBytes(code, true)); pc.kbd.sendBytes(keyBytes(code, false)); };
  tap('KeyA'); tap('ArrowLeft'); tap('Home'); tap('Numpad4'); tap('NumpadEnter'); tap('F11');
  pc.kbd.sendBytes(keyBytes('ControlLeft', true)); tap('ArrowUp'); pc.kbd.sendBytes(keyBytes('ControlLeft', false));
  assert.equal(con.dosCheckInput(), 0xff);
  // 'a'; grey Left 4BE0h -> 00 4B; grey Home 47E0h -> 00 47; keypad 4 with NumLock off 4B00h -> 00 4B;
  // keypad Enter E00Dh -> 0D (AL != E0h); F11 8500h -> 00 85; Ctrl+grey Up 8DE0h -> 00 8D
  assert.deepEqual(readAll(), [0x61, 0, 0x4b, 0, 0x47, 0, 0x4b, 0x0d, 0, 0x85, 0, 0x8d]);
  assert.equal(con.dosCheckInput(), 0);
  con.push(0x00, 0xe0); // AL = E0h, AH = 0: the character E0h (Alt+224 on a real BIOS)
  con.push(0x00, 0x00); // 0000h: skipped by CHRIN
  con.push(0x72, 0x00); // Ctrl-PrtSc 7200h -> 10h
  assert.deepEqual(readAll(), [0xe0, 0x10]);
  // no key reachable through this BIOS model yields a first byte >= 80h other than E0h/AH=0
  pc.kbd.setOnBiosKey(null);
});

test('cooked CON input ignores extended keys (00h + scan is not inserted into the line)', () => {
  fresh();
  con.clearKeys(); con.clearOutput();
  con.push(0x1e, 0x61); con.push(0x4b, 0xe0); con.push(0x30, 0x62); con.push(0x1c, 0x0d);
  assert.deepEqual([...con.readCooked(10)], [0x61, 0x62, 0x0d, 0x0a]);
});

// Fake DOM targets (Node has EventTarget/Event).
function domEvent(type, props = {}) {
  const e = new Event(type, { cancelable: true });
  for (const [k, v] of Object.entries(props)) Object.defineProperty(e, k, { value: v });
  return e;
}

test('keys held when the page loses focus / is hidden get their break codes through IRQ1', () => {
  fresh();
  const old = int86(0x21, { ah: 0x35, al: 9 });
  int86(0x21, { ah: 0x25, al: 9, ds: pc.SEL_CODE, edx: 0x22b04 });
  const win = new EventTarget();
  win.document = new EventTarget(); win.document.hidden = false;
  const off = pc.kbd.attach(win);
  isrLog.length = 0;
  win.dispatchEvent(domEvent('keydown', { code: 'KeyJ' }));
  win.dispatchEvent(domEvent('keydown', { code: 'ArrowLeft' }));
  win.dispatchEvent(domEvent('keydown', { code: 'ArrowLeft' })); // typematic repeat
  assert.deepEqual(isrLog, [0x24, 0xe0, 0x4b, 0xe0, 0x4b]);
  isrLog.length = 0;
  win.dispatchEvent(domEvent('blur'));
  assert.deepEqual(isrLog, [0xe0, 0xcb, 0xa4], 'breaks for every held key, last pressed first');
  isrLog.length = 0;
  win.dispatchEvent(domEvent('blur'));
  assert.deepEqual(isrLog, [], 'nothing held any more');
  // visibilitychange -> hidden
  win.dispatchEvent(domEvent('keydown', { code: 'Space' }));
  win.dispatchEvent(domEvent('keyup', { code: 'Space' }));
  win.dispatchEvent(domEvent('keydown', { code: 'KeyP' }));
  isrLog.length = 0;
  win.document.dispatchEvent(domEvent('visibilitychange'));
  assert.deepEqual(isrLog, [], 'still visible: nothing released');
  win.document.hidden = true;
  win.document.dispatchEvent(domEvent('visibilitychange'));
  assert.deepEqual(isrLog, [0x99]);
  // Shift + grey arrow held: releasing in reverse order gives the AT fake-shift sequence
  win.document.hidden = false;
  win.dispatchEvent(domEvent('keydown', { code: 'ShiftLeft' }));
  win.dispatchEvent(domEvent('keydown', { code: 'ArrowRight' }));
  isrLog.length = 0;
  win.dispatchEvent(domEvent('blur'));
  assert.deepEqual(isrLog, [0xe0, 0xcd, 0xe0, 0x2a, 0xaa]);
  off();
  int86(0x21, { ah: 0x25, al: 9, ds: old.es, edx: old.ebx });
});

test('preventDefault only for keys the program can observe; Ctrl/Cmd combos and F1/F5..F12 pass', () => {
  fresh();
  const win = new EventTarget();
  const off = pc.kbd.attach(win);
  const prevented = (code, extra = {}) => {
    const e = domEvent('keydown', { code, ...extra });
    win.dispatchEvent(e);
    win.dispatchEvent(domEvent('keyup', { code, ...extra }));
    return e.defaultPrevented;
  };
  for (const c of ['KeyJ', 'ArrowLeft', 'Space', 'F2', 'F3', 'F4', 'Escape', 'Tab', 'Backspace', 'Slash', 'Quote', 'Numpad8'])
    assert.equal(prevented(c), true, c);
  for (const c of ['F1', 'F5', 'F11', 'F12', 'MetaLeft', 'ContextMenu']) assert.equal(prevented(c), false, c);
  assert.equal(prevented('KeyR', { ctrlKey: true }), false);
  assert.equal(prevented('KeyR', { metaKey: true }), false);
  assert.equal(prevented('KeyR', { altKey: true }), true);
  assert.equal(prevented('F13'), false, 'no AT key: not claimed');
  off();
});

// ---------------- host integration: mouse ----------------
function fakeCanvas() {
  const win = new EventTarget();
  const canvas = new EventTarget();
  let captured = null;
  canvas.ownerDocument = { defaultView: win };
  canvas.getBoundingClientRect = () => ({ left: 100, top: 50, width: 640, height: 480 });
  canvas.setPointerCapture = (id) => { captured = id; };
  canvas.hasPointerCapture = (id) => captured === id;
  canvas.release = () => { captured = null; canvas.dispatchEvent(domEvent('lostpointercapture')); };
  return { win, canvas };
}

test('mouse: pointer capture keeps the release, positions outside the canvas are cut to the range', () => {
  fresh();
  int86(0x10, { ah: 0, al: 0x13 });
  int86(0x33, { ax: 0 });
  const { win, canvas } = fakeCanvas();
  const off = pc.mouse.attach(canvas);
  const q = () => { const p = int86(0x33, { ax: 3 }); return [p.cx, p.dx, p.bx]; };
  // press inside at canvas pixel (320, 240) of 640x480 -> virtual (320, 100)
  const down = domEvent('pointerdown', { clientX: 420, clientY: 290, buttons: 1, pointerId: 7 });
  canvas.dispatchEvent(down);
  assert.equal(canvas.hasPointerCapture(7), true);
  assert.deepEqual(q(), [320, 100, 1]);
  // drag far right/below, outside canvas and window (captured: window-level move, target not the canvas)
  win.dispatchEvent(domEvent('pointermove', { clientX: 5000, clientY: 5000, buttons: 1, pointerId: 7 }));
  assert.deepEqual(q(), [638, 199, 1], 'cut at rangemax 639 (granulated to 638) / 199');
  win.dispatchEvent(domEvent('pointermove', { clientX: -50, clientY: -50, buttons: 1, pointerId: 7 }));
  assert.deepEqual(q(), [0, 0, 1], 'cut at rangemin 0');
  // release outside: delivered to the capturing canvas
  canvas.dispatchEvent(domEvent('pointerup', { clientX: -50, clientY: -50, buttons: 0, pointerId: 7 }));
  canvas.release();
  assert.deepEqual(q(), [0, 0, 0]);
  // uncaptured motion outside the canvas with a button held elsewhere: position moves, buttons unchanged
  win.dispatchEvent(domEvent('pointermove', { clientX: 5000, clientY: 60, buttons: 1, pointerId: 8 }));
  assert.deepEqual(q(), [638, 4, 0]);
  // capture lost mid-drag (e.g. focus lost): buttons released
  canvas.dispatchEvent(domEvent('pointerdown', { clientX: 420, clientY: 290, buttons: 2, pointerId: 9 }));
  assert.deepEqual(q(), [320, 100, 2]);
  canvas.release();
  assert.equal(q()[2], 0);
  canvas.dispatchEvent(domEvent('pointerdown', { clientX: 420, clientY: 290, buttons: 1, pointerId: 10 }));
  win.dispatchEvent(domEvent('blur'));
  assert.equal(q()[2], 0, 'window blur releases the buttons');
  off();
});

test('mouse reset: centre until the host pointer is seen; a known host position is kept (no jump)', () => {
  fresh();
  int86(0x10, { ah: 0, al: 0x13 });
  int86(0x33, { ax: 0 });
  let p = int86(0x33, { ax: 3 });
  assert.deepEqual([p.cx, p.dx], [320, 100], 'host pointer never seen: centre (CuteMouse softreset)');
  pc.mouse.hostMove(0.25, 0.5);
  p = int86(0x33, { ax: 3 });
  assert.deepEqual([p.cx, p.dx], [160, 100]);
  int86(0x33, { ax: 0 });
  p = int86(0x33, { ax: 3 });
  assert.deepEqual([p.cx, p.dx], [160, 100], 'after a reset the game arrow stays at the host pointer');
});

// ---------------- DPMI / STK ----------------
test('DPMI 0100h/0101h: DOS block at linear seg<<4; a double free fails', () => {
  fresh();
  const a = int86(0x31, { ax: 0x100, bx: 0x101 });
  assert.equal(a.cflag, 0);
  assert.equal(pc.selBase(a.dx), a.ax << 4);
  assert.equal(int86(0x31, { ax: 0x101, dx: a.dx }).cflag, 0);
  assert.equal(int86(0x31, { ax: 0x101, dx: a.dx }).cflag, 1, 'double free fails');
});

test('DPMI 0100h: first fit with MCBs, failure returns CF, AX=8, BX=largest', () => {
  fresh();
  const p = int86(0x31, { ax: 0x100, bx: 0x11f8 }); // the client's probe allocation
  assert.equal(p.cflag, 0);
  const b = int86(0x31, { ax: 0x100, bx: 0x101 });
  assert.equal(b.cflag, 0);
  // the 73.6 KB probe only fits the upper free area; the small block goes first-fit into the lower one
  assert.ok(p.ax >= 0x6680 && b.ax < 0x1000);
  const big = int86(0x31, { ax: 0x100, bx: 0xffff });
  assert.equal(big.cflag, 1); assert.equal(big.ax, 8); assert.ok(big.bx > 0 && big.bx < 0xffff);
  assert.equal(int86(0x31, { ax: 0x600, bx: 0, cx: 0, si: 0, di: 0x1000 }).cflag, 0);
});

test('DPMI selectors: PMODE/W GDT, 0000h top-down (TI=0, RPL=0), 0002h bottom-up and reused, 0101h frees', () => {
  fresh();
  // at program entry PMODE/W/extender hold 0x850..0x870; the top free slot is 0x848
  const p = int86(0x31, { ax: 0x100, bx: 0x11f8 });
  const b = int86(0x31, { ax: 0x100, bx: 0x101 });
  assert.deepEqual([p.dx, b.dx], [0x848, 0x840]);
  assert.equal(pc.selBase(b.dx), b.ax << 4);
  assert.equal(int86(0x31, { ax: 0x101, dx: p.dx }).cflag, 0);
  // the freed probe slot is the highest free one again; the next buffer goes below the first
  const p2 = int86(0x31, { ax: 0x100, bx: 0x11f8 });
  const b2 = int86(0x31, { ax: 0x100, bx: 0x101 });
  assert.deepEqual([p2.dx, b2.dx], [0x848, 0x838]);
  const g = int86(0x31, { ax: 6, bx: b2.dx });
  assert.equal(((g.cx << 16) | g.dx) >>> 0, b2.ax << 4);
  // 0002h: from 0x70 upward, same segment -> same selector
  assert.equal(int86(0x31, { ax: 2, bx: 0x700 }).ax, 0x70);
  assert.equal(int86(0x31, { ax: 2, bx: 0x800 }).ax, 0x78);
  assert.equal(int86(0x31, { ax: 2, bx: 0x700 }).ax, 0x70);
  // 0101h with a selector whose base is not a DOS block (DS, base 0): DOS error, descriptor kept
  const f = int86(0x31, { ax: 0x101, dx: pc.SEL_DATA });
  assert.equal(f.cflag, 1); assert.equal(f.ax, 9);
  assert.equal(pc.selBase(pc.SEL_DATA), 0);
  // 0006h on a free descriptor fails with the registers unchanged
  int86(0x31, { ax: 0x101, dx: p2.dx });
  const e = int86(0x31, { ax: 6, bx: p2.dx, cx: 0x1234 });
  assert.equal(e.cflag, 1); assert.equal(e.ax, 6); assert.equal(e.cx, 0x1234);
  // default PM vector 9: PMODE/W SELCODE:intrmatrix+9
  const v = int86(0x21, { ah: 0x35, al: 9 });
  assert.deepEqual([v.es, v.ebx], [0x08, 0x392 + 9]);
});

test('unused ports/interrupts are rejected', () => {
  fresh();
  assert.throws(() => outb(0x3c6, 0xff));
  assert.throws(() => inb(0x201));
  assert.throws(() => int86(0x16, { ah: 0 }));
});
