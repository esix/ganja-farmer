// VGA registers and video BIOS used by GANJAFRM.EXE (re/HARDWARE.md §1). Scan-out is display.js.
//
// Ports (all through the CRT outp 0x23d99 / inp 0x23da3):
//   OUT 3C8h  DAC write index   Write_Color_Reg 0x20566
//   OUT 3C9h  DAC data (r,g,b)  Write_Color_Reg 0x20577, 0x20589, 0x2059b
//   OUT 3C7h  DAC read index    Read_Color_Reg 0x205cd
//   IN  3C9h  DAC data (r,g,b)  Read_Color_Reg 0x205d7, 0x205e8, 0x205fa
//   IN  3DAh  input status #1   Wait_For_Vertical_Retrace 0x21954, 0x21964 (tests bit 3), reached from
//                               Screen_Transition 0x217e0/0x21853 (effects 3 and 4; the game only uses 0)
// INT 10h: AH=00h set mode, from Set_Video_Mode 0x203c6 via int386 (0x203f6): AL=13h at 0x1aa2b, AL=03h
// at 0x1e02c.
import { u8, VGA_BASE } from '../runtime/mem.js';
import { dac } from './display.js';
import { VGA_PALETTE_248, TEXT_PALETTE_64 } from './vga_palettes.js';
import { loadRegs, outRegs } from './regs.js';

// ---- DAC ----------------------------------------------------------------------------------------
// One address register pair + a 3-step component counter, as the VGA DAC (IBM VGA / INMOS G171 and
// compatibles; behaviour as in DOSBox-X src/hardware/vga_dac.cpp, local copy re/ref/vga_dac.cpp):
//   OUT 3C8h,i : write_index = i, read_index = i-1, counter = 0, state = write
//   OUT 3C7h,i : read_index = i, write_index = i+1, counter = 0, state = read
//   OUT 3C9h,v : v & 0x3F latched as r, g, b; after b the entry at write_index is updated (all three
//                at once, the "update on full load" option of DOSBox-X) and read_index = write_index++
//   IN  3C9h   : returns r, g, b of entry read_index; after b, read_index = write_index++
// Indices wrap modulo 256. Values are 6 bits (the VGA DAC is 6-bit; upper bits read back as 0).
let writeIndex = 0, readIndex = 0, pel = 0;
const tmp = [0, 0, 0];

function dacWrite(port, v) {
  if (port === 0x3c8) { writeIndex = v & 0xff; readIndex = (v - 1) & 0xff; pel = 0; return; }
  if (port === 0x3c7) { readIndex = v & 0xff; writeIndex = (v + 1) & 0xff; pel = 0; return; }
  // 0x3c9
  tmp[pel] = v & 0x3f;
  if (++pel === 3) {
    pel = 0;
    const e = writeIndex * 3;
    dac[e] = tmp[0]; dac[e + 1] = tmp[1]; dac[e + 2] = tmp[2];
    readIndex = writeIndex; writeIndex = (writeIndex + 1) & 0xff;
  }
}
function dacRead() {
  const v = dac[readIndex * 3 + pel];
  if (++pel === 3) { pel = 0; readIndex = writeIndex; writeIndex = (writeIndex + 1) & 0xff; }
  return v;
}
export const dacState = () => ({ writeIndex, readIndex, pel });

