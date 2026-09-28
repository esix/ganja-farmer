// dwm-player.js — faithful port of the DiamondWare STK 2.22 DWM sequencer + OPL2 driver
// as found in STKRUN.EXE (the TSR that GANJA FARMER runs under: `stkrun ganjafrm`).
//
// Addresses are seg:off in the STKRUN.EXE load image (MZ header 0xA00 bytes, load segment 0,
// so linear = seg*16 + off = file offset - 0xA00). Data segment DS = 0x07FE.
//   068a:xxxx  DWM sequencer (dws_MPlay / update / clear / pause)
//   05c1:xxxx  OPL2 driver (register shadow, voice ops, levels, rhythm)
//   0380:xxxx  dws_* API layer (dws_Init, dws_Update, ...)
//   07ac:xxxx  "software" mixer (dws_XMusic / dws_XMaster when no SB mixer chip is used)
//   0530:xxxx  DWT timer (INT 8 hook, PIT programming)
//
// No OPL emulator is bundled.  Every register write the original would put on the bus is
// delivered to writeReg(reg, val).  Writes the original suppresses via its shadow compare
// (05c1:0168) are suppressed here too.
//
// The original driver only ever addresses the OPL2 register file (ports 0x388/0x389 by
// default, DS:0224/0226), 9 channels in rhythm mode (0xBD bit 5 set at reset).

// ---------------------------------------------------------------------------------------------
// Timing
// DWT (0530:009e) with the rate index the game passes (GANJAFRM calls dwt_Init(2) at 0x1AAB9:
// `mov eax,2; push eax; call 0x1ff4f`) programs PIT channel 0 mode 3 with divisor
// word cs:[0x22 + 2*2] = 0x4000, and the INT 8 handler (0530:002a) calls dws_Update
// (0380:1af2) once per interrupt; dws_Update calls the sequencer tick (068a:00cb) once.
export const PIT_CLOCK_HZ = 1193182;           // 14.31818 MHz / 12 (PC standard; not in the code)
export const PIT_DIVISOR = 0x4000;             // 0530:0022 table [0x0000,0x8000,0x4000,0x2000][2]
export const TICK_HZ = PIT_CLOCK_HZ / PIT_DIVISOR; // ≈ 72.826 Hz  (one tick() per interrupt)

// ---------------------------------------------------------------------------------------------
// Driver tables (DS:0x07FE, read from the load image)
// DS:0228  word per melodic channel 0..8: low byte = carrier operator offset,
//          high byte = modulator operator offset.
const OP_PAIR = [0x0003, 0x0104, 0x0205, 0x080b, 0x090c, 0x0a0d, 0x1013, 0x1114, 0x1215];
// DS:023a  "modulator" op per voice 0..10 (used only for additive/BD level scaling, 05c1:03c0)
const MOD_OP = [0x00, 0x01, 0x02, 0x08, 0x09, 0x0a, 0x10, 0x11, 0x12, 0x14, 0x15];
// DS:0245  "carrier" op per voice 0..10 (voice 7=HH op 0x11, 8=TOM 0x12, 9=SD 0x14, 10=CYM 0x15)
const CAR_OP = [0x03, 0x04, 0x05, 0x0b, 0x0c, 0x0d, 0x13, 0x11, 0x12, 0x14, 0x15];
// DS:0251  rhythm bit in reg 0xBD per voice (6=BD 0x10, 7=HH 0x01, 8=TOM 0x04, 9=SD 0x08, 10=CYM 0x02)
const RHY_BIT = [0, 0, 0, 0, 0, 0, 0x10, 0x01, 0x04, 0x08, 0x02];
// 068a:000c  voices silenced by "all notes off" (note: voice 8 is NOT in the list)
const ALL_OFF_VOICES = [0, 1, 2, 3, 4, 5, 6, 7, 9, 10];

