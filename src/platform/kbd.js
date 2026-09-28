// Keyboard: PC/AT keyboard (scan code set 1 as delivered by the 8042), the 8042 output port 0x60,
// system control port B 0x61, IRQ1 -> INT 9, and the BIOS INT 9 handler (firmware) for the time the
// game's own handler is not installed. See re/HARDWARE.md §3.
//
// The program's use:
//   Keyboard_Install_Driver 0x22bd7: INT 21h AH=35h AL=9 (0x22c1e), saves ES:EBX to 0x64efc:0x64ef8,
//     INT 21h AH=25h AL=9 DS:EDX = CS:0x22b04 (0x22c4a). Called at 0x1aa3a (start) and 0x10b55.
//   Keyboard_Remove_Driver 0x22c58: INT 21h AH=25h AL=9 with the saved vector (0x22c87). Called at
//     0x10a58 (before the high-score name entry, which then reads keys with kbhit/getch = INT 21h
//     AH=0Bh/08h, i.e. from the BIOS buffer) and at 0x1e031 (exit).
//   Keyboard_Driver (ISR) 0x22b04: IN 60h (0x22b23) -> raw_key 0x64f00; IN 61h (0x22b32);
//     OUT 61h, v|82h (0x22b46); OUT 61h, (v|82h)&7Fh (0x22b59); OUT 20h,20h (0x22b68); updates
//     keyboard_state[] 0x64f04 / keys_active 0x65104; IRETD. It does NOT chain to the old INT 9, so
//     while it is installed no key reaches the BIOS buffer.
import * as pic from './pic.js';
import * as pit from './pit.js';
import { hardwareInterrupt, setRmHandler } from './dpmi.js';

// ---- browser KeyboardEvent.code -> set-1 make code (0x100 = E0-prefixed) ------------------------
// Standard 101/104-key AT keyboard, scan code set 1 (IBM PC AT / PS/2 Technical Reference;
// A. Brouwer, "Keyboard scancodes", §1).
const E0 = 0x100;
export const CODE_TO_SCAN = {
  Escape: 0x01, Digit1: 0x02, Digit2: 0x03, Digit3: 0x04, Digit4: 0x05, Digit5: 0x06, Digit6: 0x07,
  Digit7: 0x08, Digit8: 0x09, Digit9: 0x0a, Digit0: 0x0b, Minus: 0x0c, Equal: 0x0d, Backspace: 0x0e,
  Tab: 0x0f, KeyQ: 0x10, KeyW: 0x11, KeyE: 0x12, KeyR: 0x13, KeyT: 0x14, KeyY: 0x15, KeyU: 0x16,
  KeyI: 0x17, KeyO: 0x18, KeyP: 0x19, BracketLeft: 0x1a, BracketRight: 0x1b, Enter: 0x1c,
  ControlLeft: 0x1d, KeyA: 0x1e, KeyS: 0x1f, KeyD: 0x20, KeyF: 0x21, KeyG: 0x22, KeyH: 0x23,
  KeyJ: 0x24, KeyK: 0x25, KeyL: 0x26, Semicolon: 0x27, Quote: 0x28, Backquote: 0x29,
  ShiftLeft: 0x2a, Backslash: 0x2b, KeyZ: 0x2c, KeyX: 0x2d, KeyC: 0x2e, KeyV: 0x2f, KeyB: 0x30,
  KeyN: 0x31, KeyM: 0x32, Comma: 0x33, Period: 0x34, Slash: 0x35, ShiftRight: 0x36,
  NumpadMultiply: 0x37, AltLeft: 0x38, Space: 0x39, CapsLock: 0x3a, F1: 0x3b, F2: 0x3c, F3: 0x3d,
  F4: 0x3e, F5: 0x3f, F6: 0x40, F7: 0x41, F8: 0x42, F9: 0x43, F10: 0x44, NumLock: 0x45,
  ScrollLock: 0x46, Numpad7: 0x47, Numpad8: 0x48, Numpad9: 0x49, NumpadSubtract: 0x4a,
  Numpad4: 0x4b, Numpad5: 0x4c, Numpad6: 0x4d, NumpadAdd: 0x4e, Numpad1: 0x4f, Numpad2: 0x50,
  Numpad3: 0x51, Numpad0: 0x52, NumpadDecimal: 0x53, IntlBackslash: 0x56, F11: 0x57, F12: 0x58,
  NumpadEnter: E0 | 0x1c, ControlRight: E0 | 0x1d, NumpadDivide: E0 | 0x35, AltRight: E0 | 0x38,
  Home: E0 | 0x47, ArrowUp: E0 | 0x48, PageUp: E0 | 0x49, ArrowLeft: E0 | 0x4b, ArrowRight: E0 | 0x4d,
  End: E0 | 0x4f, ArrowDown: E0 | 0x50, PageDown: E0 | 0x51, Insert: E0 | 0x52, Delete: E0 | 0x53,
  MetaLeft: E0 | 0x5b, MetaRight: E0 | 0x5c, ContextMenu: E0 | 0x5d,
  // PrintScreen and Pause have special sequences (keyBytes)
};
const GREY_NAV = new Set([0x47, 0x48, 0x49, 0x4b, 0x4d, 0x4f, 0x50, 0x51, 0x52, 0x53]);

