// DOS console / BIOS keyboard buffer (platform emulation, not code from GANJAFRM.EXE).
//
// What the binary does (evidence for why this layer exists):
//   - kbhit 0x2328d: ungetch buffer 0x3112c, else INT 21h AH=0Bh, returns (int)(signed char)AL.
//   - getch 0x232a4: ungetch buffer 0x3112c, else INT 21h AH=08h, returns AL zero-extended.
//   - printf output (0x23783; in the original through stdout, handle 1, INT 21h AH=40h) is written here
//     (write), and drawn by the text screen at exit (textmode.js).
// DOS itself gets keys from the BIOS keyboard buffer (filled by the BIOS INT 9 handler). While the
// game's Keyboard_Driver (0x22b04) is installed as INT 9 it does NOT chain to the old handler (it ends
// with EOI + IRETD, 0x22b5e..0x22bd6), so no keys reach the BIOS buffer then. The game removes its
// driver (0x1098f: Keyboard_Remove_Driver before the kbhit/getch name-entry loop, Keyboard_Install_Driver
// after), so the keyboard platform must call push() only while the BIOS INT 9 handler is the active vector.
//
// The DOS/BIOS details below (0xFF from AH=0Bh, two-call extended keys for AH=08h (MS-DOS CON CHRIN)) are
// DOS/BIOS behaviour, not code in this binary.

const keys = []; // BIOS type-ahead buffer: {scan, ascii}
const BIOS_BUFFER_SIZE = 15; // UNCERTAIN: the BIOS ring buffer at 40:1E holds 16 words = 15 keys; extra keys are dropped (beep).
let dosPendingScan = -1; // AH=08h returned 0 for an extended key; the scan code comes on the next call.

// Keyboard-platform side: a key translated by the emulated BIOS INT 9 handler.
// Wire it with `pc.install({ onBiosKey: console.push })` (platform/pc.js, kbd.js): kbd.js calls it only
// while no ported INT 9 handler is installed, i.e. exactly when the BIOS INT 9 would run.
export function push(scan, ascii) {
  if (keys.length >= BIOS_BUFFER_SIZE) return false;
  keys.push({ scan: scan & 0xff, ascii: ascii & 0xff });
  return true;
}
export function clearKeys() { keys.length = 0; dosPendingScan = -1; }

// INT 21h AH=0Bh: AL = 0xFF if a character is available, else 0.
// (CON$RDND: ALTAH pending, or INT 16h AH=11h finds a word in the buffer.)
// UNCERTAIN: a 0000h word would count as available here and then be skipped by CHRIN; no key of this
// BIOS model stores 0000h (Ctrl-Break is not emulated), so the case cannot arise.
export function dosCheckInput() {
  return dosPendingScan >= 0 || keys.length > 0 ? 0xff : 0;
}

// INT 21h AH=08h: one character, no echo. Returns null if none is available (the caller waits).
// DOS gets the character from the CON driver's CHRIN, modelled on the MS-DOS 4.0 source
// (re/audit/round1/E-platform/mscon4.asm lines 53-122, github.com/microsoft/MS-DOS, MIT):
//   - CHRIN reads with INT 16h AH=KEYRD_Func. MSINIT sets KEYRD_Func = 10h (and KEYSTS_Func = 11h)
//     when bit 4 of 0040:0096 ("enhanced keyboard installed") is set (re/ref/msinit4.asm lines
//     752-766). An AT BIOS with a 101/102-key keyboard sets that bit; DOSBox(-X) sets it
//     unconditionally (re/ref/bios_keyboard.cpp InitBiosSegment: BIOS_KEYBOARD_FLAGS3 = 16). So the
//     AH=10h view of the buffer is modelled: every stored word is returned, grey keys with low byte E0h.
//   - AX = 0000h (a "non-key after break") is skipped (`OR AX,AX / JZ CHRIN`).
//   - AX = 7200h (Ctrl-PrtSc) returns 10h. (No key of this BIOS model stores 7200h; kept for fidelity.)
//   - AL = E0h with AH != 0 is an extended key: AL is changed to 00h "for compatibility reason" and AH
//     is returned by the next call (ALTAH). AL = E0h with AH = 0 is a real character E0h ("Greek alpha",
//     only producible by Alt+keypad entry, which this BIOS model does not emulate) and is returned as is.
//   - AL = 00h: extended key, AH returned by the next call.
// Had DOS used AH=00h instead (no enhanced-keyboard bit), the BIOS itself would turn E0h into 00h for
// these keys (DOSBox-X bios_keyboard.cpp IsEnhancedKey, `key&=0xff00`, used by INT 16h AH=00h), and
// would drop keystrokes with a scan code above 84h (F11/F12, Ctrl/Alt+grey keys). Grey arrows,
// Home/End/PgUp/PgDn/Ins/Del give 00h + scan either way.
// UNCERTAIN: MS-DOS 6.22's IO.SYS source is not public; that its CON driver keeps the 4.0 CHRIN logic
// is inferred (the code is marked AN000 = added in 4.0, and no later change is known).
// Consequence for the name entry (0x1098f): after this conversion the only bytes >= 80h this model can
// deliver are the second (scan) bytes of extended keys (e.g. 85h/86h for F11/F12, 8Dh.. for Ctrl+grey
// keys). They always follow a 00h in the name, so Print_String (strlen) never reaches them; Backspace in
// 0x1098f overwrites the latest byte first, so the scan byte is replaced by 20h before its 00h can be.
// On a real PC, Alt+keypad entry (Alt held, digits on the keypad, Alt released) can also store any
// character 01h..FFh; that is not emulated (kbd.js translate), so such names cannot be typed in the port.
export function dosReadCharNoEcho() {
  if (dosPendingScan >= 0) { const s = dosPendingScan; dosPendingScan = -1; return s; }
  for (;;) {
    if (keys.length === 0) return null;
    const k = keys.shift();
    const ax = (k.scan << 8) | k.ascii;
    if (ax === 0) continue;                                   // CHRIN: OR AX,AX / JZ CHRIN
    if (ax === 0x7200) return 0x10;                           // CHRIN: Ctrl-PrtSc -> AL = 16
    if (k.ascii === 0xe0) {                                   // KEYRD_Func = 10h: E0h check
      if (k.scan === 0) return 0xe0;                          //   AH = 0: character E0h (KEYRET)
      dosPendingScan = k.scan; return 0;                      //   AL = 0, ALT_SAVE
    }
    if (k.ascii === 0) { dosPendingScan = k.scan; return 0; } // ALT_SAVE
    return k.ascii;
  }
}

// ---- console output (CON device: handles 1 and 2) ----
// In mode 13h DOS output goes through BIOS TTY into the graphics screen; in mode 3 into the text screen.
// Here all bytes are collected in a log and passed to listeners; drawing them is the display's business.
const out = [];
const listeners = new Set();
export function write(bytes) {
  for (const b of bytes) out.push(b);
  for (const l of listeners) l(bytes);
  return bytes.length;
}
export function onOutput(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function outputText() { return String.fromCharCode(...out); }
export function clearOutput() { out.length = 0; }
