// digi-mixer.js — port of the DIGITIZED-sound part of DiamondWare STK 2.22 (STKRUN.EXE).
//
// Every routine cites the STKRUN.EXE code it was ported from as seg:off (MZ load segment 0;
// linear = seg*16+off). See DIGI.md for the write-up. Nothing is guessed; oddities of the original
// (bugs included) are reproduced and marked "QUIRK".
//
// State model: the STK data segment DS=0x07FE is modelled as a 64 KiB byte array (this.ds) with the
// real layout, because one bug (DDiscardAO, 0750:04e4) writes to DS:0x574+soundnum, i.e. anywhere.
// All voice/sequence tables, [0x19] block size, [0x120] half index, [0x125] level, the volume table
// at DS:0x1F, [0x674] #voices, [0x83A] last soundnum, [0x83C..0x83E] mixer levels are read from it.
// Sample data is addressed as real-mode seg:off; DWD buffers are placed in a simulated linear
// address space (registerBuffer). Bytes outside any registered buffer read as 0 (unknown in reality).
//
// Output: unsigned 8-bit mono DAC bytes at sbRate(requested) Hz; render() gives (u-128)/128.

export const ERR = {
  EZERO: 0, NOTINITTED: 1, NOTSUPPORTED: 3, X_BADINPUT: 9,
  D_NOTADWD: 10, D_NOTSUPPORTEDVER: 11, D_INTERNALERROR: 12,
  DPLAY_NOSPACEFORSOUND: 13, DSETRATE_FREQTOLOW: 14, DSETRATE_FREQTOHIGH: 15,
};
export const DSOUNDSTATUSPLAYING = 1;   // 0750:0538
export const DSOUNDSTATUSSEQUENCED = 2; // 0750:0540

// DMA block (half-buffer) size table DS(0x0A0F):0x190, indexed by the environment code of
// 0380:07e4 (0 = no memory manager / no VDS, e.g. plain DOS or DOSBox).
export const BLOCK_SIZE_BY_ENV = [0x100, 0x100, 0x100, 0x100, 0x100, 0x200, 0x200,
  0x100, 0x100, 0x100, 0x100, 0x100, 0x200, 0x200];

// ---- DS:07FE layout (word arrays, one word per voice) -----------------------------------------
// active slots                                    sequenced ("presnd") entries
const PRIO = 0x554, FLAGS = 0x574, MAXS = 0x594,   SPRIO = 0x69a, SFLAGS = 0x6ba, SMAXS = 0x6da;
const OFF = 0x5b4, SEG = 0x5d4, LEN = 0x5f4,       SOFF = 0x77a, SSEG = 0x79a, SLEN = 0x7ba;
const POS = 0x614, SN = 0x634, CNT = 0x654,        SPOS = 0x7da, KEY = 0x7fa, SCNT = 0x81a;
const NVOICES = 0x674, LASTSN = 0x83a, XMASTER = 0x83c, XMUSIC = 0x83d, XDIG = 0x83e;
const BLOCK = 0x19, HALF = 0x120, LEVEL = 0x125, VOLTAB = 0x1f;
const F_INFINITE = 0x01, F_SEQUENCED = 0x02, F_AUDIBLE = 0x40;
const SLOT_FIELDS = [MAXS, OFF, SEG, LEN, POS, PRIO, FLAGS, CNT]; // copy order of 0750:0087/00f6

// ---------------------------------------------------------------- rate

// 066d:0083 — clamp + Sound Blaster time constant. Returns {tc, hz}.
export function sbTimeConstant(requested) {
  let ax = requested & 0xffff;
  if (ax <= 0x0f44) ax = 0x0f44;                  // 066d:008c  <= 3908 -> 3908
  if (ax >= 0x4487 && ax <= 0x45c2) ax = 0x4487;  // 066d:0094  17543..17858 -> 17543
  if (ax >= 0x5dc0) ax = 0x5dc0;                  // 066d:00a1  >= 24000 -> 24000
  const div = Math.floor(1000000 / ax);           // 066d:00ab  0xF4240 / rate (DIV truncates)
  const tc = (0x100 - div) & 0xff;                // 066d:00b3  DSP cmd 0x40, TC byte
  return { tc, hz: 1000000 / (256 - tc) };        // SB DSP: rate = 1e6/(256-TC)
}
export const sbRate = (requested) => sbTimeConstant(requested).hz;

