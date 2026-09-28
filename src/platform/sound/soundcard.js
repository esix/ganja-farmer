// The sound card under STKRUN: Sound Blaster DSP/DMA output of the digitized mixer, clocked by the
// emulated time of pit.js (setOnAdvance), plus the host audio output.
// This is platform hardware, not code from the binary. What STKRUN does with it is in stkrun.js.
//
// Digitized: while the DSP runs (from dws_Init's digital init 02f1:0819 to dws_Kill's 02f1:07b7),
//   the DMA plays DigiMixer's buffer at digi.outputRate bytes/s (1e6/(256-TC), DIGI.md §2:
//   1000000/91 = 10989.011 Hz for the game's rate). digi.renderU8() plays the bytes and runs the
//   mixing ISR (02f1:0478) whenever a half-buffer ends, so the ISR runs at the emulated time the
//   DMA reaches the end of a half, as on the card. The SB IRQ is not routed through pic.js: STKRUN's
//   ISR runs to completion like every other emulated handler, so its PIC priority/EOI has no effect.
// FM (stage 2): no chip is emulated any more. The driver's register writes (dwm-player.js out callback)
//   only reach the test tap; the music is a recording played by music-out.js (rendered offline with
//   DOSBox's DBOPL at 3579545/72 Hz and the same MIX_GAIN, tools/render-music.mjs).
// Output: the DAC stream is resampled (linear interpolation) to the host rate.
//   UNCERTAIN: the analog part of a real card (DAC reconstruction filter, the relative level of the
//   DAC and the FM output, amplifier) is not in the binary. The DAC byte u is taken as (u-128)/128
//   (DIGI.md §4 "DAC") and scaled by MIX_GAIN, as the FM recordings are.
import { PIT_HZ } from '../pit.js';

export const MIX_GAIN = 0.5; // UNCERTAIN (see header): keeps DAC + FM full scale inside [-1, 1]

let digi = null;     // DigiMixer while the DSP/DMA runs
let digAcc = 0;      // fractional DAC bytes due
let digLast = 0x80;  // last DAC byte (the DAC holds its value; 0x80 = silence)
let sink = null;     // host output: { rate, write(Float32Array) } (audio-out.js)
let outAcc = 0;
const taps = { dig: null, opl: null }; // test/diagnostic taps

// ---- devices ------------------------------------------------------------------------------------
export function startDigital(mixer) { digi = mixer; digAcc = 0; }   // DSP + DMA start (02f1:0891)
export function stopDigital() { digi = null; digLast = 0x80; }      // DSP halt (02f1:07b7)
export const digitalRunning = () => digi !== null;

export function oplWrite(reg, val) {
  if (taps.opl) taps.opl(reg, val);
}

export function setSink(s) { sink = s; outAcc = 0; }
export function setDigitalTap(fn) { taps.dig = fn; }
export function setOplTap(fn) { taps.opl = fn; }

export function reset() {
  digi = null; digAcc = 0; digLast = 0x80; outAcc = 0;
}

// ---- time ---------------------------------------------------------------------------------------
const EMPTY_U8 = new Uint8Array(0);

// pit.setOnAdvance hook: `clocks` PIT input clocks (1193182 Hz) have elapsed.
export function advance(clocks) {
  // DAC bytes (the mixer ISR runs inside renderU8 at the half-buffer boundaries).
  let dig = EMPTY_U8;
  if (digi) {
    digAcc += clocks * digi.outputRate / PIT_HZ;
    const n = Math.floor(digAcc);
    digAcc -= n;
    if (n > 0) {
      dig = digi.renderU8(new Uint8Array(n));
      if (taps.dig) taps.dig(dig);
    }
  }
  if (!sink) {
    if (dig.length) digLast = dig[dig.length - 1];
    return;
  }
  outAcc += clocks * sink.rate / PIT_HZ;
  const m = Math.floor(outAcc);
  outAcc -= m;
  if (m > 0) {
    const out = new Float32Array(m);
    for (let j = 0; j < m; j++) {
      const t = (j + 1) / m; // position of this output frame within the elapsed stretch
      const d = interp(dig, t, digLast, (u) => (u - 128) / 128);
      let v = d * MIX_GAIN;
      out[j] = v > 1 ? 1 : v < -1 ? -1 : v;
    }
    sink.write(out);
  }
  if (dig.length) digLast = dig[dig.length - 1];
}

// Linear interpolation of a stretch's native samples at relative time t in (0, 1]; the sample
// before the stretch is `prev`. An empty stretch holds `prev`.
function interp(a, t, prev, conv) {
  const n = a.length;
  if (n === 0) return conv(prev);
  const x = t * n - 1;          // index into a; -1 = prev
  const i = Math.floor(x);
  const fr = x - i;
  const s0 = i < 0 ? conv(prev) : conv(a[i]);
  const s1 = i + 1 < n ? conv(a[i + 1]) : conv(a[n - 1]);
  return s0 + (s1 - s0) * fr;
}
