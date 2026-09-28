# Port progress

> **Stage 1 record.** Status of the faithful port (git tag `stage1`). Several library layers listed here
> (sound client, keyboard ISR, DPMI services) were replaced in stage 2: see [STAGE2.md](STAGE2.md).

Status: `porting` → `ported` (difftest PASS) → `verified` (independent audit FAITHFUL) / `rework`.

## Infrastructure / one-time RE
| item | status | output |
|---|---|---|
| PMW1 unpack | done | tools/unpmw1.py |
| Ghidra pipeline + signatures | done (fixes: zeroing idiom, 3-op imul, pass-through args, cdecl detection) | re/run_ghidra.sh, re/signatures.py |
| Library identification | done | re/LIBRARY.md, re/names.tsv |
| difftest harness | done (PM selectors, IRETD, arg/ret regs, preserves, CF, fuzz robustness; 130 case files pass; round 3: real x87 callees, FPU CW=0x127F at start (was 0), eventLimit, noFuzzAddrs; known residual: unicorn FPATAN/FSIN/FCOS double-precision → 1-ulp diffs) | re/difftest/ |
| STK digitized mixer RE | verified FAITHFUL for game-reachable behavior (re-audit 738/740 seeds; 2 = unmodelled DDiscardAO stray cells, unreachable) | re/digi/ |
| STK DWM music RE | verified (0 diffs over 79,871 emulated ticks) | re/music/ |
| Watcom CRT subset | core: verified after x87 fix (re-audit FAITHFUL); stdio verified (re/crt_audit, ~1500 op sequences vs original; nits: handle-mode table 0x31694 not in emulated memory, extra IOCTL 4400h skipped; cin dead, printf only literal/%s) | src/lib/crt*.js |
| Platform hardware (VGA/PIT/kbd/mouse/DPMI) | verified FAITHFUL; audit fixes applied (sourced) | src/platform/, re/HARDWARE.md |