// ---------------------------------------------------------------- DWD header

// 0750:0028 — the only header validation. 0 ok, 1 not a DWD, 2 bad version.
export function checkDWD(snd) {
  if (snd[0x00] !== 0x44 || snd[0x07] !== 0x57 || snd[0x0c] !== 0x44) return 1; // 'D','W','D'
  if (snd[0x18] !== 1 || snd[0x19] !== 0) return 2;                             // version 1.0
  return 0;
}
const rd16 = (b, o) => b[o] | (b[o + 1] << 8);

// ---------------------------------------------------------------- volume helpers (pure)

// 07ac:0008 — software mixer: effective digital level from XDig (d) and XMaster (m).
export function softwareEffectiveLevel(d, m) {
  const q = Math.floor(((d << 8) & 0xffff) / 0xff); // SHL AX,8 ; DIV BX(=255)
  return ((q * m) & 0xffff) >> 8;                   // MUL BL([0x83C]) ; SHR AX,8
}
// 02f1:0749 as a pure function (table index 0..255). The real routine also writes T[0x100]
// (= DS:0x11F) — see DigiMixer._buildVolumeTable, which reproduces that write.
export function buildVolumeTable(v) {
  const t = new Uint8Array(256);
  if (v === 0) { t.fill(0x80); return t; }
  t[0x80] = 0x80;
  for (let cx = 0x7f, di = 0; cx >= 0; cx--, di++) {
    const dx = ((cx * v) & 0xffff) >> 8;
    if (0x81 + cx <= 0xff) t[0x81 + cx] = (dx + 0x80) & 0xff;
    t[di] = 0x7f ^ dx;
  }
  return t;
}
// Hardware mixer register values (samples NOT scaled). 0561:011c (SB Pro), 057d:0194 (SB16).
export function sbProRegValue(v) { // regs 0x04 dig, 0x22 master, 0x26 FM
  let bx = 0, cx = 0x20; v &= 0xff;
  while (v > cx) { cx += 0x20; bx++; }
  bx <<= 1; return bx | (bx << 4);
}
export function sb16RegValue(v) { // regs 0x32/0x33 dig, 0x30/0x31 master, 0x34/0x35 FM
  let bx = 0, cx = 8; v &= 0xff;
  while (v > cx) { cx += 8; bx++; }
  return (bx << 3) & 0xff;
}

// ---------------------------------------------------------------- mixer

export class DigiMixer {
  /**
   * @param {object} o
   *  rate       dws_IDEAL.digrate (default 10989)
   *  nvoices    dws_IDEAL.dignvoices (0750:016b turns any value <= 16 into 16)
   *  blockSize  [0x19], DMA half-buffer (default 256 = BLOCK_SIZE_BY_ENV[0])
   *  mixerType  'software' (type 1) | 'sbpro' (type 3) | 'sb16' (type 4)
   *  initialDma Uint8Array(2*blockSize): DMA buffer contents before the first IRQ. Not
   *             determined from the code except the first 8 bytes (0x80, 02f1:006a);
   *             default all 0x80.
   */
  constructor(o = {}) {
    this.ds = new Uint8Array(0x10000);
    this.errno = 0;                                      // [0x290] in DS(0A0F)
    this.stats = { aoStrayWrites: 0, aoStrayOutsideFlags: 0 }; // diagnostics only
    this.mixerType = o.mixerType ?? 'software';
    this.bufs = [];                                      // simulated linear memory: {lin, snd}
    this.bufInfo = new Map();                            // snd -> {seg, off}
    this.nextSeg = 0x2000;
    const B = o.blockSize ?? 0x100;
    this.w16(BLOCK, B);                                  // 02f1:082e
    // DMA buffer: two halves of B bytes, auto-init. 02f1:0004 sets [0xF]=buf, [0x11]=buf+B.
    this.dma = new Uint8Array(2 * B).fill(0x80);
    if (o.initialDma) this.dma.set(o.initialDma.subarray(0, 2 * B));
    this.dma.fill(0x80, 0, 8);                           // 02f1:0061..006f
    this.ds[HALF] = 1;                                   // 02f1:0891
    this.ds[0x126] = 0;                                  // 02f1:087b (not paused)
    this.reqRate = 0; this.rateInfo = null;
    this._setRate(o.rate ?? 10989);                      // 02f1:08af -> 066d:0083
    this._buildVolumeTable(0xff);                        // 02f1:0824
    this._setVoices(o.nvoices ?? 16);                    // 02f1:083a -> 0750:016b
    this.hwRegs = {};
    if (this.mixerType === 'software') {                 // 07ac:0058
      this.ds[XMUSIC] = 0xff; this.ds[XDIG] = 0xff; this._swMaster(0xff);
    } else { this.xLevels = { m: 0xff, f: 0xff, d: 0xff }; this._hw(); }
    this.dmaPos = 0;                                     // byte position inside this.dma
  }