// Keyboard-side state (the keyboard's own view: which shifts are down, NumLock LED from the host).
let kbLShift = false, kbRShift = false, kbCtrl = false, kbAlt = false;
// NumLock at boot: off. DOSBox-X's BIOS starts with NumLock off (re/ref/bios_keyboard.cpp InitBiosSegment:
// flag1 = 0, NUMLOCK_ACTIVE only if startup_state_numlock), and startup_state_numlock is false except on a
// Windows host, where it copies the host's NumLock at start-up (dosbox-x src/gui/sdlmain.cpp, `bool
// startup_state_numlock = false`, set from GetKeyboardState(VK_NUMLOCK) in the WIN32 block). DOSBox 0.74
// does the same. The browser cannot read the host NumLock before the first key event (and macOS has none),
// so the non-Windows DOSBox default is used.
// UNCERTAIN: on real AT-class machines it is a BIOS setup option ("Boot Up NumLock Status"), commonly on;
// MS-DOS 6 CONFIG.SYS NUMLOCK= could also change it. Only observable in the name entry (0x1098f):
// with NumLock off the keypad digits give 00h + scan (not digits), with it on they type digits.
let ledNumLock = false;

// Byte sequence the keyboard sends for a make (down=true) or break of browser code `code`.
// Includes the AT keyboard's "fake shift" bytes around grey keys (Brouwer §1.4) and the special
// PrintScreen/Pause sequences. Returns [] for codes that have no AT key.
export function keyBytes(code, down) {
  if (code === 'Pause') {
    if (!down) return []; // Pause has no break code
    return kbCtrl ? [0xe0, 0x46, 0xe0, 0xc6] : [0xe1, 0x1d, 0x45, 0xe1, 0x9d, 0xc5];
  }
  if (code === 'PrintScreen') {
    if (kbAlt) return down ? [0x54] : [0xd4];
    if (kbLShift || kbRShift || kbCtrl) return down ? [0xe0, 0x37] : [0xe0, 0xb7];
    return down ? [0xe0, 0x2a, 0xe0, 0x37] : [0xe0, 0xb7, 0xe0, 0xaa];
  }
  const s = CODE_TO_SCAN[code];
  if (s === undefined) return [];
  const sc = s & 0x7f;
  const code8 = down ? sc : sc | 0x80;
  let bytes;
  if (!(s & E0)) bytes = [code8];
  else if ((GREY_NAV.has(sc) || sc === 0x35) && (kbLShift || kbRShift)) {
    const pre = [], post = [];
    if (kbLShift) { pre.push(0xe0, 0xaa); post.unshift(0xe0, 0x2a); }
    if (kbRShift) { pre.push(0xe0, 0xb6); post.unshift(0xe0, 0x36); }
    bytes = down ? [...pre, 0xe0, code8] : [0xe0, code8, ...post];
  } else if (GREY_NAV.has(sc) && ledNumLock) {
    bytes = down ? [0xe0, 0x2a, 0xe0, code8] : [0xe0, code8, 0xe0, 0xaa];
  } else bytes = [0xe0, code8];
  // update the keyboard's modifier view after computing the bytes
  if (s === 0x2a) kbLShift = down;
  else if (s === 0x36) kbRShift = down;
  else if (sc === 0x1d) kbCtrl = down;
  else if (sc === 0x38) kbAlt = down;
  return bytes;
}

// ---- 8042 controller ------------------------------------------------------------------------------
// The keyboard buffers bytes; on overflow the last buffered byte becomes the keyboard-error code, which
// is FFh as the host sees it: FFh in scan code set 1, 00h in sets 2/3, and with 8042 translation on both
// arrive as FFh (A. Brouwer, "Keyboard scancodes" §1, "Keyboard error" — local copy
// re/ref/aeb_scancodes-1.html). For the game's ISR FFh is a break of 7Fh: no key state changes.
// UNCERTAIN: the keyboard's internal buffer depth (16 bytes here) is not taken from a cited source.
// The controller holds one byte in its output buffer and raises IRQ1 for it; the next byte is
// transferred when the host has read port 0x60 and the IRQ has been serviced.
const fifo = [];
const KB_FIFO = 16;
let outBuf = 0;      // last byte presented at port 0x60 (re-reads return it again)
let outFull = false; // a byte waiting for the host
let port61 = 0x00;   // system control port B, bits 0..3 read back (see HARDWARE.md for bits 1/7)