// 0380:00b6  built-in rhythm setup performed by dws_Init (bytes are in instrument-record order,
// see DWM_FORMAT.md §3).
const BD_PATCH = [0x80, 0x00, 0x0b, 0x00, 0xd6, 0xd6, 0x4f, 0x4f, 0x00, 0x00, 0x00];
const CH7_PATCH = [0x00, 0x08, 0x00, 0x00, 0x97, 0xf7, 0x68, 0x86, 0x00, 0x00, 0x0c];
const CH7_FREQ = 0x048c;
const CH8_PATCH = [0x05, 0x07, 0x00, 0x00, 0xf7, 0xb7, 0xf1, 0x75, 0x00, 0x00, 0x0e];
const CH8_FREQ = 0x052e;

const SIGNATURE = 'DiamondWare Musi'; // only these 16 bytes are compared (068a:0311..035a)

// ---------------------------------------------------------------------------------------------
// Stand-alone parser (for tools / validation).  The player below does NOT use it: it walks the
// raw bytes exactly like 068a:00cb does.
const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

// Payload length per event type = what the handler at DS:04e2[type] consumes (068a:0053..00ca).
export const EVENT_PAYLOAD = [4, 1, 1, 2, 0, 2, 3, 0]; // types >= 8: no handler, no payload
export const EVENT_NAMES = ['noteOn', 'noteOffHard', 'noteOffSoft', 'program',
  'nop4', 'level', 'freq', 'nop7'];

// VLQ as read by 068a:0146..01af: up to 4 bytes with continuation bit, the 5th byte is taken
// whole (all 8 bits).  Returns [value, bytesConsumed].
export function readDelta(b, p) {
  let c = b[p]; let n = 1;
  if (c < 0x80) return [c, 1];
  let v = c & 0x7f;
  for (let k = 0; k < 3; k++) {
    c = b[p + n]; n++;
    if (c < 0x80) return [((v << 7) | c) >>> 0, n];
    v = ((v << 7) | (c & 0x7f)) >>> 0;
  }
  c = b[p + n]; n++;
  return [((v << 7) | c) >>> 0, n];
}

export function parseDWM(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let sig = '';
  for (let i = 0; i < 16; i++) sig += String.fromCharCode(b[i]);
  if (sig !== SIGNATURE) throw new Error('not a DWM (068a:0315 signature check)');
  const h = {
    tag: [b[0x10], b[0x11], b[0x12], b[0x13]],   // "c\0\0\x1a" in all files; not read by player
    id: u32(b, 0x14),                             // not read by player; meaning unknown
    eventBytes: u32(b, 0x18),                     // not read by player; == fileSize - eventOffset
    eventCount: u32(b, 0x1c),                     // 068a:036a -> DS:04ce/04ca
    instrOffset: u32(b, 0x20),                    // 068a:0379 -> DS:04be
    eventOffset: u32(b, 0x24),                    // 068a:0380 -> DS:04ba/04b6
    rateX10: u16(b, 0x28),                        // not read by player; MID2DWM rate*10 (evidence only)
    instrCount: u16(b, 0x2a),                     // loaded into DX at 068a:038a, then unused
    version: u16(b, 0x2c),                        // 068a:0390: must be 1
    unk2e: [b[0x2e], b[0x2f], b[0x30], b[0x31], b[0x32], b[0x33]], // never read
  };
  if (h.version !== 1) throw new Error('wrong DWM version (068a:0393)');
  const instruments = [];
  for (let i = 0; i < h.instrCount; i++) {
    instruments.push(Array.from(b.subarray(h.instrOffset + 11 * i, h.instrOffset + 11 * i + 11)));
  }
  const events = [];
  let p = h.eventOffset; let t = 0;
  for (let i = 0; i < h.eventCount; i++) {
    const at = p;
    const [d, n] = readDelta(b, p); p += n; t = (t + d) >>> 0;
    const type = b[p++];
    const len = type < 8 ? EVENT_PAYLOAD[type] : 0;
    const pl = Array.from(b.subarray(p, p + len)); p += len;
    const e = { offset: at, delta: d, time: t, type };
    switch (type) {
      case 0: e.voice = pl[0]; e.level = pl[1]; e.freq = pl[2] | (pl[3] << 8); break;
      case 1: case 2: e.voice = pl[0]; break;
      case 3: e.instrument = pl[0]; e.voice = pl[1]; break;
      case 5: e.voice = pl[0]; e.level = pl[1]; break;
      case 6: e.voice = pl[0]; e.freq = pl[1] | (pl[2] << 8); break;
      default: break;
    }
    events.push(e);
  }
  return { header: h, instruments, events, endOffset: p, fileSize: b.length };
}

