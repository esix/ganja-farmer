// The sound card under STKRUN: Sound Blaster DSP/DMA output of the digitized mixer and the OPL2 FM
// chip, clocked by the emulated time of pit.js (setOnAdvance), plus the host audio output.
// This is platform hardware, not code from the binary. What STKRUN does with it is in stkrun.js.
//
// Digitized: while the DSP runs (from dws_Init's digital init 02f1:0819 to dws_Kill's 02f1:07b7),
//   the DMA plays DigiMixer's buffer at digi.outputRate bytes/s (1e6/(256-TC), DIGI.md §2:
//   1000000/91 = 10989.011 Hz for the game's rate). digi.renderU8() plays the bytes and runs the
//   mixing ISR (02f1:0478) whenever a half-buffer ends, so the ISR runs at the emulated time the
//   DMA reaches the end of a half, as on the card. The SB IRQ is not routed through pic.js: STKRUN's
//   ISR runs to completion like every other emulated handler, so its PIC priority/EOI has no effect.
// FM: every register write the driver puts on the bus (dwm-player.js out callback) goes to the OPL
//   chip at the emulated time it is made (inside an STK timer tick). The chip is DOSBox's DBOPL
//   (vendor/opljs, see opl2.js), run at its native rate 3579545/72 = 49715.9 Hz.
//   The driver's port (dws_DETECTRESULTS +0x1E, PLAYER.md §4.1) and its status-read delays are not
//   modelled: writes reach the chip instantly.
// Output: both streams are resampled (linear interpolation) to the host rate and summed.
//   UNCERTAIN: the analog part of a real card (DAC reconstruction filter, the relative level of the
//   DAC and the FM output, amplifier) is not in the binary. The DAC byte u is taken as (u-128)/128
//   (DIGI.md §4 "DAC"), the FM sample s as s/32768, and the sum is scaled by MIX_GAIN.
import { PIT_HZ } from '../pit.js';

export const OPL_HZ = 3579545 / 72;
export const MIX_GAIN = 0.5; // UNCERTAIN (see header): keeps DAC + FM full scale inside [-1, 1]

let digi = null;     // DigiMixer while the DSP/DMA runs
let digAcc = 0;      // fractional DAC bytes due
let digLast = 0x80;  // last DAC byte (the DAC holds its value; 0x80 = silence)
let opl = null;      // FM chip: { write(reg, val), generate(n) -> Int16Array view } (opl2.js)
let oplAcc = 0;      // fractional FM samples due
let fmLast = 0;
let sink = null;     // host output: { rate, write(Float32Array) } (audio-out.js)
let outAcc = 0;
const taps = { dig: null, opl: null }; // test/diagnostic taps

// ---- devices ------------------------------------------------------------------------------------
export function startDigital(mixer) { digi = mixer; digAcc = 0; }   // DSP + DMA start (02f1:0891)
export function stopDigital() { digi = null; digLast = 0x80; }      // DSP halt (02f1:07b7)
export const digitalRunning = () => digi !== null;

export function setOplChip(chip) { opl = chip; oplAcc = 0; }
export function oplWrite(reg, val) {
  if (taps.opl) taps.opl(reg, val);
  if (opl) opl.write(reg, val);
}

export function setSink(s) { sink = s; outAcc = 0; }
export function setDigitalTap(fn) { taps.dig = fn; }
export function setOplTap(fn) { taps.opl = fn; }

export function reset() {
  digi = null; digAcc = 0; digLast = 0x80; oplAcc = 0; fmLast = 0; outAcc = 0;
}

// ---- time ---------------------------------------------------------------------------------------
const EMPTY_U8 = new Uint8Array(0);
const EMPTY_F32 = new Float32Array(0);

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
  // FM samples (only needed for the host output).
  let fm = EMPTY_F32;
  if (opl) {
    oplAcc += clocks * OPL_HZ / PIT_HZ;
    const n = Math.floor(oplAcc);
    oplAcc -= n;
    if (n > 0) {
      fm = new Float32Array(n);
      for (let k = 0; k < n;) {
        const m = Math.min(512, n - k);
        const s = opl.generate(Math.max(2, m)); // DBOPL generates 2..512 samples per call
        for (let i = 0; i < m; i++) fm[k + i] = s[i] / 32768;
        k += m;
      }
    }
  }
  outAcc += clocks * sink.rate / PIT_HZ;
  const m = Math.floor(outAcc);
  outAcc -= m;
  if (m > 0) {
    const out = new Float32Array(m);
    for (let j = 0; j < m; j++) {
      const t = (j + 1) / m; // position of this output frame within the elapsed stretch
      const d = interp(dig, t, digLast, (u) => (u - 128) / 128);
      const f = interp(fm, t, fmLast, (x) => x);
      let v = (d + f) * MIX_GAIN;
      out[j] = v > 1 ? 1 : v < -1 ? -1 : v;
    }
    sink.write(out);
  }
  if (dig.length) digLast = dig[dig.length - 1];
  if (fm.length) fmLast = fm[fm.length - 1];
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
