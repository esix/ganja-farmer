# Stage 2: from exact port to browser port

Stage 1 ended with a function-by-function, bug-for-bug port, running on emulated DOS hardware
(git tag `stage1`). Stage 2 replaces what only existed because of DOS with plain browser code. The
rule is to keep the game's behaviour and change only what it runs on. Where behaviour does differ,
it is listed below.

## Changes

| area | before (stage 1) | now |
|---|---|---|
| waiting | busy-wait loops yielded thousands of times per tick; a 1 ms timer pumped the PIT (a CPU core at 100%) | a yield sleeps until the next timer interrupt or an input event (`pc.attachBrowser`) |
| display | every animation frame: palette rebuild, 64 000-pixel conversion, a canvas up to 16× the game's size | WebGL, redrawn only when video memory or the palette changed; sharp-bilinear scaling in a shader |
| `async` | every game function `async`, every call awaited | only the 24 functions that can reach a wait |
| pictures | PCX, decoded byte by byte through the emulated C runtime | 8-bit indexed PNG with the same palette, decoded once at start-up; the 5 main-menu frames are one animated PNG (`MAINMENU.PNG`) |
| sound effects | DWD | 8-bit WAVs (same samples) packed in one `SOUNDS.TGZ` (1 MB in 41 files -> 428 KB in one); the DWD bytes are rebuilt in memory for the driver |
| music | DWM scores played live through an OPL2 emulator (WebAssembly) | pre-rendered OGG/Opus; the DWM files are gone: a song clock with each song's length in ticks gives the game the same song status (checked against the sequencer: 180000 random steps, identical) |
| sound driver | 19 client wrappers + 30 helpers copying arguments and sounds into DOS memory and calling INT 60h | `lib/stk_client.js` calls the driver directly with the game's pointers |
| keyboard | 8042 ports, IRQ1 through an emulated PIC, INT 9 vector hooked via the DOS extender | key bytes go straight to the game's key table or the BIOS buffer |
| timer | IRQ0 through the PIC and the extender's vector table | the timer calls its INT 8 chain itself (BIOS tick, sound-driver timer) |
| files | `STKRUN.EXE`, `GANJ5.ICO`, PCX/DWD originals, `viewer.html` | removed; the icon is the favicon |
| C runtime stdio | Watcom FILE structures, buffers and stream lists in emulated memory, DOS handle calls | JS streams on the file system with the same text-mode rules (`\r` dropped on read, 0x1A ends a read, `\n` → `\r\n` on write) |
| start-up | Watcom cstart + 16 initializers (argv, environment, code page, extender set-up) over an emulated PMODE/W | `main` is called directly |
| ports / interrupts | `io.js`: every IN/OUT/INT through a device backend; INT 10h/33h with register blocks in memory | the library calls the VGA, mouse and timer functions directly |
| data names | `R32(0x60a68)`, `W32(0x44010 + i*0x18c, v)` | `G.score`, `sprite(scoreDigits, i).x = v`; named state codes (`CHOPPER.FLYING_LEFT`); [DATA.md](DATA.md) |
| function names | `sub_12130` | `updateBullets` (key `updateBullets_12130`, file `12130_updateBullets.js`); [FUNCTIONS.md](FUNCTIONS.md) |
| locals | whole frames in emulated stack memory | plain JS variables unless their address is passed on |

CPU on the main menu: the tab used more than a full core before; the main thread is now about 97% idle.

## Where behaviour now differs from the original

- **Music** is a recording:
  - Pause/resume continues the recording mid-note. The original driver cut the notes and restarted
    them at their next event.
  - A new song cuts off the previous one's 2-second release tail.
  - The music-volume setting is a gain that follows the loudness the original's operator-level scaling
    produced (measured over all songs, `music-out.js`), not the scaling itself.
- **Audio latency**: sound effects go through a 50 ms buffer (they arrive in bursts, one per timer
  interrupt).
- **Sound client quirks dropped**:
  - The old client's leftover-EAX bug (0x1e5f6) could cancel a sound or song although nothing failed.
    That no longer happens. It never occurred in the scripted tour.
  - Stale scratch bytes it copied back are gone: into `dr+0x32..0x3F` after `dws_DetectHardWare`, and
    into the status word when the driver refused a status call.
  - A playing sound is read from the game's buffer, not from a per-play copy (the game never changes
    a sound while it plays).
- **Unreachable C++ input**: `cin >> char*` throws (its only caller runs when 0x31ee0 is set, which never
  happens).
- **Heap addresses**: without the C runtime's FILE buffers and start-up allocations, heap blocks sit at
  other addresses than in the original. Nothing in the game depends on them (checked with the visible
  trace, below).
- **High-score table with more than 10 records**: the original drew rows 11+ in garbage colours read past its
  local colour table; with locals as JS variables that is not reproduced (the game only writes 9 records).
- **Data the game never reads**: the 128-byte PCX header area in each picture struct is zero, a
  DWD's 4-byte id is zero, and the keyboard driver no longer saves the old INT 9 vector at
  0x64ef8/0x64efc.

Everything else (the game logic, its arithmetic including the x87 corner cases, the timing, the sound
mixing, the song sequencing, the key handling) is still the stage-1 translation.

## Verification

After each step:

1. `npm test`: the unit tests and the function-registry check.
2. `npm run headless`: a scripted tour (logos, menu, play, firing, quit, exit) with a virtual clock.
   Its 12 screenshots were compared byte for byte with the previous version's.
3. **Trace**: `node tests/run-headless.mjs --trace FILE [--trace-skip A-B,…]` writes, every 32
   yields, a hash of game memory (data segment, video memory, first 2 MB of heap; the dead part of
   the stack is left out), a running hash of every byte the sound card's DAC played, and one of every
   register write the music driver made. The run is deterministic, so a change that keeps the game's
   behaviour gives an identical file. For steps that removed a layer, its private variables were
   excluded:
   - `30c60-3108d`: the old sound client's state;
   - `61032-61040`: the stale bytes above;
   - `64ef8-64efe`: the saved INT 9 vector.

   Every stage-2 code step gave an identical trace. The steps that move heap addresses (C runtime stdio,
   start-up) were checked with `--trace-visible` instead: it hashes only what the player perceives,
   i.e. video memory, the palette, the sound output and the music commands, plus every file the game
   writes. Those traces were identical too. The high-score file was checked separately: reading and
   writing `SCORES.DAT` and a file with every byte value give the same bytes as the stage-1 runtime. The asset conversions were checked
   separately:
   - all 39 PNGs give the same pixels, palette and `buf[64000]` as the original PCX loader;
   - all 41 WAVs rebuild their DWD byte for byte (except the id).

4. **Old-vs-new fuzz** (for the readability steps: names, accessors, states, locals): `tools/fuzz-equiv.mjs`
   (local) runs every game function and every phase of `main` 1000 times, on memory snapshots from the tour
   with sprite fields and globals set to the function's own constants and random values, with every callee
   stubbed (seeded return values). Memory writes, the call sequence and return values must match between
   the previous commit and the new code: 54000 runs, identical for each step. It catches rarely reached code
   (it found a precedence bug in the accessor rewrite that the tour hits only once).

Going back: each step is its own commit, so `git revert <commit>` undoes one of them, and
`git checkout stage1` shows the exact port.