  // ------------------------------------------------ memory model
  r16(a) { a &= 0xffff; return this.ds[a] | (this.ds[(a + 1) & 0xffff] << 8); }
  w16(a, v) { a &= 0xffff; this.ds[a] = v & 0xff; this.ds[(a + 1) & 0xffff] = (v >> 8) & 0xff; }
  f(base, i) { return this.r16(base + 2 * i); }            // word array element
  sf(base, i, v) { this.w16(base + 2 * i, v); }

  /** Place a DWD buffer at seg:off in the simulated address space (default: auto). */
  registerBuffer(snd, seg, off = 0) {
    if (seg === undefined) { seg = this.nextSeg; this.nextSeg += 0x1000; }
    this.bufInfo.set(snd, { seg, off });
    this.bufs.push({ lin: seg * 16 + off, snd });
    return { seg, off };
  }
  _ptr(snd) { return this.bufInfo.get(snd) ?? this.registerBuffer(snd); }
  _readLin(lin) {
    for (const b of this.bufs) { const d = lin - b.lin; if (d >= 0 && d < b.snd.length) return b.snd[d]; }
    return 0;
  }
  _bufAt(seg) { for (const b of this.bufs) if (b.lin === seg * 16 || (b.lin >> 4) === seg) return b.snd; return null; }

  // Compatibility views (read-only snapshots) of the tables.
  get slots() {
    const n = this.f(NVOICES, 0), a = [];
    for (let i = 0; i < n; i++) a.push({ sn: this.f(SN, i), prio: this.f(PRIO, i), flags: this.f(FLAGS, i),
      maxs: this.f(MAXS, i), start: this.f(OFF, i), snd: this._bufAt(this.f(SEG, i)), seg: this.f(SEG, i),
      len: this.f(LEN, i), pos: this.f(POS, i), count: this.f(CNT, i) });
    return a;
  }
  get seq() {
    const n = this.f(NVOICES, 0), a = [];
    for (let i = 0; i < n; i++) a.push({ key: this.f(KEY, i), prio: this.f(SPRIO, i), flags: this.f(SFLAGS, i),
      maxs: this.f(SMAXS, i), start: this.f(SOFF, i), snd: this._bufAt(this.f(SSEG, i)), seg: this.f(SSEG, i),
      len: this.f(SLEN, i), pos: this.f(SPOS, i), count: this.f(SCNT, i) });
    return a;
  }
  get lastSn() { return this.r16(LASTSN); }
  set lastSn(v) { this.w16(LASTSN, v); }
  get level() { return this.ds[LEVEL]; }
  get nvoices() { return this.r16(NVOICES); }
  get blockSize() { return this.r16(BLOCK); }
  get paused() { return this.ds[0x126] === 1; }
  get outputRate() { return this.rateInfo.hz; }

