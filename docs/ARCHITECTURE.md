# Architecture

How the port is put together, as of stage 2. For the rules the game code was translated under, see
[PORTING.md](PORTING.md); for what stage 2 changed and how it was verified, see [STAGE2.md](STAGE2.md).

## Start-up

`index.html` loads `src/boot.js`, which:

1. fetches `assets/boot/data_init.bin` (the initialized part of the original data segment) and
   `font8x8.bin` (the BIOS 8×8 font), then every file listed in `assets/boot/manifest.json` from
   `assets/game/` into the virtual DOS file system (`platform/vfs.js`);
2. powers the machine on (`machine.js` `powerOn`: memory image, BIOS tick from the time of day, timer,
   video, mouse, DOS memory);
3. installs the sound layer, then `attachBrowserAudio` (AudioContext, the music recordings);
4. attaches the display (canvas) and the browser input (`pc.attachBrowser`);
5. runs the program (`machine.js` `runProgram`): unpacks `SOUNDS.TGZ`, decodes the PNG pictures, turns the WAVs back into
   DWDs for the sound driver, resets the C runtime's streams, calls `main` (`F.main_1aa02`), then closes
   files; the exit code is `main`'s return value.

The headless runner (`tests/run-headless.mjs`) does the same in Node with a virtual clock.

## Memory and calls (`src/runtime/`)

- `mem.js`: one 8 MB byte array. The original addresses are kept. The data segment and BSS are at
  0x30000..0x667CF (the emulated stack sits at its top, `stack.js`), VGA memory is at 0xA0000, and the
  heap (the C runtime's `malloc`) starts at 0x100000. Game code reads and writes globals through
  `R8/R16/R32/W8/W16/W32` and `RF32/RF64/…` at their original addresses.
- `registry.js`: every translated function is registered under a key `<name>_<address>`, such as `main_1aa02` or
  `PCX_Load_20806`, and calls go through the object `F`, so tests can replace any callee. `callPtr`
  handles the calls the original makes through function pointers stored in memory.
- `cpu.js`: `yieldCpu()`. The original busy-waits on the clock or the keyboard. The port's waiting loops
  call `yieldCpu()` instead, and the host decides what a yield does: the browser sleeps until the next
  timer interrupt or an input event, and the headless runner advances its virtual clock.
  Only the 24 functions that can reach such a loop are `async`.
- `x87.js`: the 80-bit results of FPATAN/FSIN/FCOS, which the game's angle code depends on
  (PORTING.md, "Floating point").
- There is no port/interrupt layer any more: where the original did IN/OUT/INT (palette, retrace, video
  mode, mouse, timer, sound driver), the library calls the device modules directly.

## Game and library code

- `src/game/`: the game's own functions, one file each, named `<address>_<name>.js` (list:
  [FUNCTIONS.md](FUNCTIONS.md)). `main` (0x1aa02) is split into phases in `src/game/1aa02/`. The game's
  data keeps its original addresses, but the code uses names for them from `src/game/data.js`
  ([DATA.md](DATA.md)). The code reads and writes it through typed views from `src/game/access.js`:
  `sprite(choppers, k).y`, `G.score`, `bullet(i).x`, `keyDown(KEY.space)`. Each property reads/writes the
  original address with the original width. State codes are named in `src/game/states.js`
  (`sprite(choppers, k).state === CHOPPER.FLYING_LEFT`), and locals are plain JS variables except where their
  address is passed to a callee.
- `src/lib/`: André LaMothe's graphics and input library as used by the game (PCX loading, sprites,
  palette, double buffer, keyboard driver, mouse wrapper, timer), the DiamondWare sound client
  (`stk_client.js`) and the Watcom C runtime subset (`crt*.js`: file streams on the virtual file system
  with the original text-mode rules, `printf`, heap, `rand`, math, console input).

## Platform (`src/platform/`)

| file | what it is |
|---|---|
| `pc.js` | ties the devices together; `attachBrowser` wires the keyboard, mouse, clock, the idle sleep and the pause while the tab is hidden |
| `pit.js` | 8253 timer: IRQ0 from wall-clock (or virtual) time, the BIOS tick at 0x46C, and the sound driver's 72.8 Hz timer in front of it |
| `kbd.js` | browser key → AT scan-code bytes → the game's key table (while its driver is installed) or the BIOS keyboard buffer |
| `mouse.js` | INT 33h driver over pointer events |
| `vga.js`, `display.js`, `textmode.js` | DAC, retrace, mode set; the picture drawn with WebGL when memory or palette changed (2D canvas fallback); the text screen at exit |
| `vfs.js`, `console.js` | the game's files (writes persist to `localStorage`); the DOS console: BIOS key buffer for `kbhit`/`getch`, `printf` output |
| `images.js`, `png.js` | decode the 8-bit indexed PNGs for `PCX_Load` |
| `sounds.js` | rebuild each `NAME.DWD` from `NAME.WAV` in the DOS file system |

### Sound (`src/platform/sound/`)

- `stkrun.js`: the DiamondWare Sound ToolKit driver (originally `STKRUN.EXE`), reimplemented. The game's
  `dws_*`/`dwt_*` calls (`lib/stk_client.js`) come straight here.
- `digi-mixer.js`: the driver's software mixer for sound effects: 16 voices, priorities, the
  mixing arithmetic as in the original, played on an emulated Sound Blaster DMA at 10989 Hz
  (`soundcard.js`) and resampled into WebAudio (`audio-out.js`, a small AudioWorklet with a 50 ms buffer).
- `dwm-player.js`: the driver's music sequencer. It runs on the timer so that song status and timing are
  exact, but it no longer drives an FM chip. `music-out.js` plays the matching pre-rendered OGG
  (`assets/game/F*.OGG`, rendered offline with the same sequencer and DOSBox's OPL2 emulator) and
  applies the game's music volume.

## Assets (`assets/game/`)

| files | format | used by |
|---|---|---|
| `*.PNG` | 320×200, 8-bit indexed, the original 256-colour palette | `PCX_Load` (the game asks for `name.pcx`) |
| `SOUNDS.TGZ` | the 41 sound effects as 8-bit mono WAVs (10989 Hz) in one gzip-compressed tar (428 KB, one request; unpacked at start-up by `vfs.unpackArchives`) | each `NAME.WAV` is turned into `NAME.DWD` for the sound driver |
| `F*.DWM` | the original DiamondWare music scores | the music sequencer (timing, status) |
| `F*.OGG` | Opus, the scores rendered to audio | music playback |
| `SCORES.DAT` | the original high-score table | read/written by the game (saved in `localStorage`) |

The scripts that converted the original files (`pcx2png.mjs`, `dwd2wav.mjs`, `render-music.mjs`) are
kept in the local, git-ignored `tools/` folder.