function feedController() {
  if (outFull || fifo.length === 0) return;
  outBuf = fifo.shift();
  outFull = true;
  pic.request(1);
}

export function sendBytes(bytes) {
  // Real ordering: host key events arrive between PIT pumps, but on the PC every IRQ0 that fell due before
  // the key press has already been taken. Deliver the overdue ticks first (PIC priority would also put
  // IRQ0 before IRQ1 if both were pending). pit.js does not import kbd.js: no import cycle.
  pit.pump();
  for (const b of bytes) {
    if (fifo.length >= KB_FIFO) { fifo[KB_FIFO - 1] = 0xff; break; } // overrun: keyboard error code
    fifo.push(b & 0xff);
  }
  deliver();
}

// Run IRQ1s until the keyboard's bytes are consumed (or the PIC blocks: handler did not EOI).
export function deliver() {
  for (let guard = 0; guard < 64; guard++) {
    feedController();
    if (!pic.pending(1)) break;
    pic.service();
    if (pic.pending(1)) break; // still blocked (IRQ1 in service without EOI)
    if (outFull) break; // host did not read 0x60: the 8042 holds the byte, the keyboard waits
  }
}

export function in60() { outFull = false; return outBuf; }
export function in61() { return port61 & 0x0f; }
// Bit 7 (keyboard clear on the PC/XT) has no function on the AT; bits 0/1 gate timer 2 / the speaker,
// which nothing in the program uses (PC speaker not emulated).
export function out61(v) { port61 = v & 0x0f; }

// ---- BIOS INT 9 (firmware: active while PM INT 9 is PMODE/W's default, which reflects to real mode) ---
// Scan code -> BIOS buffer word (scan<<8 | ascii) for [normal, shift, ctrl, alt]; -1 = no key stored.
// IBM PC AT BIOS keyboard tables (Enhanced keyboard support, as documented in RBIL INT 16 "Table 00006").
const T = [];
const def = (sc, n, s, c, a) => { T[sc] = [n, s, c, a]; };
def(0x01, 0x011b, 0x011b, 0x011b, 0x0100);
const digits = '1234567890', shDigits = '!@#$%^&*()';
for (let i = 0; i < 10; i++) {
  const sc = 0x02 + i;
  def(sc, (sc << 8) | digits.charCodeAt(i), (sc << 8) | shDigits.charCodeAt(i), -1, (0x78 + i) << 8);
}
T[0x03][2] = 0x0300; // Ctrl-2 = NUL
T[0x07][2] = 0x071e; // Ctrl-6 = RS
def(0x0c, 0x0c2d, 0x0c5f, 0x0c1f, 0x8200);
def(0x0d, 0x0d3d, 0x0d2b, -1, 0x8300);
def(0x0e, 0x0e08, 0x0e08, 0x0e7f, 0x0e00);
def(0x0f, 0x0f09, 0x0f00, 0x9400, 0xa500);
const letters = { 0x10: 'q', 0x11: 'w', 0x12: 'e', 0x13: 'r', 0x14: 't', 0x15: 'y', 0x16: 'u', 0x17: 'i', 0x18: 'o', 0x19: 'p',
  0x1e: 'a', 0x1f: 's', 0x20: 'd', 0x21: 'f', 0x22: 'g', 0x23: 'h', 0x24: 'j', 0x25: 'k', 0x26: 'l',
  0x2c: 'z', 0x2d: 'x', 0x2e: 'c', 0x2f: 'v', 0x30: 'b', 0x31: 'n', 0x32: 'm' };
