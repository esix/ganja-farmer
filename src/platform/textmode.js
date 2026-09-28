// Text mode 03h: the BIOS teletype that DOS console output goes through, and the scan-out of the text
// buffer at 0xB8000. Platform emulation (firmware + monitor), not code from GANJAFRM.EXE.
//
// Why it exists: at exit main sets mode 03h (0x1e02c) and then printf()s the shutdown text (shutdown,
// 0x1e036..0x1e0bb). printf ends in INT 21h AH=40h on handle 1 (CON); DOS writes CON output with the
// BIOS teletype (INT 10h AH=0Eh semantics) into the text buffer. console.js collects those bytes;
// this module plays them into 0xB8000 while the video mode is 03h.
//
// Teletype (IBM BIOS INT 10h AH=0Eh, text modes): BEL 07h: no output (speaker not emulated); BS 08h:
// cursor left if not in column 0; LF 0Ah: next row, scrolling up one line at row 25; CR 0Dh: column 0;
// any other byte: stored at the cursor (the attribute byte is left as it is) and the cursor advances,
// wrapping to the next row after column 79. Scrolling fills the new bottom row with blanks of the
// attribute at the cursor (07h after the mode set). Mode set 03h leaves the cursor at row 0, column 0.
// UNCERTAIN: bytes written while mode 13h is active would be drawn by the BIOS into the graphics screen;
// that is not emulated (they are only collected by console.js). The program prints only after the
// mode-03h set.
//
// Scan-out: a real VGA shows mode 03h as 720x400 with the 9x16 font from the VGA BIOS. The port only has
// the 8x8 ROM font (BIOS_FONT_8X8, characters 0..127), so the screen is drawn as 640x200 with 8x8 cells.
// DEVIATION (display only): font and cell size differ from the real 9x16 text mode; characters >= 128
// are drawn blank. Colours: attribute nibble -> attribute-controller palette register (default VGA
// values 0,1,2,3,4,5,14h,7,38h..3Fh) -> DAC entry; bit 7 = blink (background uses bits 4..6).
import { u8, BIOS_FONT_8X8 } from '../runtime/mem.js';
import * as vga from './vga.js';
import * as con from './console.js';

const TEXT = 0xb8000, COLS = 80, ROWS = 25;
const AC_PAL = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x14, 0x07, 0x38, 0x39, 0x3a, 0x3b, 0x3c, 0x3d, 0x3e, 0x3f];
let row = 0, col = 0;
let lastMode = -1;

function syncMode() {
  if (vga.videoMode !== lastMode) {
    lastMode = vga.videoMode;
    if (lastMode === 0x03) { row = 0; col = 0; }
  }
}

function scroll() {
  u8.copyWithin(TEXT, TEXT + COLS * 2, TEXT + ROWS * COLS * 2);
  const attr = u8[TEXT + (row * COLS + col) * 2 + 1];
  for (let c = 0; c < COLS; c++) { u8[TEXT + ((ROWS - 1) * COLS + c) * 2] = 0x20; u8[TEXT + ((ROWS - 1) * COLS + c) * 2 + 1] = attr; }
}

function lineFeed() { if (row < ROWS - 1) row++; else scroll(); }

export function teletype(b) {
  syncMode();
  if (vga.videoMode !== 0x03) return;
  switch (b) {
    case 0x07: return;
    case 0x08: if (col > 0) col--; return;
    case 0x0a: lineFeed(); return;
    case 0x0d: col = 0; return;
  }
  u8[TEXT + (row * COLS + col) * 2] = b & 0xff;
  if (++col >= COLS) { col = 0; lineFeed(); }
}

// Connect DOS console output to the teletype. Returns the unsubscribe function.
export function attachConsole() {
  return con.onOutput((bytes) => { for (const b of bytes) teletype(b); });
}
export const cursor = () => ({ row, col });

// Render the text buffer into px (Uint32Array 640*200, ABGR) using the colour lookup rgba[256].
export function render(px, rgba) {
  for (let r = 0; r < ROWS && r * 8 < 200; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = u8[TEXT + (r * COLS + c) * 2];
      const at = u8[TEXT + (r * COLS + c) * 2 + 1];
      const fg = rgba[AC_PAL[at & 0x0f]], bg = rgba[AC_PAL[(at >> 4) & 0x07]];
      for (let y = 0; y < 8; y++) {
        const py = r * 8 + y;
        if (py >= 200) break;
        const bits = ch < 128 ? u8[BIOS_FONT_8X8 + ch * 8 + y] : 0;
        const o = py * 640 + c * 8;
        for (let x = 0; x < 8; x++) px[o + x] = (bits & (0x80 >> x)) ? fg : bg;
      }
    }
  }
}
export const WIDTH = 640, HEIGHT = 200;