// ---------------------------------------------------------------------------------------------
// The player: one instance == the TSR's FM driver + sequencer state (persists across songs,
// like the original: dws_MPlay does not reset instruments/levels/shadow).
export class STKMusic {
  /**
   * @param {(reg:number,val:number)=>void} writeReg  receives every OPL2 register write
   * @param {{mixer?: 'software'|'hardware'}} [opts]
   *   'software' (default): the mixer module at 07ac (used when no SB-Pro/SB16 mixer chip is
   *      detected, 0380:098f..09b2) — dws_XMusic/XMaster scale OPL carrier levels.
   *   'hardware': SB-Pro/SB16 mixer chip — XMusic/XMaster do not touch the OPL; the returned
   *      value from setMusicVolume()/setMasterVolume() says what the mixer chip would get.
   */
  constructor(writeReg, opts = {}) {
    this.out = writeReg;
    this.mixer = opts.mixer || 'software';
    // --- driver state (DS offsets) ---
    this.shadow = new Uint8Array(256).fill(0x88); // DS:029e + reg (init data 0x88, 05c1:043d)
    this.invTL = new Uint8Array(22).fill(0x40);   // DS:025c + op : 0x40 - (TL & 0x3f)
    this.savedAD = new Uint8Array(22).fill(0x88); // DS:0272 + op
    this.savedSR = new Uint8Array(22).fill(0x88); // DS:0288 + op
    this.level = new Uint8Array(11).fill(0x3f);   // DS:0395 + voice
    this.musVol = 0xff;                           // DS:0394
    this.fmOn = 0;                                // DS:03a0
    // --- sequencer state ---
    this.seqInit = 0;      // DS:04f8
    this.playing = 0;      // DS:04f4
    this.paused = 0;       // DS:04f6
    this.loops = 0;        // DS:04f2
    this.song = null;      // buffer
    this.start = 0;        // DS:04b6 event stream start
    this.ptr = 0;          // DS:04ba current event pointer
    this.instr = 0;        // DS:04be instrument table
    this.tickCount = 0;    // DS:04c2
    this.acc = 0;          // DS:04c6 absolute time of last consumed event
    this.evTotal = 0;      // DS:04ca
    this.evLeft = 0;       // DS:04ce
    // --- software mixer (07ac) ---
    this.mixMaster = 0xff; // DS:083c
    this.mixMusic = 0xff;  // DS:083d
    this.dwsInit();
  }

  // dws_Init, FM part (0380:08a9..08d2) followed by mixer init (0380:09b2 -> 07ac:0058).
  dwsInit() {
    this.fmInit();          // 05c1:0542
    this.rhythmSetup();     // 0380:00b6
    this.seqInit = 1;       // 068a:027f (also fills handler table DS:04e2)
    this.playing = 0; this.paused = 0;
    if (this.mixer === 'software') {
      this.mixMusic = 0xff; // 07ac:0058
      this.setMasterVolume(0xff); // 07ac:0062 -> 07ac:0046
    }
  }

  // ======================= OPL driver (segment 05c1) =========================================

  // 05c1:0162  write with shadow compare; the address port is only rewritten when it changes
  // (DS:0250) — irrelevant for register semantics, so not modelled.
  wr(reg, val) {
    reg &= 0xff; val &= 0xff;
    if (this.shadow[reg] === val) return;
    this.shadow[reg] = val;
    this.out(reg, val);
  }

  // 05c1:01a1  same value to regs [from..to]
  wrRange(from, to, val) { for (let r = from; r <= to; r++) this.wr(r, val); }

