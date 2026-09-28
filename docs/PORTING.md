# Porting rules — Ganja Farmer (GANJAFRM.EXE) → JavaScript

> **Stage 1 rules.** These rules governed the faithful, function-by-function port (git tag `stage1`).
> Since stage 2 the code is being adapted to the browser; see [STAGE2.md](STAGE2.md) for what changed and
> [ARCHITECTURE.md](ARCHITECTURE.md) for the current structure. The memory model, x87 and function rules
> below still describe the translated game code.

The goal is a **faithful** port. The binary is the only source of truth. Nothing may be added, removed,
"fixed", simplified, reordered, or renamed in meaning unless the original code does exactly that.
Original bugs are preserved (mark them `// ORIGINAL BUG:` with an explanation, never fix them).

## Sources of truth (in priority order)
1. Disassembly: `cd re && .venv/bin/python disasm.py <hexaddr> <count>` (capstone, flat image, file offset == address).
2. Ghidra decompilation: `re/decomp/decompiled.c` (search `// ==== 000xxxxx`). Useful but **can be wrong** —
   when the disassembly and the decompiler disagree, the disassembly wins. Check: signedness (movsx/movzx,
   jl/jb, sar/shr, idiv/div), operand sizes (byte/word/dword stores), float ops (x87), loop bounds, `<` vs `<=`.
