// Music output (stage 2): the songs are pre-rendered OGG/Opus files (assets/game/F*.OGG, made by
// tools/render-music.mjs from the DWM files with the STK sequencer + the DBOPL OPL2 emulator that used to
// run live here). The sequencer (dwm-player.js) still runs on the STK timer, so dws_MSongStatus and the
// song timing the program sees are unchanged; it no longer drives a chip. stkrun.js tells this module what
// the sequencer does, and the matching recording plays in WebAudio:
//   start(name)   dws_MPlay (and a loop rewind): play NAME.OGG from the beginning
//   stop()        dws_MClear / dws_Kill: the driver keys all notes off -> short fade out
//   pause()/resume()  dws_MPause / dws_MUnPause: the driver keys notes off and holds the sequencer; the
//                 recording stops and continues from the same position (the live driver restarted the
//                 held notes only at their next event, so the resumed recording can differ for a moment)
//   setMusVol(v)  dws_XMusic / dws_XMaster: the driver's effective music volume (0..255). It scaled the OPL
//                 operator levels; the equivalent loudness change was measured over all songs
//                 (tools/render-music.mjs --curve) and is applied as a gain.
// Without WebAudio (Node, tests) every call is a no-op.
import * as vfs from '../vfs.js';

// musVol -> dB relative to 255, mean over the 11 songs (tools/render-music.mjs --curve, 2026-09-28).
const CURVE = [[0, -Infinity], [8, -41.26], [16, -39.98], [32, -37.28], [48, -34.76], [64, -32.21], [96, -26.93],
  [128, -21.68], [160, -16.66], [192, -11.09], [224, -5.2], [255, 0]];
export function gainFor(musVol) {
  if (musVol <= 0) return 0;
  for (let i = 1; i < CURVE.length; i++) {
    const [v1, d1] = CURVE[i];
    if (musVol <= v1) {
      const [v0, d0] = CURVE[i - 1];
      const db = Number.isFinite(d0) ? d0 + (d1 - d0) * (musVol - v0) / (v1 - v0) : d1 + (musVol - v1) * 0.2;
      return Math.pow(10, db / 20);
    }
  }
  return 1;
}

const FADE_S = 0.03;
let ctx = null, gain = null;
const buffers = new Map(); // song base name (upper case) -> AudioBuffer
let current = null;        // { name, source, fade, startedAt, offset }
let paused = false;
let pausedAt = 0;          // offset (s) to resume from
let pausedName = null;

const base = (n) => n.toUpperCase().replace(/\.[^.]*$/, '');

// Browser: decode every assets/game/*.OGG into the given AudioContext.
export async function attach(audioContext) {
  ctx = audioContext;
  gain = ctx.createGain();
  gain.connect(ctx.destination);
  for (const n of vfs.names()) {
    if (!/\.OGG$/i.test(n)) continue;
    const bytes = vfs.read(n);
    const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); // decodeAudioData detaches it
    buffers.set(base(n), await ctx.decodeAudioData(copy));
  }
}

// The DWM file whose bytes are at `track` (a view of emulated memory from dws_MPlay's far pointer).
export function songName(track) {
  for (const n of vfs.names()) {
    if (!/\.DWM$/i.test(n)) continue;
    const f = vfs.read(n);
    let same = f.length <= track.length;
    for (let i = 0; same && i < f.length; i++) same = f[i] === track[i];
    if (same) return base(n);
  }
  return null;
}

function fadeOut() {
  if (!current) return;
  const { source, fade } = current;
  const t = ctx.currentTime;
  fade.gain.setValueAtTime(fade.gain.value, t);
  fade.gain.linearRampToValueAtTime(0, t + FADE_S);
  source.stop(t + FADE_S);
  current = null;
}

function play(name, offset) {
  const buf = buffers.get(name);
  if (!buf || offset >= buf.duration) return;
  const source = ctx.createBufferSource();
  source.buffer = buf;
  const fade = ctx.createGain();
  source.connect(fade).connect(gain);
  source.start(0, offset);
  current = { name, source, fade, startedAt: ctx.currentTime - offset };
  source.onended = () => { if (current && current.source === source) current = null; };
}

export function start(name) {
  if (!ctx) return;
  fadeOut();
  if (paused) { pausedName = name; pausedAt = 0; return; } // dws_MPlay does not clear the pause
  if (name) play(name, 0);
}

export function stop() {
  if (!ctx) return;
  fadeOut();
  pausedName = null;
}

export function pause() {
  if (!ctx || paused) return;
  paused = true;
  pausedName = current ? current.name : null;
  pausedAt = current ? ctx.currentTime - current.startedAt : 0;
  fadeOut();
}

export function resume() {
  if (!ctx || !paused) return;
  paused = false;
  if (pausedName) play(pausedName, pausedAt);
  pausedName = null;
}

export function setMusVol(musVol) {
  if (gain) gain.gain.setValueAtTime(gainFor(musVol), ctx.currentTime);
}

export function reset() {
  if (ctx) fadeOut();
  current = null; paused = false; pausedAt = 0; pausedName = null;
}

// Diagnostics: what is playing now.
export const status = () => ({
  name: current ? current.name : null,
  position: current && ctx ? +(ctx.currentTime - current.startedAt).toFixed(2) : null,
  paused, gain: gain ? gain.gain.value : null, context: ctx ? ctx.state : null,
});
