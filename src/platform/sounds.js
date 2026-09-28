// The game's sound effects: assets/game/*.WAV (8-bit mono PCM, converted from the original DiamondWare .DWD
// files). The program loads "click.dwd" etc. with Load_File and hands the bytes to the STK driver, so at
// start-up every NAME.WAV is turned back into NAME.DWD in the DOS file system (vfs), byte for byte what the
// original file held except the 4-byte id at +0x1A, which nothing reads (re/digi/DIGI.md §1).
//
// DWD layout (all 41 original files): 0x38-byte header, then the samples, signed 8-bit.
//   +0x00 "DiamondWare Digitized\n\0\x1a"   +0x18 version 1, 0 (checked by the driver)
//   +0x1A dword id (0 here)                 +0x1E word 0
//   +0x20 word rate    +0x22 byte channels 1   +0x23 byte bits 8
//   +0x24 word maxsample = max |sample| (the driver's mixing budget)
//   +0x26 dword length   +0x2A dword length again   +0x2E dword data offset 0x38   +0x32..0x37 zero
// WAV 8-bit PCM is unsigned (silence 0x80), DWD is signed: sample = byte ^ 0x80 either way.
import * as vfs from './vfs.js';

const MAGIC = 'DiamondWare Digitized\n\0\x1a\x01\x00';
const HEADER = 0x38;

export function wavToDwd(bytes, name = 'WAV') {
  const fail = (why) => { throw new Error(`${name}: ${why}`); };
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (p) => String.fromCharCode(bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]);
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') fail('not a WAV file');
  let rate = 0, samples = null;
  for (let p = 12; p + 8 <= bytes.length;) {
    const id = tag(p), len = dv.getUint32(p + 4, true);
    if (id === 'fmt ') {
      const format = dv.getUint16(p + 8, true), channels = dv.getUint16(p + 10, true), bits = dv.getUint16(p + 22, true);
      if (format !== 1 || channels !== 1 || bits !== 8) fail(`must be 8-bit mono PCM, got format ${format}, ${channels} channel(s), ${bits} bits`);
      rate = dv.getUint32(p + 12, true);
    } else if (id === 'data') {
      samples = bytes.subarray(p + 8, p + 8 + len);
    }
    p += 8 + len + (len & 1);
  }
  if (!rate || !samples) fail('missing fmt or data chunk');
  if (samples.length > 0xffff) fail('longer than 65535 samples (the STK plays only the low 16 bits of the length)');

  const out = new Uint8Array(HEADER + samples.length);
  const o = new DataView(out.buffer);
  for (let i = 0; i < MAGIC.length; i++) out[i] = MAGIC.charCodeAt(i);
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i] ^ 0x80;
    out[HEADER + i] = s;
    const m = Math.abs((s << 24) >> 24);
    if (m > peak) peak = m;
  }
  o.setUint16(0x20, rate, true);
  out[0x22] = 1; out[0x23] = 8;
  o.setUint16(0x24, peak, true);
  o.setUint32(0x26, samples.length, true);
  o.setUint32(0x2a, samples.length, true);
  o.setUint32(0x2e, HEADER, true);
  return out;
}

// NAME.WAV -> NAME.DWD for every WAV in the file system.
export function mountAll() {
  for (const n of vfs.names()) {
    if (/\.WAV$/i.test(n)) vfs.mountBytes(n.replace(/\.WAV$/i, '.DWD'), wavToDwd(vfs.read(n), n));
  }
}