  _setRate(r) { this.reqRate = r & 0xffff; this.rateInfo = sbTimeConstant(r); } // [0x3FC]

  // ------------------------------------------------ API (0380:xxxx workers -> 0750 core)

  // dws_DPlay — 0380:1038. dp = {snd, count, priority, presnd}; soundnum is written back.
  DPlay(dp) {
    const snd = dp.snd, count = (dp.count ?? 1) & 0xffff, prio = (dp.priority ?? 0) & 0xffff;
    const presnd = (dp.presnd ?? 0) & 0xffff;
    let r;
    if (presnd > 9) {                                                  // 0380:105d
      r = this._seqPlay(snd, count, prio, presnd);                     // 0750:024d
      if (r === 3) r = this._play(snd, count, prio);                   // 0380:1083 -> 0750:032e
    } else r = this._play(snd, count, prio);
    dp.soundnum = r;             // 0380:107f/10a2: raw result: soundnum, or 0 (no space), 1/2 (bad DWD)
    if (r > 9) return 1;                                               // 0380:10a9
    this.errno = r === 0 ? ERR.DPLAY_NOSPACEFORSOUND : r === 1 ? ERR.D_NOTADWD
      : r === 2 ? ERR.D_NOTSUPPORTEDVER : ERR.D_INTERNALERROR;         // 0380:10b5..10e2
    return 0;
  }

  // dws_DSoundStatus — 0750:0516
  DSoundStatus(sn) {
    sn &= 0xffff; let st = 0;
    if (sn >= 0x0a) {
      for (let i = 0; i < this.nvoices; i++) {
        if (this.f(SN, i) === sn) st |= DSOUNDSTATUSPLAYING;
        if (this.f(KEY, i) === sn) st |= DSOUNDSTATUSSEQUENCED;
      }
    }
    return { ok: 1, status: st };
  }

  // dws_DDiscard — 0750:040e (always succeeds)
  DDiscard(sn) {
    sn &= 0xffff;
    if (sn < 0x0a) return 1;                                           // 0750:041c
    for (let dx = 0; dx < this.nvoices; dx++) {                        // 0750:0428..044e
      if (this.f(SN, dx) === sn) { this._remove(dx); dx--; }
      // after a removal dx = old-1, so KEY[-1] = word DS:0x7F8 (= SPOS[15]) is tested: QUIRK
      if (this.f(KEY, dx) === sn) this.sf(KEY, dx, 0);
    }
    return 1;
  }

  // dws_DDiscardAO — 0380:11a6 -> 0750:045a
  DDiscardAO(snd) {
    const c = checkDWD(snd);
    if (c) { this.errno = c === 1 ? ERR.D_NOTADWD : c === 2 ? ERR.D_NOTSUPPORTEDVER : ERR.D_INTERNALERROR; return 0; }
    const { seg, off } = this._ptr(snd);
    const key = (rd16(snd, 0x2e) + off) & 0xffff;                      // 0750:0483..048c
    for (let bx = 0; bx < this.nvoices; bx++) {                        // 0750:0491..04c1
      if (this.f(SN, bx) && this.f(SEG, bx) === seg && this.f(OFF, bx) === key) {
        this.DDiscard(this.f(SN, bx)); bx--;
      }
    }
    for (let bx = 0; bx < this.nvoices; bx++) {                        // 0750:04c3..0505
      const k = this.f(KEY, bx);
      if (k && this.f(SSEG, bx) === seg && this.f(SOFF, bx) === key) {
        this.sf(KEY, bx, 0);
        // QUIRK 0750:04e4..04f7: `or/xor word [sn+0x574], 2` — soundnum used as a BYTE offset:
        // clears bit value 2 of the word at DS:(0x574+sn), wherever that is.
        const a = (FLAGS + k) & 0xffff;
        this.stats.aoStrayWrites++; if (a < FLAGS || a >= FLAGS + 0x20) this.stats.aoStrayOutsideFlags++;
        this.w16(a, this.r16(a) & ~2);
      }
    }
    return 1;
  }

  // dws_DClear — 0750:01ab -> 0750:016b
  DClear() { this._setVoices(this.nvoices); return 1; }