  // 05c1:01b4  write one instrument word to an operator pair of channel `ch`.
  // base 0xC0..0xC8: single write of the LOW byte to base+ch.
  // otherwise: HIGH byte -> carrier (base+car), then LOW byte -> modulator (base+mod).
  wrPair(ch, lo, hi, base) {
    if (base >= 0xc0 && base <= 0xc8) { this.wr(base + ch, lo); return; }
    const pair = OP_PAIR[ch];
    this.wr((pair & 0xff) + base, hi);
    this.wr((pair >> 8) + base, lo);
  }

  // 05c1:0306  remember inverted TL of both ops (called with the KSL/TL word, before 0x40 write)
  storeTL(ch, lo, hi) {
    const pair = OP_PAIR[ch];
    this.invTL[pair & 0xff] = (0x40 - (hi & 0x3f)) & 0xff;
    this.invTL[pair >> 8] = (0x40 - (lo & 0x3f)) & 0xff;
  }

  // 05c1:0239  remember AD (which=0) or SR (which=1) of both ops
  saveEnv(ch, lo, hi, which) {
    const pair = OP_PAIR[ch];
    const arr = which === 0 ? this.savedAD : this.savedSR;
    arr[pair & 0xff] = hi;
    arr[pair >> 8] = lo;
  }

  // 05c1:01ee  restore saved AD/SR: car 0x60, car 0x80, mod 0x60, mod 0x80
  restoreEnv(ch) {
    const car = OP_PAIR[ch] & 0xff, mod = OP_PAIR[ch] >> 8;
    this.wr(0x60 + car, this.savedAD[car]);
    this.wr(0x80 + car, this.savedSR[car]);
    this.wr(0x60 + mod, this.savedAD[mod]);
    this.wr(0x80 + mod, this.savedSR[mod]);
  }

  // 05c1:026e  fast envelope: car 0x60=FF, car 0x80=0F, mod 0x60=FF, mod 0x80=0F
  fastEnv(ch) {
    const car = OP_PAIR[ch] & 0xff, mod = OP_PAIR[ch] >> 8;
    this.wr(0x60 + car, 0xff);
    this.wr(0x80 + car, 0x0f);
    this.wr(0x60 + mod, 0xff);
    this.wr(0x80 + mod, 0x0f);
  }

  // 05c1:0340  set voice level (0..63) and write the scaled TL.
  //   q  = ((musVol+1)*(lvl+1)*invTL[op] - 1) >> 14) + 1       (1..64)
  //   TL = 0x40 - q                                            (0..63)
  //   reg 0x40+op = (shadow & 0xC0) | TL
  // carrier op always; modulator op too when voice==6, or voice<6 and C0 bit0 (additive) set.
  setLevel(v, lvl) {
    lvl &= 0x3f;
    this.level[v] = lvl;
    const scale = (op) => {
      const a = ((this.musVol + 1) * (lvl + 1)) & 0xffff;           // 16-bit MUL, DX=0
      const p = (a * this.invTL[op]) >>> 0;                         // DX:AX -> EDX
      const q = ((((p - 1) >>> 0) >>> 14) + 1) & 0xffff;            // dec/shr 14/inc
      const tl = (0x40 - (q & 0xff)) & 0xff;                        // 05c1:02fd on AL
      this.wr(0x40 + op, (this.shadow[0x40 + op] & 0xc0) | tl);
    };
    scale(CAR_OP[v]);
    if (v === 6 || (v < 6 && (this.shadow[0xc0 + v] & 1))) scale(MOD_OP[v]);
  }

  // 05c1:03fe  set music volume (only when FM is on) and re-apply all 11 voice levels
  setMusVol(vol) {
    if (!this.fmOn) return;
    this.musVol = vol & 0xff;
    for (let v = 0; v < 11; v++) this.setLevel(v, this.level[v]);
  }

