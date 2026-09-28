// The machine running the game, shared by the browser boot (boot.js) and the headless runner
// (tests/run-headless.mjs). The host supplies the data image, the ROM font and the files; this module
// powers the machine on and runs the program.
import { loadInitialData, loadRomFont } from './runtime/mem.js';
import { F } from './runtime/registry.js';
import './game/index.js';
import * as pc from './platform/pc.js';
import * as con from './platform/console.js';
import * as textmode from './platform/textmode.js';
import * as images from './platform/images.js';
import * as sounds from './platform/sounds.js';
import './lib/index.js';
import { crtInit, crtExit } from './lib/crt.js';

// Power on: memory image, ROM font, BIOS tick / timer / keyboard / VGA / mouse reset.
//   opts.onStkTick: STK update hook (sound layer) — passed to pc.install
export function powerOn({ dataInit, font, msSinceMidnight, onStkTick } = {}) {
  loadInitialData(dataInit);
  loadRomFont(font);
  pc.install({ onBiosKey: con.push, onStkTick, msSinceMidnight });
  textmode.attachConsole();
}

// Run the program: prepare the converted assets, then main, then exit. Returns { exitCode, ret }.
// Stage 2: the Watcom start-up (cstart, the 16 CRT initializers: argv, environment, code page, extender
// set-up, iostreams) is gone: main never reads argc/argv (MAIN_PLAN.md §1.1) and nothing the game reads came
// from it (its BSS clear is already done: memory starts zeroed). The exit code is main's return value & 0xFF.
export async function runProgram() {
  await images.decodeAll();                // assets/game/*.PNG for PCX_Load
  sounds.mountAll();                       // assets/game/*.WAV -> *.DWD in the DOS file system
  crtInit();
  const ret = await F.sub_1aa02(0, 0);     // main(argc, argv): both unused
  crtExit();
  return { exitCode: ret & 0xff, ret };
}

export { pc, con };