  // dws_DPause / dws_DUnPause — 02f1:06be / 02f1:06cd ([0x126]; no pause count)
  DPause() { this.ds[0x126] = 1; return 1; }
  DUnPause() { this.ds[0x126] = 0; return 1; }

  // dws_DSetRate — 0380:0eba -> 02f1:06dc
  DSetRate(f) {
    f &= 0xffff;
    if (f > 0x5dc0) { this.errno = ERR.DSETRATE_FREQTOHIGH; return 0; }
    if (f < 0x0f44) { this.errno = ERR.DSETRATE_FREQTOLOW; return 0; }
    // 02f1:06e6..0741: [0x121]=0, [0x120]=1, DSP halt (0xD0) + reset, new TC, speaker on,
    // DMA+DSP restarted from the start of half 0. The halves keep their (already mixed) data,
    // so both stale halves replay before newly mixed data. Voices are untouched.
    this.ds[0x121] = 0; this.ds[HALF] = 1;
    this._setRate(f);
    this.dmaPos = 0;
    return 1;
  }
  // dws_DGetRate — 066d:00d3: last REQUESTED value [0x3FC]
  DGetRate() { return { ok: 1, rate: this.reqRate }; }
  // dws_DGetRateFromDWD — 0380:0fb8: *result is written BEFORE the error check (0380:0fce),
  // so on failure it receives 1 (not a DWD) or 2 (bad version). QUIRK: rate 1/2 also "fails".
  DGetRateFromDWD(snd) {
    const c = checkDWD(snd); const r = c ? c : rd16(snd, 0x20);        // 0750:03e5
    if (r === 1) { this.errno = ERR.D_NOTADWD; return { ok: 0, rate: 1 }; }
    if (r === 2) { this.errno = ERR.D_NOTSUPPORTEDVER; return { ok: 0, rate: 2 }; }
    return { ok: 1, rate: r };
  }

  // dws_XDig / dws_XMaster / dws_XMusic — 0380:0c0c / 0b00 (+0b56) / 0b90
  XDig(v) {
    v &= 0xffff; if (v > 0xff) { this.errno = ERR.X_BADINPUT; return 0; }
    if (this.mixerType === 'software') this._swDig(v); else { this.xLevels.d = v; this._hw(); }
    return 1;
  }
  XMaster(v) {
    v &= 0xffff;
    if (v === 0x6969) { this.errno = 0xde; return 0x0b; }             // 0380:0b56 magic value
    if (v > 0xff) { this.errno = ERR.X_BADINPUT; return 0; }
    if (this.mixerType === 'software') this._swMaster(v); else { this.xLevels.m = v; this._hw(); }
    return 1;
  }
  XMusic(v) {
    v &= 0xffff; if (v > 0xff) { this.errno = ERR.X_BADINPUT; return 0; }
    if (this.mixerType === 'software') this.ds[XMUSIC] = v;             // 07ac:0039 (FM part not modelled)
    else { this.xLevels.f = v; this._hw(); }
    return 1;
  }
  // 07ac:002c — dig level -> effective level -> table
  _swDig(v) { this.ds[XDIG] = v; this._buildVolumeTable(softwareEffectiveLevel(v, this.ds[XMASTER])); }
  // 07ac:0046 — master; recomputes music (07ac:0039) and dig (07ac:002c) from the stored bytes
  _swMaster(v) { this.ds[XMASTER] = v; this._swDig(this.ds[XDIG]); }
  _hw() {
    const { d, m, f } = this.xLevels;
    if (this.mixerType === 'sbpro') this.hwRegs = { 0x04: sbProRegValue(d), 0x22: sbProRegValue(m), 0x26: sbProRegValue(f) };
    else if (this.mixerType === 'sb16') {
      const D = sb16RegValue(d), M = sb16RegValue(m), F = sb16RegValue(f);
      this.hwRegs = { 0x30: M, 0x31: M, 0x32: D, 0x33: D, 0x34: F, 0x35: F };
    }
  }
  // 02f1:0749 — writes [0x125] and the table at DS:0x1F (incl. the stray write to DS:0x11F)
  _buildVolumeTable(v) {
    v &= 0xff; this.ds[LEVEL] = v;
    if (v === 0) { for (let i = 0; i < 0x100; i++) this.ds[VOLTAB + i] = 0x80; return; }
    this.ds[0x9f] = 0x80;
    for (let cx = 0x7f, di = 0; cx >= 0; cx--, di++) {
      const dx = ((cx * v) & 0xffff) >> 8;
      this.ds[0xa0 + cx] = (dx + 0x80) & 0xff;
      this.ds[VOLTAB + di] = 0x7f ^ dx;
    }
  }