## Functions
| addr | name | status | notes |
|---|---|---|---|
| 10010 | sub_10010 | verified | pilot |
| 10676 | sub_10676 | verified | pilot |
| 20ce5 | Sprite_Init | verified | FAITHFUL; nit: field-name comments rely on LIBRARY.md |
| 20c12 | PCX_Get_Sprite | verified | dead load at 0x20c9a omitted |
| 2106f | Behind_Sprite_Clip | verified | no return value (EAX = s is a leftover no caller reads); ORIGINAL BUG: exclusive clips, as 212c0 |
| 211fc | Erase_Sprite_Clip | verified | header comment corrected per audit |
| 212c0 | Draw_Sprite_Clip | verified | ORIGINAL BUG: exclusive left/right, top/bottom clip |
| 221aa | Print_String_DB | verified | |
| 20bd7 | PCX_Copy_To_Buffer | verified | |
| 21531 | Show_Double_Buffer | verified | returns nothing (all 8 callers ignore EAX) |
| 202cd | Print_String | verified | key fixed |
| 220d0 | Print_Char_DB | verified | |
| 201f3 | Print_Char | verified | |
| 20768 | Fill_Screen | verified | |
| 22219 | Write_Pixel_DB | verified | |
| 2225c | Read_Pixel_DB | verified | |
| 20b9b | PCX_Show_Buffer | verified | |
| 20806 | PCX_Load | verified | |
| 20b69 | PCX_Delete | verified | returns nothing |
| 235f9 | Timer_Query | verified | reads dword 0x46C; R32 (signed) per audit; callers must use ((T-start)|0) |
| 207a0 | PCX_Init | verified | returns 0/1 (signatures said void) |
| 232fb | Load_File | verified | ORIGINAL BUG: 16-bit size |
| 2156b | Create_Double_Buffer | verified | returns 0/1; no exit |
| 20404 | Time_Delay | verified | async; no return value (EAX leftover, no caller reads it) |
| 20541 | Write_Color_Reg | verified | |
| 205a8 | Read_Color_Reg | verified | |
| 20618 | Read_Palette | verified | |
| 2069f | Write_Palette | verified | |
| 203c6 | Set_Video_Mode | verified | |
| 21673 | Screen_Transition | verified | async; all 6 effects |
| 22bd7 | Keyboard_Install_Driver | verified | |
| 22c58 | Keyboard_Remove_Driver | verified | |
| 230df | Squeeze_Mouse | verified | 6 commands; returns value |
| 2362c | Timer_Program | verified | called once at exit: (0x40, 0xFFFF) |
| 1ff4f | dwt_Init | verified | TSR mechanism documented in file header |
| 1ffe0 | dwt_Kill | verified | |
| 204b7 | V_Line | verified | for Screen_Transition |
| 21937 | Wait_For_Vertical_Retrace | verified | async, polls 0x3DA |
| 2033c | Write_Pixel | verified | |
| 2044b | H_Line | verified | |
| 22b04 | Keyboard_Driver (ISR) | verified | no chaining; reads 0x60, EOI |
| 1e342 | STK driver-call helper (1 word arg) | verified | thunks via callPtr → regs object (.ecx) |
| 1e309 | STK driver-call helper (no args) | verified | |
| 1e37f | STK driver-call helper (arg block) | verified | | stack args, callee-pop |
| 1e3ba | STK set-error | verified | |
| 1e971 | STK session close | verified |
| 1e8d1 | STK session open | verified | handshake fn 5, AX=0x6969 → 0x0B |
| 1e2f4..1e306 | STK INT thunks (7× int 0x6N; ret) | verified | |
| 1e52c | STK DOS buffer free | verified with documented deviation | failure path of DPMI 0006h uses caller's CX (unreachable) |
| 1e49e | STK DOS buffer alloc | verified | DPMI 0100h/0006h/0600h, 0601h/0101h |
| 1e7b9 | STK lock regions (DPMI 0600h ×2) | verified | |
| 1e808 | STK unlock regions (DPMI 0601h ×2) | verified | |
| 1e56f 1e5c1 | STK free music buffer / free DWD copies | verified | |
| 1e859 | STK vector discovery | verified | |
| 1e597 | STK record music buffer | verified | passes 1e49e regs through |
| 1e705 | STK fill DWD-copy tables | verified | |
| 1eda6 | dws_Kill | verified | |
| 1eed0 | dws_XMusic | verified | returns nothing (LIBRARY.md said 1/0) |
| 1ee3c | dws_XMaster | verified | |
| 1ebe4 | dws_Init | verified | |
| 1ef64 | dws_XDig | verified | |
| 1f3c3 | dws_DSetRate | verified | |
| 1f348 | dws_DSoundStatus | verified | |
| 1ea27 | dws_DetectHardWare | verified | csBase convention applied |
| 1e3c0 | STK result/error helper | verified | |
| 1e7a6 | STK free DOS-buffer arg block | verified | |
| 1e774 | STK alloc DOS-buffer arg block | verified | returns {eax,ecx,edx} |
| 1f1fb | STK DSoundStatus worker | verified | returns value |

## Interrupted by usage limit (to resume)
(all resumed/completed)
| 1fc3f | dws_MSongStatus | verified | |
| 1f5b3 | dws_DGetRateFromDWD | verified | |
| 1f770 | dws_DDiscard | verified | |
| 1faa2 | dws_MPlay | verified | buffer not released (as original) |
| 1eff8 | dws_DPlay | verified | ORIGINAL BUG: reads 1-4 bytes past sound (write stays inside paragraph-rounded block) |
| 1e3d9 | STK DWM header check | verified | |
| 1e43b | STK DWD header check | verified | |
| 1fd9b | STK internal music clear (fn 0x14) | verified | only live caller MPlay (wrapper 0x1fdc6 unreachable) |
| 1e5f6 | STK reclaim finished DWD copies | verified | ORIGINAL BUG: leftover EAX return; size/selector mix-up; ZF leak UNCERTAIN |
| 1f804 | (DDiscardAO?) frees DWD copies by match | not ported: dead | confirmed dead: no rel8/rel32/relocation/raw-dword reference to 0x1f804..0x1f8fe (only hit 0x1f803 is the displacement byte of the live `jmp 0x1f7ef` at 0x1f802) — re/audit/round1/A-coverage/deadcode.txt |
| 1f8fe | uncalled STK API wrapper (`push ds; push eax`, DS/magic check) | not ported: dead | no reference to 0x1f8fe..0x1f98a (A-coverage deadcode.txt) |
| 1e9ad | uncalled STK API wrapper (`push ds; push eax`, cs:[0x30c61] check) | not ported: dead | 0x1e9ad..0x1ea27 follows sub_1e971's `ret` at 0x1e9ac; no reference (A-coverage deadcode.txt) |
| 1f457 | uncalled STK API wrapper (`push ebp`) | not ported: dead | 0x1f457..0x1f5b3; only hit 0x1f456 is inside the live `jmp 0x1f442` at 0x1f455 (A-coverage deadcode.txt) |
| 20069, 200ed, 20171 | uncalled STK API wrappers (DS/magic prologue, error path `mov eax,0x13; call 0x1e3ba`) | not ported: dead | 0x20069..0x201f3; only hit 0x20068 is inside the live `jmp 0x20054` at 0x20067 (A-coverage deadcode.txt) |
| 1fa16 | dws_DUnPause | verified | fn 0x11 |
| 1f98a | dws_DPause | verified | fn 0x10 |
| 1fec3 | dws_MUnPause | verified | fn 0x16 |
| 1fe37 | dws_MPause | verified | fn 0x15 |