3. `re/signatures.json` — derived arg counts/returns (`returns` = "some caller reads EAX": a function that
   deliberately sets EAX that no caller reads shows `false` — decide from the callee's own epilogue); `re/NOTES.md`, `re/LIBRARY.md`, `re/names.tsv`.
4. Raw data: `re/unpacked/flat.bin` (strings, tables).
Knowledge of LaMothe's book library, the Watcom CRT or DiamondWare STK may help you *name* things, but
behavior must come from this binary's code — never from memory of how those libraries "usually" work.

## What is ported vs. emulated
- **Ported from the binary, function by function:** all game code (0x10000–0x1E0CF) and the LaMothe graphics /
  input / timer library functions the game uses (see re/LIBRARY.md). Their `in`/`out`/`int` instructions are
  translated to calls into `runtime/io.js` (outb/inb/int86…), never replaced by "what they are for".
- **Emulated as hardware/firmware/OS (src/platform/):** VGA (framebuffer scan-out, DAC ports 0x3C8/0x3C9,
  INT 10h), PIT + BIOS tick counter at 0x46C, keyboard controller (port 0x60, IRQ1 → the game's ported keyboard
  ISR), INT 33h mouse driver, DOS file I/O, and the DiamondWare STK TSR (STKRUN.EXE) — its digitized mixer and
  DWM/OPL2 music are reimplemented from re/digi/ and re/music/ findings.
- **Watcom C runtime** (fopen/fread/fwrite/fclose, malloc/free, printf, iostream, kbhit/getch, rand/srand,
  math, __CHP): implemented once in `src/lib/crt*.js` to the exact behavior of this binary's CRT
  (e.g. text-mode `\n`↔`\r\n`, rand LCG), checked against the disassembly — not ported line by line.
- Dead code (0x114F1 and 0x14593, which Ghidra starts after the `__CHK` prologue at 0x11500/0x145A2; uncalled library routines) is not ported.

## Memory model
`src/runtime/mem.js` is a flat byte array with the **original addresses**:
data/BSS at 0x30000–0x66FFF (initialized from the original image), VGA framebuffer at 0xA0000, heap from 0x100000.
- Globals are accessed by their original address: `R32(0x60a68)`, `W32(0x60a68, v)`.
  Use the width and signedness of the original instruction: `R8/R8s/R16/R16s/R32/R32u`, `W8/W16/W32`,
  `RF32/WF32/RF64/WF64` for x87 float/double memory operands.
- Struct/array element addresses are computed exactly like the original: `W32(0x44010 + i * 0x18c, x)`.
- Pointers are plain numbers (addresses in this space). String literals already exist in the data image —
  pass their address (e.g. `0x3000e`), never a JS string, unless you are inside a platform shim.
- Locals: plain JS `let` variables **unless their address is taken** (passed to a callee, used as an array
  indexed through memory, etc.). Address-taken locals and local arrays/structs must be allocated in emulated
  memory with `stackAlloc(size)` / `stackFree(size)` from `runtime/stack.js` (LIFO, free before every return).
- Integer semantics are C int32: wrap with `| 0` wherever overflow is possible (use `Math.imul` for
  multiplication of values that can exceed 2^31), `>>> 0` for unsigned. Division: `idiv`/`imod` from
  `runtime/cpu.js` (truncate toward zero; `div`-instruction unsigned cases need `>>> 0` first).
  Shifts: `sar` → `>>`, `shr` → `>>>`.
- Floating point: Watcom's FPU init (0x25e4a -> 0x2c640, `fldcw` at 0x2c65d) loads the control word
  [0x31784] = 0x127F: **precision control 53 bits, round to nearest**. So FADD/FSUB/FMUL/FDIV/FDIVR/FSQRT
  results are rounded once to double — plain JS arithmetic on doubles is exact for them (except subnormal
  results, see below), and FLD of float/double/int operands is exact.
  **Exception — values wider than a double:** FPATAN, FSIN and FCOS ignore precision control and leave a
  64-bit mantissa in ST0. The CRT's `atan_st0_23686`, `cos_st0_236cc`, `sin_st0_236d6` therefore return an
  `Ext` (`runtime/x87.js`). Keep such a value as an `Ext` until the original rounds it, and apply the
  original's operations with the x87.js helpers — never with JS operators or `Number(...)`:
  - `fmul/fadd/fsub/fdiv m64 or st(i)` with an Ext operand -> `x87.fmul(a,b)`, `x87.fadd`, `x87.fsub(a,b)` (a-b),
    `x87.fdiv(a,b)` (a/b); FSUBR/FDIVR = swap the operands. They return a JS double (rounded once, PC=53).
  - `fchs` -> `x87.fchs(a)` (stays Ext); comparisons -> `x87.cmp(a,b)`.
  - `fstp qword` -> `x87.toDouble(a)`; `fstp dword` -> `x87.toFloat(a)` (rounds the 64-bit value directly to
    single, not via double); `__CHP` (`F.__CHP_222a4`) accepts an Ext.
  Example (0x11e47..0x11e64): `WF64(..., x87.fmul(F.cos_st0_236cc(ang), RF64(0x30164)))` — `Math.cos(ang) * -5`
  rounds twice and gives -3.0000000000000004 instead of the x87's -3.0 for ratio 4/3.
  Where a value is stored to a `float` (4-byte) memory operand from a double, round with `Math.fround`.
  Note any other place where precision could matter.
  **Last bit of FPATAN/FSIN/FCOS:** real FPUs guarantee an error < 1 ulp of the 64-bit result (Intel SDM
  Vol. 1 §8.3.10; FSIN/FCOS also reduce with a 66-bit pi), not correct rounding, so the hardware last bit
  depends on the CPU. The port uses the correctly rounded 64-bit result (x87.js `atan64/sin64/cos64`). This is
  not game-observable: over all ~238000 reachable inputs of the atan blocks of 0x1977e/0x11c2a, propagating
  both faithful neighbours (and ±32 ulp in cos) changes no integer game state in 0x1977e/0x11c2a/0x12130; only
  the stored doubles 0x61660/0x5ff40/0x5ff48 could differ in the last bit (audit
  `re/audit/round1/F-risky.md` F1; `re/audit/round1/F-risky/x87/sens.mjs`, `sens_wide.mjs`, logs
  `logs/sens_340.log`, `logs/sens_wide_340.log`). Plain 53-bit `Math.atan/cos/sin` would change integer
  positions at 89 of those inputs (the 4:3 ratios, `logs/sens_naive_340.log`), so the Ext model is required.
  **The difftest cannot check this:** unicorn's FPATAN/FSIN/FCOS are 53-bit and wrong on realistic game inputs
  (e.g. 11c2a with q = 88/83, 112/105, 94/91, 99/82 gives the host's `cos(atan2(q,1))*±5`), including the
  integer results at the 4:3 ratios. Differences of 0x1977e/0x11c2a/0x12130 there are the harness's; the
  port's trig paths are instead confirmed by two independent 64-bit models agreeing bit for bit (audit F:
  `x87/prim.mjs` 100000 primitive inputs, `x87/cmp2.mjs` 40000 function runs, 0 differences).
  **Subnormal results (LATENT):** with PC = 53 the x87 rounds to 53 bits with the extended exponent range and
  only `fst m64` denormalizes, so a result below 2^-1022 is rounded twice; JS rounds once, straight to the
  subnormal. The x87.js helpers with an Ext operand reproduce the double rounding; plain JS arithmetic on two
  doubles can differ in the last bit there. Unreachable (game values are ~0.1..400; audit F-risky F4). Sign
  of zero inside an Ext is not kept (LATENT, unreachable — see x87.js header, F-risky F3).

## Functions
- One file per original function in `src/game/` (game code, address < 0x1E0D0) or `src/lib/`
  (library code). File name: `<addr>_<name>.js`, e.g. `1aa02_main.js`, `10676_sub_10676.js`.
- Register with the registry and call other ported functions **only through `F`**:
  ```js
  import { F, register } from '../runtime/registry.js';
  register(0x10676, 'saveHighScores_10676', async function saveHighScores() { ... await F.sub_2264a(0x3000e, 0x3000c); ... });
  ```
  Key: `<name>_<addr>` when the name is established in `re/names.tsv`, else `sub_<addr>`.
- Return values: return a value if the function deliberately sets EAX before RET (e.g. `mov eax,[ebp-x]`).
  If EAX merely holds a leftover (a callee's result, a store side effect) and no caller reads it (check all call
  sites), return nothing and say so in the header. (Fill_Screen 0x20768 predates this rule and returns memset's
  leftover — harmless, no caller reads it.)
- Parameters in the original order (Watcom: EAX, EDX, EBX, ECX, then stack args; cdecl: stack order).
  Return a value only if the original returns one (see signatures.json `returns`, verify in disassembly).
- Game functions are `async`. Inside ANY async function (game or library) **every** call through `F` is `await`ed, whether or not
  the callee is currently async (the difftest cannot detect a missing `await`). Library functions are
  synchronous unless they wait for time/input.
- Busy-wait loops (exit depends on a variable written by an interrupt handler, or on the clock) must contain
  `await yieldCpu()` (from `runtime/cpu.js`) inside the loop body, and the enclosing function is `async`.
- Indirect calls through code addresses stored in memory: `callPtr(addr, ...args)`.
- `__CHK(n)` (stack check, 0x1E0D0) is omitted — it has no effect on program state.

## Interrupts (int86)
- Pass to `int86(num, regs)` every register the original has loaded for the interrupt AND every register that is
  live across the INT and read afterwards (the real service preserves it; the emulated service returns what it
  was given for registers it does not change). Read back only registers/flags (`cf`/`cflag`) the original reads.

## Documentation inside the port
- File header: original address, derived signature, one-line summary of what it does (facts only).
- Keep the original structure: same loops, same order of statements, same conditions. Do not merge,
  hoist, or deduplicate code. Loop counters that live in memory in the original are still just locals
  unless their address is taken.
- Comment unknown globals with their address only; do not invent meanings. A meaning may be stated only
  when evidence is cited (e.g. `// 0x60a68: score — added to on kills in 0x1aa02, saved to scores.dat`).
- Struct field names documented in re/LIBRARY.md ("Structures": sprite, pcx_picture, dws_DPLAY…) may be used in
  comments with the citation `(LIBRARY.md)`; any other meaning needs its own evidence.
- Anything you are unsure about: `// UNCERTAIN: <why>` — never silently guess.

## Verification
Each ported function is checked by an independent verifier agent and, where possible, by differential
testing (`re/difftest/`): the original x86 function runs in an emulator and the JS port runs on the same
initial memory and scripted callee results; memory writes, call sequences (callee + args) and return
values must match exactly.