for (const [k, ch] of Object.entries(letters)) {
  const sc = +k, c = ch.charCodeAt(0);
  def(sc, (sc << 8) | c, (sc << 8) | (c - 0x20), (sc << 8) | (c - 0x60), sc << 8);
}
def(0x1a, 0x1a5b, 0x1a7b, 0x1a1b, 0x1a00);
def(0x1b, 0x1b5d, 0x1b7d, 0x1b1d, 0x1b00);
def(0x1c, 0x1c0d, 0x1c0d, 0x1c0a, 0x1c00);
def(0x27, 0x273b, 0x273a, -1, 0x2700);
def(0x28, 0x2827, 0x2822, -1, 0x2800);
def(0x29, 0x2960, 0x297e, -1, 0x2900);
def(0x2b, 0x2b5c, 0x2b7c, 0x2b1c, 0x2b00);
def(0x33, 0x332c, 0x333c, -1, 0x3300);
def(0x34, 0x342e, 0x343e, -1, 0x3400);
def(0x35, 0x352f, 0x353f, -1, 0x3500);
def(0x37, 0x372a, 0x372a, 0x9600, 0x3700);
def(0x39, 0x3920, 0x3920, 0x3920, 0x3920);
for (let i = 0; i < 10; i++) def(0x3b + i, (0x3b + i) << 8, (0x54 + i) << 8, (0x5e + i) << 8, (0x68 + i) << 8);
def(0x57, 0x8500, 0x8700, 0x8900, 0x8b00);
def(0x58, 0x8600, 0x8800, 0x8a00, 0x8c00);
def(0x56, 0x565c, 0x567c, -1, -1); // 102-key extra key: '\' '|' on the US layout
// keypad: [numlock-off, numlock-on/shift, ctrl]; alt+digits = ASCII compose (not emulated)
const KP = {
  0x47: [0x4700, 0x4737, 0x7700], 0x48: [0x4800, 0x4838, 0x8d00], 0x49: [0x4900, 0x4939, 0x8400],
  0x4a: [0x4a2d, 0x4a2d, 0x8e00], 0x4b: [0x4b00, 0x4b34, 0x7300], 0x4c: [-1, 0x4c35, 0x8f00],
  0x4d: [0x4d00, 0x4d36, 0x7400], 0x4e: [0x4e2b, 0x4e2b, 0x9000], 0x4f: [0x4f00, 0x4f31, 0x7500],
  0x50: [0x5000, 0x5032, 0x9100], 0x51: [0x5100, 0x5133, 0x7600], 0x52: [0x5200, 0x5230, 0x9200],
  0x53: [0x5300, 0x532e, 0x9300],
};
// E0 grey keys: [normal/shift, ctrl, alt]
const GREY = {
  0x47: [0x47e0, 0x77e0, 0x9700], 0x48: [0x48e0, 0x8de0, 0x9800], 0x49: [0x49e0, 0x84e0, 0x9900],
  0x4b: [0x4be0, 0x73e0, 0x9b00], 0x4d: [0x4de0, 0x74e0, 0x9d00], 0x4f: [0x4fe0, 0x75e0, 0x9f00],
  0x50: [0x50e0, 0x91e0, 0xa000], 0x51: [0x51e0, 0x76e0, 0xa100], 0x52: [0x52e0, 0x92e0, 0xa200],
  0x53: [0x53e0, 0x93e0, 0xa300], 0x1c: [0xe00d, 0xe00a, 0xa600], 0x35: [0xe02f, 0x9500, 0xa400],
};

// BIOS shift state (0040:0017/0018/0096 in the real BIOS; kept here, the program never reads them).
let bLShift = false, bRShift = false, bCtrl = false, bAlt = false;
let bCaps = false, bNum = ledNumLock, bScroll = false;
let capsDown = false, numDown = false, scrollDown = false;
let e0Flag = false, e1Count = 0;

let onBiosKey = null; // (scan, ascii) => void : BIOS type-ahead buffer (console layer)
export function setOnBiosKey(fn) { onBiosKey = fn; }

function translate(sc, e0) {
  if (e0) {
    const g = GREY[sc];
    if (!g) return -1;
    return bAlt ? g[2] : bCtrl ? g[1] : g[0];
  }
  const kp = KP[sc];
  if (kp) {
    if (bAlt) return -1; // Alt-keypad ASCII entry (compose on Alt release) not emulated
    if (bCtrl) return kp[2];
    return (bNum !== (bLShift || bRShift)) ? kp[1] : kp[0];
  }
  const t = T[sc];
  if (!t) return -1;
  if (bAlt) return t[3];
  if (bCtrl) return t[2];
  const shift = bLShift || bRShift;
  if (letters[sc] !== undefined) return (shift !== bCaps) ? t[1] : t[0];
  return shift ? t[1] : t[0];
}