## Game code (0x10000–0x1E0CF)
| addr | status | notes |
|---|---|---|
| 10050 | verified | music poller: jump table 0x10278, 12 cases |
| 1352c | verified | sets state 0x26, frame 0, x/y in the 13-sprite ring at 0x34704 (exp2.pcx sprites); no return value |
| 14fba | verified | palette cycling DAC 0xf9-0xfc (no FP: jump-table bytes) |
| 15c34 | verified | sets dword 0x3d220 = 1 |
| 185bf | verified | cloud jitter: 63 sprites at 0x46218, rand() x2 per entry |
| 16b96 | verified | play sound, draw, delay, fade, load blank.pcx |
| 115bc | verified | title screen titp.pcx, 65-tick wait, sound at tick 50 |
| 135bb | verified | 13 sprites at 0x34704 (exp2.pcx): counter → state 1, frame advance, reset |
| 1a825 | verified | writes 0/-70 to 9 stride-0x18c arrays + 4 scalars (meaning not established) |
| 14425 | verified | 26 sprites at 0x3a878: states 0x33/0x29/0x32, counters, DDiscard+DPlay |
| 15788 | verified | digits of [0x60a68]/[0x60a6c]/[0x30bec] via div into 0x18c-stride slots |
| 10767 | verified | reads "scores.dat" entries (0x60a70, stride 0x18) via sub_10010 |
| 1556a | verified | 63 sprites at 0x3de9c: drift x by rand, y+1; hit-test vs 26 sprites at 0x3a878 |
| 159e7 | verified | zeroes stride-0x18c elements / 2 dwords depending on [0x30bec] ranges |
| 16837 | verified | sprite 0x45d74: state 0x20 / approach logic, keyboard moves, 2 hit loops vs 26 sprites, DPlay |
| 16c37 | verified | 455 Erase_Sprite_Clip calls over sprite arrays (no args) |
| 16446 | verified | switch on [0x30bec] → [0x5fbe0]; sprite 0x45d74 states 0x1b/0x1c; jump-table case sounds/score |
| 15127 | verified (after fix: re-read [0x60bac] per store) | 3 sprites at 0x3d86c: move/re-randomize, state 0x2d spawns into 0x3de9c ring [0x60bac] |
| 1864d | verified | sprite 0x4608c hit tests vs 0x33f48/0x3d86c/0x3d0b0/0x5fc04; 0x45f00 from 0x33dbc; switch curr_frame |
| 18a58 | verified | sprite 0x4c38c state machine on [0x4c4fc], DAC 0xa5 random colour, nearest-target loop, sounds |
| 16fbb | verified | sprites 0x5fc04/0x5fd90 states 0x44-0x46, palette fade up/down (ORIGINAL BUG: dead <0 clamp) |
| 11c2a | verified | fills first free entry of table 0x5ff20 (stride 0x30) from sprite positions incl. atan/cos/sin; 18 cases pass |
| 102d1 | verified (residual: 0/0 NaN sign is host-dependent in JS; unreachable, divisor 0x30004 = 20.0 is never written) | show PCX (file,delay,effect) with 20-step palette fade-in via __CHP/fistp; 8 cases pass on patched harness copy |
| 10b7d | verified | pause screen: DPause/MPause, 2 strings, wait Enter or Space, unpause |
| 10c0b | verified | quit prompt: pause, 2 strings, wait keyboard_state[0x15]/[0x31], [0x30be4]=0x1c on Y, unpause |
| 10cac | verified | mouse-driven loop: 3 sliders → dws_XDig/XMusic/XMaster, toggle [0x30c20], exit Esc/Space/button/box |
| 107ce | verified | draws "scores.dat" table: per entry sub_15788 digits, sprite rows, Print_String_DB (ORIGINAL BUG: unbounded loop) |
| 12e85 | verified | chopper2/ptroop sprite logic, sounds, rand; ORIGINAL BUG: reads entry 25 of 25-entry array (0x131e7) |
| 1977e | verified | up to 3 free entries of 0x4c518 (199) get velocity from atan\/cos\/sin toward 0x33aa4 and pos from 0x33dbc; 12 cases pass, fuzz blocked by harness stubbing x87 callees |
| 1098f | verified | new-top-score entry: scan 9 scores, name input via kbhit/getch, save (sub_10676), DPlay |
| 136a5 | verified | state machine over 25 ptroop/pt2 sprites + 26 plant sprites, table 0x5ff20, sounds, sub_1352c |
| 14c6a | verified | 4 sprites at 0x3d23c (bomb.pcx): fall, y>=0xa0 → sub_1352c + sound, overlap vs 26 sprites at 0x3a878 |
| 1128e | verified | hiscore.pcx + sub_107ce table, sprite 0x45d74 bounces 301 frames or until Space (after 10), Fill_Screen(0) |
| 12130 | verified | colour-0xe0 checks, x87 (__CHP/fistp), hit tests vs 5 sprite groups, burst loops calling sub_1352c |
| 173a2 | verified | sprite 0x45f00/0x4608c logic, jump table on [0x46068], hit tests vs 8 groups, sub_1352c + sounds |
| 19ade | verified | 200 entries of 0x4c518 vs 8 sprite groups: overlap tests, counters, sounds, sub_1352c |
| 11659 | verified | mouse-driven menu loop: 4 rectangles, calls sub_10cac/sub_1128e, palette save/restore, 2 wait loops |
| 18f27 | verified | colour reg 0xb6, sounds, rand, calls sub_11c2a/sub_1864d/sub_1977e by state of 0x33dbc |
| 15e15 | verified | loop while [0x30bf4]==0x22: per-frame calls (16c37,18f27,15788,16837,14425,…), clock wait, run scan |
| 15c7d | verified | dec [0x30bf0]; scans 6 lists (a subset of those 1a825 zeroes); calls sub_1a825 / sub_15e15 |
| 14690 | verified | sprites 0x3d0b0 / 0x3d23c[[0x60b9c]]: moves, bounds, rand-driven state changes |
| 1aa02 | verified: all 11 chunks (region difftests + independent audits) + skeleton; whole-function integration difftest 14/14 PASS (re/difftest/cases/1aa02.json) | main |
| STK service + audio output | verified (independent audit: faithful for the assumed SB 2.0/OPL2 setup; nits host-output only; OPL2 = DOSBox DBOPL via @malvineous/opl, GPL — accepted by user 2026-09-26, port is GPL-3.0) | src/platform/sound/, tests/stk.test.mjs |
| Boot wiring + headless runner | verified after audit fixes (PMODE/W v1.31 GDT selector allocation from its source, all 16 CRT initializers run or documented, kbd pumps PIT first, loader retries); machine.js: cstart argv 0x23956/0x25ec9/0x25fab -> main(argc,argv) -> exit 0x28bdc; boot.js DOM input + real-time PIT + sound; textmode.js TTY/scan-out for the exit text; test/run-headless.mjs virtual clock, PNG snapshots, scripted input; full tour logos->menu->play->quit->exit runs; dpmi.js selector reuse fix) | src/machine.js, src/boot.js, tests/run-headless.mjs |
| difftest harness memory | fixed 2026-09-28: fuzz variants were all kept in memory (8 MB initial-memory copy + event log each) → tens of GB at --fuzz 1000; now compared and dropped per batch of JS_BATCH (identical results; 300 variants of 102d1: 1.6 GB peak). Audits must use re/audit/memwatch.sh (see re/audit/AUDIT_COMMON.md) | re/difftest/run.py |