// ---- input status #1 (3DAh) -----------------------------------------------------------------------
// Mode 13h/03h timing (standard VGA 25.175 MHz dot clock): 800 dots x 449 lines per frame
// -> 14.268 ms, 70.086 Hz. Vertical retrace (bit 3) is active from line 412 (CRTC 10h + overflow = 19Ch)
// until the line counter's low 4 bits reach CRTC 11h & 0Fh = 0Eh, i.e. lines 412..413 (63.6 us).
// Only bit 3 is read by the program; the other bits are returned as 0.
// UNCERTAIN (emulation constraint, not hardware): a polling loop in JS yields between reads with far
// coarser granularity than 63.6 us and would usually miss the pulse. So a read also reports retrace
// if a retrace pulse started since the previous read and no read saw it — i.e. every retrace is
// observed once, as a tight real-mode polling loop would.
const DOT_HZ = 25175000;
const LINE_S = 800 / DOT_HZ;
const FRAME_S = LINE_S * 449;
const VR_START = 412 * LINE_S, VR_END = 414 * LINE_S;
let now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
export function setVgaClock(fn) { now = fn; lastFrameSeen = -1; }
let lastFrameSeen = -1;
function status1() {
  const t = now() / 1000;
  const frame = Math.floor(t / FRAME_S);
  const inFrame = t - frame * FRAME_S;
  // frame index of the most recent retrace start at or before t
  const lastStart = inFrame >= VR_START ? frame : frame - 1;
  let retr = inFrame >= VR_START && inFrame < VR_END;
  if (!retr && lastFrameSeen >= 0 && lastStart > lastFrameSeen) retr = true; // missed pulse
  if (retr || lastFrameSeen < 0) lastFrameSeen = lastStart;
  return retr ? 0x08 : 0x00;
}

export function out(port, v) {
  if (port === 0x3c7 || port === 0x3c8 || port === 0x3c9) { dacWrite(port, v); return true; }
  return false;
}
export function inp(port) {
  if (port === 0x3c9) return dacRead();
  if (port === 0x3da) return status1();
  return undefined;
}

// ---- INT 10h ------------------------------------------------------------------------------------
// AH=00h set video mode, as the VGA BIOS does it (DOSBox-X int10_modes.cpp FinishSetMode + DAC load,
// local copy re/ref/int10_modes.cpp):
//   - AL bit 7 set: keep video memory; otherwise clear it: mode 13h -> all VGA memory 0 (the CPU window
//     0xA0000..0xAFFFF here), mode 03h -> 0xB8000..0xBFFFF filled with 0x0720 (space, attribute 7).
//   - DAC reload: mode 13h loads entries 0..247 from the default 256-color table (248..255 keep their
//     values); mode 03h loads entries 0..63 from the text table; then OUT 3C7h,0 and OUT 3C8h,0.
//   - BIOS data area 0040:0049 = mode.
// Other register state (CRTC, sequencer, attribute controller) has no observable effect here: the
// scan-out only knows mode 13h. Only modes 13h and 03h are set by the program.
export let videoMode = 0x03; // text mode at program start (DOS prompt)

function setMode(al) {
  const m = al & 0x7f;
  const clear = (al & 0x80) === 0;
  if (m === 0x13) {
    if (clear) u8.fill(0, VGA_BASE, VGA_BASE + 0x10000);
    dacWrite(0x3c8, 0);
    for (let i = 0; i < 248 * 3; i++) dacWrite(0x3c9, VGA_PALETTE_248[i]);
  } else if (m === 0x03) {
    if (clear) for (let a = 0xb8000; a < 0xc0000; a += 2) { u8[a] = 0x20; u8[a + 1] = 0x07; }
    dacWrite(0x3c8, 0);
    for (let i = 0; i < 64 * 3; i++) dacWrite(0x3c9, TEXT_PALETTE_64[i]);
  } else {
    throw new Error('vga: INT 10h mode 0x' + m.toString(16) + ' is not used by the program');
  }
  dacWrite(0x3c7, 0);
  dacWrite(0x3c8, 0);
  u8[0x449] = m;
  videoMode = m;
}

export function int10(regs) {
  const s = loadRegs(regs);
  const ah = (s.eax >>> 8) & 0xff;
  if (ah !== 0x00) throw new Error('vga: INT 10h AH=0x' + ah.toString(16) + ' is not used by the program');
  setMode(s.eax & 0xff);
  // Registers are returned unchanged. UNCERTAIN: some BIOSes return a value in AL; the program never
  // reads the result (Set_Video_Mode discards int386's outregs, 0x203fb).
  return outRegs(s);
}

export function reset() { writeIndex = 0; readIndex = 0; pel = 0; lastFrameSeen = -1; videoMode = 0x03; }