  // ------------------------------------------------ voice management (segment 0750)

  // 0750:016b — set #voices (<=16 -> 16) and clear active + sequence keys
  _setVoices(ax) {
    ax &= 0xffff; if (ax === 0) ax = 1; if (ax <= 0x10) ax = 0x10;
    this.w16(NVOICES, ax);
    for (let i = 0; i < ax; i++) { this.sf(SN, i, 0); this.sf(KEY, i, 0); }
  }

  // 0750:0002 — next soundnum (> 10, not equal to any ACTIVE slot's soundnum)
  _newSoundnum() {
    for (;;) {
      do { this.w16(LASTSN, this.r16(LASTSN) + 1); } while (this.r16(LASTSN) <= 0x0a);
      const ax = this.r16(LASTSN); let hit = false;
      for (let cx = 0; cx < this.nvoices; cx++) if (this.f(SN, cx) === ax) { hit = true; break; }
      if (!hit) return ax;
    }
  }

  // 0750:0087 — shift slots [dx .. n-2] down by one (the last slot's occupant is lost)
  _shiftDown(dx) {
    for (let i = this.nvoices - 1; i > dx; i--) {
      const a = this.f(SN, i - 1); this.sf(SN, i, a);
      if (a) for (const b of SLOT_FIELDS) this.sf(b, i, this.f(b, i - 1));
    }
  }
  // 0750:00f6 — remove slot bx; the loop also runs for dx=n-1 and copies "slot n", i.e. the
  // words right after each array (reproduced by the memory model), then clears SN[n-1].
  _remove(bx) {
    const n = this.nvoices;
    for (let dx = bx; dx <= n - 1; dx++) {
      const a = this.f(SN, dx + 1); this.sf(SN, dx, a);
      if (a) for (const b of SLOT_FIELDS) this.sf(b, dx, this.f(b, dx + 1));
    }
    this.sf(SN, n - 1, 0);                                              // 0750:015f..0161
  }

  // 0750:032e — insert a voice sorted by priority (descending; ties FIFO)
  _play(snd, count, prio) {
    const c = checkDWD(snd); if (c) return c;                           // 0750:0347
    const { seg, off } = this._ptr(snd);
    let dx = 0;
    for (;;) {                                                          // 0750:0355..036b
      if (this.f(SN, dx) === 0 || prio > this.f(PRIO, dx)) break;
      if (++dx >= this.nvoices) return 0;                               // no space
    }
    this._shiftDown(dx);                                                // 0750:0374
    this.sf(OFF, dx, rd16(snd, 0x2e) + off);                            // 0750:037b..0387
    this.sf(SEG, dx, seg);
    this.sf(MAXS, dx, rd16(snd, 0x24));                                 // 0750:0392
    this.sf(LEN, dx, rd16(snd, 0x26));                                  // 0750:039f (low word)
    this.sf(POS, dx, 0);
    this.sf(PRIO, dx, prio);
    const sn = this._newSoundnum();                                     // 0750:03ba
    this.sf(SN, dx, sn);
    this.sf(FLAGS, dx, 0);
    this.sf(CNT, dx, count);
    if (count === 0) this.sf(FLAGS, dx, this.f(FLAGS, dx) | F_INFINITE); // 0750:03d3
    return this.lastSn;                                                 // 0750:03d8
  }