  // 05c1:042b  OPL reset
  reset() {
    this.shadow.fill(0x88, 0, 0xf5);   // DS:029e, 0xF5 bytes
    this.wrRange(0x01, 0x05, 0x00);
    this.wr(0x08, 0x00);
    this.wrRange(0x20, 0x25, 0x00); this.wrRange(0x28, 0x2d, 0x00); this.wrRange(0x30, 0x35, 0x00);
    this.wrRange(0x40, 0x45, 0xff); this.wrRange(0x48, 0x4d, 0xff); this.wrRange(0x50, 0x55, 0xff);
    this.wrRange(0x60, 0x65, 0xff); this.wrRange(0x68, 0x6d, 0xff); this.wrRange(0x70, 0x75, 0xff);
    this.wrRange(0x80, 0x85, 0x0f); this.wrRange(0x88, 0x8d, 0x0f); this.wrRange(0x90, 0x95, 0x0f);
    this.wrRange(0xa0, 0xa8, 0x00);
    this.wrRange(0xb0, 0xb8, 0x00);
    this.wrRange(0xc0, 0xc8, 0x00);
    this.wr(0xbd, 0x20);               // rhythm mode on
    this.wr(0x01, 0x20);               // waveform select enable
    this.wrRange(0xe0, 0xe5, 0x00); this.wrRange(0xe8, 0xed, 0x00); this.wrRange(0xf0, 0xf5, 0x00);
  }

  // 05c1:0542  FM init: reset, setMusVol(0xFF) (a no-op: fmOn still 0), fmOn = 1
  fmInit() { this.reset(); this.setMusVol(0xff); this.fmOn = 1; }

  // 05c1:05ad  FM kill (dws_Kill): fmOn = 0, reset, 0xBD = 0
  fmKill() { this.fmOn = 0; this.reset(); this.wr(0xbd, 0x00); }

  // 05c1:05cc  note on
  noteOn(v, lvl, freq) {
    this.setLevel(v, lvl);
    if (this.musVol === 0) return;                 // 05c1:05e3
    if (v < 6) {
      this.restoreEnv(v);
      this.wr(0xa0 + v, freq & 0xff);
      this.wr(0xb0 + v, ((freq >> 8) & 0x1f) | 0x20);
      return;
    }
    if (v === 6) {
      this.wr(0xa6, freq & 0xff);
      this.wr(0xb6, (freq >> 8) & 0x1f);
    }
    this.wr(0xbd, this.shadow[0xbd] | RHY_BIT[v]); // 05c1:062a
  }

  // 05c1:0642  frequency change (voices 0..6 only); note: high byte is NOT masked (AND hits AH
  // after AL was copied, 05c1:066b..0670)
  setFreq(v, freq) {
    if (v > 6) return;
    this.wr(0xa0 + v, freq & 0xff);
    this.wr(0xb0 + v, ((freq >> 8) & 0xff) | (this.shadow[0xb0 + v] & 0xe0));
  }

  // 05c1:0680  level change only
  changeLevel(v, lvl) { this.setLevel(v, lvl); }

  // 05c1:069c -> 05c1:02a7  "soft" note off, voices 0..5 only (6..10: nothing)
  noteOffSoft(v) {
    if (v > 5) return;
    const car = CAR_OP[v];
    if (this.shadow[0x20 + car] & 0x20) {            // carrier EG-TYP (sustaining)
      this.wr(0xb0 + v, this.shadow[0xb0 + v] & 0xdf); // key off
    } else {                                         // non-sustaining: key stays on,
      const c = OP_PAIR[v] & 0xff, m = OP_PAIR[v] >> 8; // sustain level -> 0 on both ops
      this.wr(0x80 + c, this.shadow[0x80 + c] & 0x0f);
      this.wr(0x80 + m, this.shadow[0x80 + m] & 0x0f);
    }
  }

  // 05c1:06b8  "hard" note off
  noteOffHard(v) {
    if (v < 6) {
      this.fastEnv(v);
      this.wr(0xb0 + v, this.shadow[0xb0 + v] & 0xdf);
    } else {
      this.wr(0xbd, this.shadow[0xbd] & (~RHY_BIT[v] & 0xff));
    }
  }

