// Chunk S1 of main (0x1aa02): range [0x1e018, 0x1e0be), straight line (no branches, no loops).
// Entry 0x1e018 (SHUTDOWN, reached from the skeleton when [0x30be4] == 0x25), single exit 0x1e0be
// (the epilogue `xor eax,eax; ... ret`, which stays in the skeleton).
// No live registers/locals at either end (MAIN_PLAN.md §2); uses no frame slot.
// Callees: Timer_Program 0x2362c (Watcom EAX=port, EDX=rate), Set_Video_Mode 0x203c6 (Watcom EAX=mode),
//          Keyboard_Remove_Driver 0x22c58 (no args), printf 0x23783 x9 (cdecl, 1 pushed arg, `add esp, 4`),
//          dwt_Kill 0x1ffe0, dws_Kill 0x1eda6 (no args). No callee result (EAX) is read.
// String arguments: address, text, and the bytes read from re/unpacked/flat.bin (NUL included).
// Each line cites the instruction(s) it comes from.
import { F } from '../../runtime/registry.js';

export function shutdown() {
  F.Timer_Program_2362c(0x40, 0xffff);                                                  // 1e018..1e022
  F.Set_Video_Mode_203c6(3);                                                            // 1e027..1e02c
  F.Keyboard_Remove_Driver_22c58();                                                     // 1e031
  // 0x30493 "This version of GANJA FARMER " (trailing space, no \n)
  //   bytes 546869732076657273696f6e206f662047414e4a41204641524d45522000
  F.printf_23783(0x30493);                                                              // 1e036..1e041
  // 0x304b1 "is registered.\n  It is a violation of copyright law to distribute this software.\n"
  //   bytes 697320726567697374657265642e0a2020497420697320612076696f6c6174696f6e206f6620
  //         636f70797269676874206c617720746f2064697374726962757465207468697320736f6674
  //         776172652e0a00
  F.printf_23783(0x304b1);                                                              // 1e044..1e04f
  // 0x30503 "This offense is punishable by DEATH... and you'll go to hell too!  \n" (two spaces before \n)
  //   bytes 54686973206f6666656e73652069732070756e69736861626c652062792044454154482e2e2e
  //         20616e6420796f75276c6c20676f20746f2068656c6c20746f6f2120200a00
  F.printf_23783(0x30503);                                                              // 1e052..1e05d
  // 0x30548 "GANJA FARMER  " (two trailing spaces, no \n)  bytes 47414e4a41204641524d4552202000
  F.printf_23783(0x30548);                                                              // 1e060..1e06b
  // 0x30557 "Copyright 1998 Jason Pitt, EvilX Systems and Xtreme Games LLC\n"
  //   bytes 436f707972696768742031393938204a61736f6e20506974742c204576696c582053797374656d
  //         7320616e6420587472656d652047616d6573204c4c430a00
  F.printf_23783(0x30557);                                                              // 1e06e..1e079
  // 0x30596 "All Rights Reserved\n"  bytes 416c6c205269676874732052657365727665640a00
  F.printf_23783(0x30596);                                                              // 1e07c..1e087
  // 0x305ab "Do NOT Distribute!\n\n"  bytes 446f204e4f542044697374726962757465210a0a00
  F.printf_23783(0x305ab);                                                              // 1e08a..1e095
  F.dwt_Kill_1ffe0();                                                                   // 1e098
  F.dws_Kill_1eda6();                                                                   // 1e09d
  // 0x305c0 "shutdown normal\n"  bytes 73687574646f776e206e6f726d616c0a00
  F.printf_23783(0x305c0);                                                              // 1e0a2..1e0ad
  // 0x305d1 "Later..\n"  bytes 4c617465722e2e0a00
  F.printf_23783(0x305d1);                                                              // 1e0b0..1e0bb
  // falls through to 0x1e0be (epilogue, in the skeleton)
}
