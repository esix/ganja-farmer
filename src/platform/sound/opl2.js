// OPL2 (YM3812) chip emulator for the sound card: DOSBox's DBOPL, as compiled to WebAssembly by
// the npm package @malvineous/opl 1.0.0 ("opljs").
//
// PROVENANCE / LICENCE (vendor/opljs/, files copied unmodified from the npm tarball
//   https://registry.npmjs.org/@malvineous/opl/-/opl-1.0.0.tgz, sha256 8487ea8d83a2ddb9e3342b27dc18945e3822df0e8c1e6cc2e896062ac101a036):
//   opl.js   (Emscripten loader, sha256 85fb5a8c2edc970f88ddb1fc4d362991ebedb00b27412c2849059e7342efa5f4)
//   opl.wasm (sha256 487d3c9bb59efcc35c10338b81e56dd816af4ec0ed35adafb0a66b9d6ee3b49a)
//   src/     the C++ sources the two files were built from (dbopl.cpp/.h: "Copyright (C) 2002-2015 The
//            DOSBox Team", GPL-2.0-or-later; index.cpp: wrapper, Copyright (C) 2010-2018 Adam Nielsen,
//            GPL-3.0-or-later), index.js/README.md/package.json (upstream wrapper and metadata, GPL-3.0).
//   Upstream: https://github.com/Malvineous/opljs . The combined work is GPL-3.0-or-later: distributing
//   the port together with it puts the distribution under the GPL-3.0.
// Why this emulator: PLAYER.md §6 asks for an OPL2 core with rhythm mode, waveform select and an exact
//   envelope generator; no OPL emulator existed in the repository, and DBOPL (DOSBox's default OPL
//   core, derived from MAME's but not the old "compat" fmopl) is the one available as a ready JS/WASM
//   build. Only OPL2 registers are written by the driver (PLAYER.md §4.1: never 0x105), so it runs in
//   OPL2 mode. This file is only a loader; the synthesis is the vendored code.
//
// The Emscripten loader is a sloppy-mode UMD script, so it is evaluated with Function (not imported
// as an ES module); the .wasm is handed to it as `wasmBinary` so that no environment-specific file
// loading is needed (browser: fetch; Node: fs).
import { OPL_HZ } from './soundcard.js';

const BASE = new URL('./vendor/opljs/', import.meta.url);

async function readVendor(name, text) {
  if (typeof process !== 'undefined' && process.versions && process.versions.node && BASE.protocol === 'file:') {
    const { readFile } = await import('node:fs/promises');
    return text ? readFile(new URL(name, BASE), 'utf8') : new Uint8Array(await readFile(new URL(name, BASE)));
  }
  const r = await fetch(new URL(name, BASE));
  if (!r.ok) throw new Error('opl2: cannot load ' + name);
  return text ? r.text() : new Uint8Array(await r.arrayBuffer());
}

// Returns { write(reg, val), generate(n) -> Int16Array (n mono samples, 2 <= n <= 512; the view is
// reused by the next call) } running at OPL_HZ.
export async function createOpl2() {
  const [src, wasmBinary] = await Promise.all([readVendor('opl.js', true), readVendor('opl.wasm', false)]);
  // eslint-disable-next-line no-new-func
  const factory = new Function('module', 'exports', 'define', src + '\n;return opl;')();
  // The Emscripten Module object is a thenable whose then() resolves with itself; wrap it so the
  // promise does not try to adopt it again.
  const { mod: M } = await new Promise((resolve) => {
    factory({ wasmBinary, print() {}, printErr() {} }).then((mod) => resolve({ mod }));
  });
  const chip = new M.OPL(Math.round(OPL_HZ), 1, 1024); // DBOPL::Handler::Init(49716), mono
  const buf = chip.getBuffer();                        // Int16Array view on the WASM heap
  return {
    write(reg, val) { chip.write(reg & 0x1ff, val & 0xff); },
    generate(n) { chip.generate(n); return buf.subarray(0, n); },
  };
}