  // 05c1:06fb  load an 11-byte instrument into voice v (0..6); v > 6 only gets the note-off
  loadPatch(v, p) {
    this.noteOffHard(v);
    if (v > 6) return;
    this.wrPair(v, p[0], p[1], 0x20);
    this.storeTL(v, p[2], p[3]);
    this.wrPair(v, p[2], p[3], 0x40);
    this.saveEnv(v, p[4], p[5], 0);
    this.wrPair(v, p[4], p[5], 0x60);
    this.saveEnv(v, p[6], p[7], 1);
    this.wrPair(v, p[6], p[7], 0x80);
    this.wrPair(v, p[8], p[9], 0xe0);
    this.wrPair(v, p[10], 0, 0xc0);   // single write of byte 10 to 0xC0+v
  }

  // 05c1:075b  rhythm channels 7 and 8: frequency (no key-on) + patch (no AD/SR save)
  loadRhythm(f7, p7, f8, p8) {
    for (const [ch, f, p] of [[7, f7, p7], [8, f8, p8]]) {
      this.wr(0xa0 + ch, f & 0xff);
      this.wr(0xb0 + ch, (f >> 8) & 0x1f);
      this.wrPair(ch, p[0], p[1], 0x20);
      this.storeTL(ch, p[2], p[3]);
      this.wrPair(ch, p[2], p[3], 0x40);
      this.wrPair(ch, p[4], p[5], 0x60);
      this.wrPair(ch, p[6], p[7], 0x80);
      this.wrPair(ch, p[8], p[9], 0xe0);
      this.wrPair(ch, p[10], 0, 0xc0);
    }
  }

  // 0380:00b6  rhythm setup done by dws_Init
  rhythmSetup() {
    this.loadPatch(6, BD_PATCH);
    this.loadRhythm(CH7_FREQ, CH7_PATCH, CH8_FREQ, CH8_PATCH);
  }

  // ======================= sequencer (segment 068a) ==========================================

  // 068a:000c
  allNotesOff() { for (const v of ALL_OFF_VOICES) this.noteOffHard(v); }

  // 068a:02ca  dws_MClear (also used by dws_MPlay before loading)
  clear() { this.playing = 0; this.allNotesOff(); }