function biosInt9() {
  const b = in60();
  if (e1Count > 0) { e1Count--; pic.writeCommand(0x20); return; } // Pause sequence: pause loop not emulated
  if (b === 0xe1) { e1Count = 2; pic.writeCommand(0x20); return; }
  if (b === 0xe0) { e0Flag = true; pic.writeCommand(0x20); return; }
  const e0 = e0Flag; e0Flag = false;
  const make = (b & 0x80) === 0, sc = b & 0x7f;
  switch (sc) {
    case 0x2a: if (!e0) bLShift = make; break; // E0 2A / E0 AA are fake shifts: ignored
    case 0x36: if (!e0) bRShift = make; break;
    case 0x1d: bCtrl = make; break;
    case 0x38: bAlt = make; break;
    case 0x3a: if (make && !capsDown) bCaps = !bCaps; capsDown = make; break;
    case 0x45: if (make && !numDown) { bNum = !bNum; ledNumLock = bNum; } numDown = make; break;
    case 0x46:
      if (e0) break; // Ctrl-Break (INT 1Bh) not emulated
      if (make && !scrollDown) bScroll = !bScroll; scrollDown = make; break;
    default:
      if (make) {
        const w = translate(sc, e0);
        if (w >= 0 && onBiosKey) onBiosKey((w >> 8) & 0xff, w & 0xff);
      }
  }
  pic.writeCommand(0x20);
}

export function install() {
  pic.setIrqHandler(1, () => hardwareInterrupt(9));
  setRmHandler(9, biosInt9);
}

export function reset() {
  fifo.length = 0; outBuf = 0; outFull = false; port61 = 0;
  kbLShift = kbRShift = kbCtrl = kbAlt = false; ledNumLock = false;
  bLShift = bRShift = bCtrl = bAlt = bCaps = bScroll = false; bNum = false;
  capsDown = numDown = scrollDown = false; e0Flag = false; e1Count = 0;
  held.clear();
}

// ---- browser input ------------------------------------------------------------------------------
// keydown auto-repeat events are passed on as repeated make codes: the AT keyboard's typematic
// repeat does the same (the browser/OS repeat rate stands in for the keyboard's).
//
// Keys held when the page loses the keyboard (window blur, tab hidden) never get their keyup event.
// A real keyboard sends the break code when the key is released, so the port treats losing focus as
// the release of every key it has sent a make for: releaseAll() sends their break bytes through the
// normal 8042 / IRQ1 path (sendBytes), so the game's ISR (or the BIOS INT 9) sees ordinary breaks.
//
// preventDefault (browser shortcuts): every AT key is still delivered to the emulated keyboard; only the
// browser's default action is suppressed or not. It is suppressed for keys the program can observe:
//   - keyboard_state slots the game reads (re/audit/round1/E-platform/kbd_refs.txt): Esc, 2..0, Y, U, P,
//     Enter, A, D, G, J, K, L, V, B, N, M, Space, F2, F3, F4, the arrows (grey or keypad);
//   - the name entry (0x1098f, DOS getch = every key with a BIOS translation, incl. Tab, Backspace,
//     punctuation, which some browsers bind: Space/arrows/PgUp scroll, ' and / start Firefox find).
// It is NOT suppressed when Ctrl or Meta (Cmd) is held (browser/OS shortcuts: Ctrl/Cmd+R, +W, +L, ...),
// nor for F1, F5..F12, the Windows/Cmd keys and the menu key: the game reads none of these scan codes
// (kbd_refs.txt), and in the name entry they give only 00h + scan (which ends the name, see console.js)
// while the browser's use (help, reload, fullscreen, devtools) is what a player pressing them wants.
const BROWSER_KEYS = new Set(['F1', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
  'MetaLeft', 'MetaRight', 'ContextMenu']);
export function claimsKey(e) {
  return !(e.ctrlKey || e.metaKey) && !BROWSER_KEYS.has(e.code);
}

const held = new Set(); // e.code of keys whose make was sent and whose break was not

export function releaseAll() {
  for (const code of [...held].reverse()) {
    held.delete(code);
    const bytes = keyBytes(code, false);
    if (bytes.length) sendBytes(bytes);
  }
}

export function attach(target = globalThis) {
  const onKey = (down) => (e) => {
    const bytes = keyBytes(e.code, down);
    if (down) held.add(e.code); else held.delete(e.code);
    if (bytes.length === 0) return;
    if (claimsKey(e)) e.preventDefault();
    sendBytes(bytes);
  };
  const kd = onKey(true), ku = onKey(false);
  const blur = () => releaseAll();
  const doc = target.document;
  const vis = () => { if (doc.hidden) releaseAll(); };
  target.addEventListener('keydown', kd);
  target.addEventListener('keyup', ku);
  target.addEventListener('blur', blur);
  doc?.addEventListener('visibilitychange', vis);
  return () => {
    target.removeEventListener('keydown', kd); target.removeEventListener('keyup', ku);
    target.removeEventListener('blur', blur); doc?.removeEventListener('visibilitychange', vis);
  };
}
