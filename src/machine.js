// The emulated PC running GANJAFRM.EXE, shared by the browser boot (boot.js) and the headless runner
// (test/run-headless.mjs). The host supplies the data image, the ROM font and the files; this module
// powers the machine on and runs the program the way DOS + PMODE/W + the Watcom startup do.
import { loadInitialData, loadRomFont, R32 } from './runtime/mem.js';
import { F } from './runtime/registry.js';
import './game/index.js';
import * as pc from './platform/pc.js';
import * as con from './platform/console.js';
import * as textmode from './platform/textmode.js';
import './lib/index.js';
import { cstart, runInitializers, beforeMain, exit_28bdc } from './lib/crt_startup.js';

// GANJA.BAT is `stkrun ganjafrm`: nothing follows the program name, so the command tail is empty.
// UNCERTAIN: STKRUN.EXE builds the EXEC call; that it passes an empty tail (and the exact path DOS
// records for the program) was not traced in STKRUN (it is packed). Neither is read by the game
// (main never reads argc/argv, MAIN_PLAN.md §1.1).
export const DEFAULT_TAIL = '';
export const DEFAULT_PROGRAM_PATH = 'C:\\GANJA\\GANJAFRM.EXE';
// UNCERTAIN: the environment STKRUN passes on (its own, i.e. COMMAND.COM's) is setup-dependent. Assumed a
// standard MS-DOS 6.22 installation: COMSPEC from COMMAND.COM, then PROMPT/PATH/TEMP as set by the
// AUTOEXEC.BAT that MS-DOS 6.22 Setup writes. No BLASTER variable (consistent with the STKRUN set-up the
// port assumes, platform/sound/stkrun.js). It sizes the environ table (0x2e6c4: two mallocs before
// __InitFiles, so it shifts the heap addresses of everything allocated later) and is scanned for "no87=".
export const DEFAULT_ENV = ['COMSPEC=C:\\COMMAND.COM', 'PROMPT=$p$g', 'PATH=C:\\DOS', 'TEMP=C:\\DOS'];
// UNCERTAIN: DOS version (INT 21h AH=30h at 0x23845 -> [0x31143]/[0x31144]); MS-DOS 6.22 assumed, the same
// DOS the DPMI 0300h services in platform/dpmi.js assume.
export const DEFAULT_DOS_VERSION = [6, 22];

// Power on: memory image, ROM font, BIOS/PIC/PIT/keyboard/VGA/mouse/DPMI reset, STKRUN resident.
//   opts.onStkTick: STK update hook (sound layer) — passed to pc.install
export function powerOn({ dataInit, font, msSinceMidnight, onStkTick } = {}) {
  loadInitialData(dataInit);
  loadRomFont(font);
  pc.install({ onBiosKey: con.push, onStkTick, msSinceMidnight });
  textmode.attachConsole();
}

// Run the program: cstart (0x23820..0x23a20), the CRT initializers (XI table 0x31b9a, run by 0x24fa4 in
// priority order — lib/crt_startup.js runInitializers lists all 16 and what is and is not reproduced),
// 0x24f3b's set-up, main(argc, argv), exit(ret). Returns { exitCode, ret }.
export async function runProgram({ tail = DEFAULT_TAIL, programPath = DEFAULT_PROGRAM_PATH, env = DEFAULT_ENV,
  dosVersion = DEFAULT_DOS_VERSION } = {}) {
  cstart({ tail, env, programPath, dosVersion }); // cstart 0x23820..0x23a20
  runInitializers(env);                    // 0x23a26: 0x24fa4(0xff)
  beforeMain();                            // 0x23a32: 0x24f3b ([0x31128]; 0x28b80 [0x31794])
  // 0x24f7e..0x24f89: EDX = [0x65218] (argv), EAX = [0x65214] (argc); call main 0x1aa02
  const ret = await F.sub_1aa02(R32(0x65214), R32(0x65218));
  // 0x24f8e: call 0x28bdc (exit) with EAX = main's return value
  const exitCode = exit_28bdc(ret);
  return { exitCode, ret };
}

export { pc, con };