  /**
   * 068a:02e8  dws_MPlay.  count = times to play (0 = forever); the game uses 1.
   * Returns 0 ok, 1 sequencer not initialised, 2 not a DWM, 3 wrong version (same codes).
   */
  play(bytes, count = 1) {
    if (!this.seqInit) return 1;
    this.clear();
    this.loops = count & 0xffff;
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let i = 0; i < 16; i++) if (b[i] !== SIGNATURE.charCodeAt(i)) return 2;
    this.evTotal = this.evLeft = u32(b, 0x1c);
    const ins = u32(b, 0x20), ev = u32(b, 0x24);
    if (u16(b, 0x2c) !== 1) return 3;
    this.song = b;
    this.instr = ins;
    this.ptr = this.start = ev;
    this.tickCount = 0;
    this.acc = 0;
    this.playing = 1;
    return 0;
  }

  // 068a:03e1  dws_MSongStatus: bit0 playing, bit1 paused
  status() { return (this.playing ? 1 : 0) | (this.paused ? 2 : 0); }

  // 068a:0401  dws_MPause(1) / dws_MUnPause(0)
  pause() { this.allNotesOff(); this.paused = 1; }
  unpause() { this.paused = 0; }

  // Out-of-range reads: the original reads whatever follows the buffer in memory; we return 0.
  rb() { const x = this.song[this.ptr++]; return x === undefined ? 0 : x; }

  // 068a:00cb  one sequencer step (= one dws_Update = one timer interrupt)
  tick() {
    if (!this.seqInit || !this.playing || this.paused) return;
    this.tickCount = (this.tickCount + 1) >>> 0;
    const b = this.song;
    let acc = this.acc;
    for (;;) {
      const [d, n] = readDelta(b, this.ptr);
      if (this.tickCount < ((acc + d) >>> 0)) break;  // 068a:01b5  (unsigned)
      acc = (acc + d) >>> 0;
      this.ptr += n;
      const type = this.rb();
      if (type < 8) this.dispatch(type);             // 068a:01c3 (types >= 8: skipped, no payload)
      this.evLeft = (this.evLeft - 1) >>> 0;
      if (this.evLeft !== 0) continue;
      // end of song, 068a:01d9
      this.allNotesOff();
      if (this.loops !== 0) {
        this.loops = (this.loops - 1) & 0xffff;
        if (this.loops === 0) { this.playing = 0; return; }
      }
      this.ptr = this.start;                          // rewind; rest of this tick is skipped
      this.evLeft = this.evTotal;
      this.tickCount = 0;
      this.acc = 0;
      return;
    }
    this.acc = acc;                                   // 068a:0226
  }

  // handler table DS:04e2 filled at 068a:0291..02be
  dispatch(type) {
    switch (type) {
      case 0: { // 068a:0053
        const v = this.rb();
        this.noteOffHard(v);
        const lvl = this.rb();
        const f = this.rb() | (this.rb() << 8);
        this.noteOn(v, lvl, f);
        break;
      }
      case 1: this.noteOffHard(this.rb()); break;      // 068a:0069
      case 2: this.noteOffSoft(this.rb()); break;      // 068a:0073
      case 3: { // 068a:007d  instrument n (11-byte records at instrOffset) -> voice
        const n = this.rb();
        const v = this.rb();
        const o = this.instr + 11 * n;
        const p = [];
        for (let i = 0; i < 11; i++) { const x = this.song[o + i]; p.push(x === undefined ? 0 : x); }
        this.loadPatch(v, p);
        break;
      }
      case 4: break;                                   // 068a:00ab (ret)
      case 5: { const v = this.rb(); this.changeLevel(v, this.rb()); break; } // 068a:00ac
      case 6: { // 068a:00bc
        const v = this.rb();
        const f = this.rb() | (this.rb() << 8);
        this.setFreq(v, f);
        break;
      }
      case 7: break;                                   // 068a:00ca (ret)
      default: break;
    }
  }

  // ======================= mixer (07ac software / 0561 SB-Pro / 057d SB16) ===================

  // 07ac:0008  (((v<<8)/255) * master) >> 8, 16-bit arithmetic
  mixScale(v) {
    const q = Math.floor(((v << 8) & 0xffff) / 255);
    return ((q * this.mixMaster) & 0xffff) >> 8;
  }

  /** dws_XMusic(v), v 0..255 (0380:0bab rejects > 255). */
  setMusicVolume(v) {
    if (v > 0xff) return false;
    if (this.mixer === 'software') {                 // 07ac:0039
      this.mixMusic = v;
      this.setMusVol(this.mixScale(v));
      return true;
    }
    return hardwareMixerValues(v);                   // 0561:0153 / 057d:01d9
  }

  /** dws_XMaster(v) */
  setMasterVolume(v) {
    if (v > 0xff) return false;
    if (this.mixer === 'software') {                 // 07ac:0046 (also re-applies XDig)
      this.mixMaster = v;
      this.setMusVol(this.mixScale(this.mixMusic));
      return true;
    }
    return hardwareMixerValues(v);                   // 0561:018a / 057d:021e
  }
}

// SB-Pro: steps = number of 32s strictly below v (0..7); reg value = steps*2 | (steps*2)<<4
//         (music -> mixer reg 0x26, master -> 0x22)          0561:0153 / 0561:018a
// SB16:   steps = number of 8s strictly below v (0..31); reg value = steps<<3 to both L and R
//         (music -> 0x34/0x35, master -> 0x30/0x31)            057d:01d9 / 057d:021e
export function hardwareMixerValues(v) {
  let s = 0; for (let c = 0x20; v > c; c += 0x20) s++;
  let t = 0; for (let c = 0x08; v > c; c += 0x08) t++;
  return { sbpro: ((s << 1) | (s << 5)) & 0xff, sb16: (t << 3) & 0xff };
}
