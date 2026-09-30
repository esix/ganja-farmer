// The music driver's timing without the DWM scores (stage 2). The songs are recordings (music-out.js), so the
// only thing the program still needs from the driver is WHEN a song ends: dws_MSongStatus drives updateMusic
// (0x10050), which starts the next track. The DiamondWare sequencer (stage 1: dwm-player.js, a verified port of
// STKRUN's 068a) ran through every event of the score on the STK timer; this clock reproduces exactly what the
// program can observe of it:
//   - a song lasts SONG_TICKS[name] timer ticks per pass (measured with that sequencer from the original
//     F*.DWM files: the tick on which the last event is consumed);
//   - play(song, count) clears the previous song and starts at tick 0; count 0 = forever, n = n passes;
//   - status(): bit 0 playing, bit 1 paused; pause() holds the clock (the paused flag survives play(), as in
//     068a:02e8); clear() stops it;
//   - the music volume the driver's software mixer derives from dws_XMusic / dws_XMaster (07ac:0008..0046).
// The program still loads f0.dwm .. f10.dwm with Load_File and checks their signature, so mountAll() puts a
// small placeholder NAME.DWM in the file system for each song: the 16-byte signature, then the song name.

import * as vfs from '../vfs.js';

// Ticks per pass (STK timer, 1193182/16384 = 72.83 Hz), from the original scores.
export const SONG_TICKS = { F0: 4399, F1: 402, F2: 441, F3: 176, F4: 291, F5: 410, F6: 146, F7: 229, F8: 374, F9: 391, F10: 392 };
const SIGNATURE = 'DiamondWare Musi';

export function mountAll() {
  for (const name of Object.keys(SONG_TICKS)) {
    const text = SIGNATURE + name + '\0';
    vfs.mountBytes(name + '.DWM', Uint8Array.from(text, (c) => c.charCodeAt(0)));
  }
}

// The song a placeholder names (null if the bytes are not a placeholder).
export function songOf(bytes) {
  for (let i = 0; i < 16; i++) if (bytes[i] !== SIGNATURE.charCodeAt(i)) return null;
  let name = '';
  for (let i = 16; bytes[i] && i < 32; i++) name += String.fromCharCode(bytes[i]);
  return SONG_TICKS[name] !== undefined ? name : null;
}

export class SongClock {
  constructor() {
    this.playing = 0;
    this.paused = 0;
    this.loops = 0;
    this.song = null;
    this.tickCount = 0;
    this.fmOn = 1;          // FM init (05c1:0542) at dws_Init
    this.mixMaster = 0xff;  // software mixer bytes (07ac)
    this.mixMusic = 0xff;
    this.musVol = 0xff;     // what the driver would scale the FM operator levels by
  }

  // 068a:02e8 dws_MPlay: 0 ok, 2 not a DWM (the port's placeholders are the only DWMs left).
  play(bytes, count = 1) {
    this.clear();
    this.loops = count & 0xffff;
    const song = songOf(bytes);
    if (!song) return 2;
    this.song = song;
    this.tickCount = 0;
    this.playing = 1;
    return 0;
  }
  status() { return (this.playing ? 1 : 0) | (this.paused ? 2 : 0); }
  pause() { this.paused = 1; }
  unpause() { this.paused = 0; }
  clear() { this.playing = 0; }

  // One STK timer tick (068a:00cb): the pass ends on its last tick; then another pass or stop.
  tick() {
    if (!this.playing || this.paused) return;
    this.tickCount++;
    if (this.tickCount < SONG_TICKS[this.song]) return;
    if (this.loops !== 0) {
      this.loops = (this.loops - 1) & 0xffff;
      if (this.loops === 0) { this.playing = 0; return; }
    }
    this.tickCount = 0; // rewind
  }

  fmKill() { this.fmOn = 0; }

  // 07ac:0008: (((v << 8) / 255) * master) >> 8 in 16-bit arithmetic
  mixScale(v) {
    const q = Math.floor(((v << 8) & 0xffff) / 255);
    return ((q * this.mixMaster) & 0xffff) >> 8;
  }
  setMusVol(v) { if (this.fmOn) this.musVol = v & 0xff; }     // 05c1:03fe (only while FM is on)
  setMusicVolume(v) { this.mixMusic = v; this.setMusVol(this.mixScale(v)); }        // 07ac:0039
  setMasterVolume(v) { this.mixMaster = v; this.setMusVol(this.mixScale(this.mixMusic)); } // 07ac:0046
}