  // 0750:024d — queue behind active soundnum presnd. Returns presnd / 0 / 1 / 2 / 3.
  _seqPlay(snd, count, prio, presnd) {
    const c = checkDWD(snd); if (c) return c;
    const { seg, off } = this._ptr(snd);
    let dx = 0;
    for (; dx < this.nvoices; dx++) if (this.f(SN, dx) === presnd) break; // 0750:0272
    if (dx >= this.nvoices) return 3;
    this.sf(FLAGS, dx, this.f(FLAGS, dx) | F_SEQUENCED);                // 0750:028d
    let e = 0;
    for (; e < this.nvoices; e++) if (this.f(KEY, e) === presnd) break; // 0750:0292
    if (e >= this.nvoices) {
      for (e = 0; e < this.nvoices; e++) if (this.f(KEY, e) === 0) break; // 0750:02a7
      if (e >= this.nvoices) return 0;
    }
    this.sf(SOFF, e, rd16(snd, 0x2e) + off); this.sf(SSEG, e, seg);     // 0750:02c1..031c
    this.sf(SMAXS, e, rd16(snd, 0x24)); this.sf(SLEN, e, rd16(snd, 0x26));
    this.sf(SPOS, e, 0); this.sf(SPRIO, e, prio); this.sf(KEY, e, presnd);
    this.sf(SFLAGS, e, 0); this.sf(SCNT, e, count);
    if (count === 0) this.sf(SFLAGS, e, F_INFINITE);
    return presnd;
  }

  // 0750:01c1 — slot v's sound ended: switch to its queued sound (same soundnum)
  _seqSwitch(v) {
    const ax = this.f(SN, v);
    for (let e = 0; e < this.nvoices; e++) {
      if (this.f(KEY, e) !== ax) continue;
      this.sf(KEY, e, 0);
      this.sf(PRIO, v, this.f(SPRIO, e));                               // not re-sorted
      this.sf(SFLAGS, e, this.f(SFLAGS, e) | F_AUDIBLE);
      if (!(this.f(FLAGS, v) & F_AUDIBLE)) this.sf(SFLAGS, e, this.f(SFLAGS, e) & 0xbf);
      this.sf(FLAGS, v, this.f(SFLAGS, e));
      this.sf(MAXS, v, this.f(SMAXS, e)); this.sf(OFF, v, this.f(SOFF, e));
      this.sf(SEG, v, this.f(SSEG, e)); this.sf(LEN, v, this.f(SLEN, e));
      this.sf(POS, v, this.f(SPOS, e)); this.sf(CNT, v, this.f(SCNT, e));
      break;
    }
    this.sf(FLAGS, v, this.f(FLAGS, v) & ~F_SEQUENCED);                 // 0750:023d..0242
  }

  // 0750:058d — dynamic-range budget (16-bit running sum of maxsample, limit 0x80)
  _audibility() {
    let ax = 0;
    for (let i = 0; i < this.nvoices; i++) {
      if (!this.f(SN, i)) continue;
      ax = (ax + this.f(MAXS, i)) & 0xffff;                             // 0750:05a5
      if (ax > 0x80) { ax = (ax - this.f(MAXS, i)) & 0xffff; this.sf(FLAGS, i, this.f(FLAGS, i) & 0xbf); }
      else this.sf(FLAGS, i, this.f(FLAGS, i) | F_AUDIBLE);
    }
  }

  // byte add of n sample bytes from seg:si into the DMA half (02f1:0205..029a / 02bf..0354)
  _add(o, seg, si, n) {
    const base = seg * 16;
    for (let i = 0; i < n; i++) this.dma[o + i] = (this.dma[o + i] + this._readLin(base + ((si + i) & 0xffff))) & 0xff;
  }

  // 02f1:012e — mix every slot into half h (which already holds 0x80)
  _mix(h) {
    const B = this.blockSize, hb = h * (this.dma.length >> 1);
    for (let v = 0; v < this.nvoices; v++) {
      if (!this.f(SN, v)) continue;                                     // 02f1:0175
      let o = hb, cx = B;
      for (;;) {
        const fl = this.f(FLAGS, v);                                    // 02f1:0182
        if (!(fl & F_INFINITE) && this.f(CNT, v) === 0) {
          if (!(fl & F_SEQUENCED)) break;
          this._seqSwitch(v); continue;                                 // 02f1:0199
        }
        const pos = this.f(POS, v);
        const si = (this.f(OFF, v) + pos) & 0xffff, dx = (this.f(LEN, v) - pos) & 0xffff, seg = this.f(SEG, v);
        if (cx < dx) {                                                  // 02f1:01e3
          this.sf(POS, v, pos + cx);
          if (fl & F_AUDIBLE) this._add(o, seg, si, cx);
          break;
        }
        this.sf(CNT, v, this.f(CNT, v) - 1); this.sf(POS, v, 0);        // 02f1:01ba / 01cd
        if (cx === dx) { if (fl & F_AUDIBLE) this._add(o, seg, si, cx); break; }
        if (!(fl & F_AUDIBLE)) break;  // QUIRK 02f1:01d7: remaining cx-dx samples not consumed
        cx -= dx;                                                       // 02f1:01de
        this._add(o, seg, si, dx); o += dx;                             // 02f1:02a7..035f
      }
    }
  }

  // 0750:0553 — drop finished voices. QUIRK: no re-check of the slot shifted into cx.
  _cleanup() {
    for (let cx = 0; cx < this.nvoices; cx++) {
      const fl = this.f(FLAGS, cx);
      if (this.f(SN, cx) && !(fl & F_INFINITE) && !(fl & F_SEQUENCED) && this.f(CNT, cx) === 0) this._remove(cx);
    }
  }

  /**
   * One sound-card IRQ (02f1:0478, auto-init DMA path). playingHalf: the half the DMA is in
   * now; with [0x1D]!=0 (default environment) 02f1:04e1..04fd sets [0x120] from the DMA count so
   * that the other half is filled; when undefined, [0x120] is simply toggled (02f1:0448).
   * Returns a copy of the freshly mixed half.
   */
  _isr(playingHalf) {
    if (playingHalf !== undefined) this.ds[HALF] = playingHalf;
    let h = this.ds[HALF] + 1; if (h >= 2) h = 0; this.ds[HALF] = h;  // 02f1:044b..0458
    const half = this.dma.length >> 1, B = this.blockSize;
    this.dma.fill(0x80, h * half, h * half + ((B >> 2) << 2));          // 02f1:0467..0474
    if (this.ds[0x126] !== 1) {                                         // 02f1:0560
      this._audibility();                                               // 0750:058d
      this._mix(h);                                                     // 02f1:012e
      if (this.ds[LEVEL] !== 0xff) {                                    // 02f1:0570
        const n = (B >> 4) << 4;                                        // 02f1:037a
        for (let i = 0; i < n; i++) this.dma[h * half + i] = this.ds[VOLTAB + this.dma[h * half + i]];
      }
      this._cleanup();                                                  // 0750:0553
    }
    return this.dma.slice(h * half, h * half + half);
  }

  // DAC stream: the DMA plays half 0, half 1, half 0, ... The IRQ comes when a half has been
  // played completely (i.e. right after its last byte); its ISR mixes that half, which the DMA
  // plays after the half it has just entered. So a call made after p output bytes is heard from
  // byte (floor(p/B)+2)*B: more than 1 and at most 2 blocks later. After init or DSetRate the
  // first 2 blocks are the buffer's previous contents.
  renderU8(out) {
    const half = this.dma.length >> 1;
    for (let i = 0; i < out.length; i++) {
      out[i] = this.dma[this.dmaPos];
      this.dmaPos = (this.dmaPos + 1) % this.dma.length;
      if (this.dmaPos % half === 0) this._isr(this.dmaPos === 0 ? 0 : 1); // half just finished
    }
    return out;
  }
  render(out) {
    const tmp = this.renderU8(new Uint8Array(out.length));
    for (let i = 0; i < out.length; i++) out[i] = (tmp[i] - 128) / 128;
    return out;
  }
}
