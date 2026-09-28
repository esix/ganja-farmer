// main (0x1aa02) chunk G2: range [0x1d630, 0x1db3a)
// Entry 0x1d630, single exit 0x1db3a (falls through to chunk G3, chunk_1db3a).
// No live registers/locals at either end (MAIN_PLAN.md §2). Local: [ebp-8] (chunk-local let).
// Contents: 18 unconditional game calls (0x1d630..0x1d685); stores to [0x30bec] under keyboard_state tests
// (0x64f04 = keyboard_state[128], int32 per make scancode, LIBRARY.md), five of them followed by sub_15c34;
// sub_159e7; conditional toggles/stores of [0x60edc] depending on [0x60ee8] / [0x60edc] / [0x60b50];
// Behind_Sprite_Clip(sprite, [0x64e7c]) on single sprites and in 14 counted loops (stride 0x18c);
// two conditional Draw_Sprite_Clip(sprite, [0x64e7c], 1).
// Callees: sub_18f27, sub_16446, sub_12130, sub_16fbb, sub_12e85, sub_136a5, sub_135bb, sub_14690, sub_14c6a,
// sub_14425, sub_15127, sub_1556a, sub_15788, sub_173a2, sub_185bf, sub_19ade, sub_18a58, sub_14fba,
// sub_15c34 x5, sub_159e7 (all: no args, no return value used), Behind_Sprite_Clip_2106f (EAX sprite,
// EDX buffer) 26 call sites, Draw_Sprite_Clip_212c0 (EAX sprite, EDX buffer, EBX transparent) 2 call sites.
// 0x64e7c = double_buffer (LIBRARY.md "Key globals"); it is re-read before every call as in the binary.
// The `mov eax,[ebp-8]` before every `inc [ebp-8]` is a dead read and produces nothing.
import { F } from '../../runtime/registry.js';
import { R32, W32 } from '../../runtime/mem.js';

export function chunk_1d630() {
  let i; // [ebp-8]

  F.sub_18f27();                                           // 1d630
  F.sub_16446();                                           // 1d635
  F.sub_12130();                                           // 1d63a
  F.sub_16fbb();                                           // 1d63f
  F.sub_12e85();                                           // 1d644
  F.sub_136a5();                                           // 1d649
  F.sub_135bb();                                           // 1d64e
  F.sub_14690();                                           // 1d653
  F.sub_14c6a();                                           // 1d658
  F.sub_14425();                                           // 1d65d
  F.sub_15127();                                           // 1d662
  F.sub_1556a();                                           // 1d667
  F.sub_15788();                                           // 1d66c
  F.sub_173a2();                                           // 1d671
  F.sub_185bf();                                           // 1d676
  F.sub_19ade();                                           // 1d67b
  F.sub_18a58();                                           // 1d680
  F.sub_14fba();                                           // 1d685

  // keyboard_state[scancode] tests (address = 0x64f04 + scancode*4)
  if (R32(0x64f7c) !== 0) {                                      // 1d68a..1d691 keyboard_state[0x1e]
    W32(0x30bec, 0xe);                                           // 1d693
  }
  if (R32(0x64f14) !== 0) {                                      // 1d69d..1d6a4 keyboard_state[0x04]
    W32(0x30bec, 3);                                             // 1d6a6
  }
  if (R32(0x64f1c) !== 0) {                                      // 1d6b0..1d6b7 keyboard_state[0x06]
    W32(0x30bec, 5);                                             // 1d6b9
    F.sub_15c34();                                         // 1d6c3
  }
  if (R32(0x64f20) !== 0) {                                      // 1d6c8..1d6cf keyboard_state[0x07]
    W32(0x30bec, 6);                                             // 1d6d1
    F.sub_15c34();                                         // 1d6db
  }
  if (R32(0x64f24) !== 0) {                                      // 1d6e0..1d6e7 keyboard_state[0x08]
    W32(0x30bec, 7);                                             // 1d6e9
    F.sub_15c34();                                         // 1d6f3
  }
  if (R32(0x64f28) !== 0) {                                      // 1d6f8..1d6ff keyboard_state[0x09]
    W32(0x30bec, 8);                                             // 1d701
    F.sub_15c34();                                         // 1d70b
  }
  if (R32(0x64f2c) !== 0) {                                      // 1d710..1d717 keyboard_state[0x0a]
    W32(0x30bec, 9);                                             // 1d719
    F.sub_15c34();                                         // 1d723
  }
  F.sub_159e7();                                           // 1d728

  // 1d72d..1d748: ([0x60ee8] == 0x37 || [0x60ee8] == 0x38 || [0x60ee8] == 0x35) -> 1d74a, else -> 1d769
  // ([0x60ee8] is re-read from memory by each cmp)
  if (R32(0x60ee8) === 0x37 || R32(0x60ee8) === 0x38 || R32(0x60ee8) === 0x35) {
    if (R32(0x60edc) === 1) {                                    // 1d74a..1d751
      W32(0x60edc, 0);                                           // 1d753 (jmp 1d769)
    } else {
      W32(0x60edc, 1);                                           // 1d75f
    }
  }
  // 1d769..1d786: if [0x60ee8] == 0x36: [0x60edc] != 0 -> skip (1d784 jmp 1d790);
  //               else [0x60b50] == 1 -> skip; else [0x60edc] = 1
  if (R32(0x60ee8) === 0x36) {                                   // 1d769..1d770
    if (!(R32(0x60edc) !== 0 || R32(0x60b50) === 1)) {           // 1d772..1d782
      W32(0x60edc, 1);                                           // 1d786
    }
  }

  F.Behind_Sprite_Clip_2106f(0x33c30, R32(0x64e7c));       // 1d790..1d79b
  F.Behind_Sprite_Clip_2106f(0x5fc04, R32(0x64e7c));       // 1d7a0..1d7ab
  for (i = 0; i < 4; i++) {                                      // 1d7b0..1d7c3, 1d7de
    F.Behind_Sprite_Clip_2106f((Math.imul(i, 0x18c) + 0x3d23c) | 0, R32(0x64e7c)); // 1d7c5..1d7d9
  }
  for (i = 0; i < 5; i++) {                                      // 1d7e0..1d7f3, 1d80e
    F.Behind_Sprite_Clip_2106f((Math.imul(i, 0x18c) + 0x33f48) | 0, R32(0x64e7c)); // 1d7f5..1d809
  }
  for (i = 0; i < 3; i++) {                                      // 1d810..1d823, 1d83e
    F.Behind_Sprite_Clip_2106f((Math.imul(i, 0x18c) + 0x3d86c) | 0, R32(0x64e7c)); // 1d825..1d839
  }
  for (i = 0; i < 0x3f; i++) {                                   // 1d840..1d853, 1d86e
    F.Behind_Sprite_Clip_2106f((Math.imul(i, 0x18c) + 0x3de9c) | 0, R32(0x64e7c)); // 1d855..1d869
  }
  for (i = 0; i < 0x3f; i++) {                                   // 1d870..1d883, 1d89e
    F.Behind_Sprite_Clip_2106f((Math.imul(i, 0x18c) + 0x46218) | 0, R32(0x64e7c)); // 1d885..1d899
  }
  for (i = 0; i < 0xc8; i++) {                                   // 1d8a0..1d8b6, 1d8d1
    F.Behind_Sprite_Clip_2106f((Math.imul(i, 0x18c) + 0x4c518) | 0, R32(0x64e7c)); // 1d8b8..1d8cc
  }
  for (i = 0; i < 1; i++) {                                      // 1d8d3..1d8e6, 1d901
    F.Behind_Sprite_Clip_2106f((Math.imul(i, 0x18c) + 0x3d0b0) | 0, R32(0x64e7c)); // 1d8e8..1d8fc
  }
  F.Behind_Sprite_Clip_2106f(0x45f00, R32(0x64e7c));       // 1d903..1d90e
  F.Behind_Sprite_Clip_2106f(0x4608c, R32(0x64e7c));       // 1d913..1d91e
  F.Behind_Sprite_Clip_2106f(0x4c38c, R32(0x64e7c));       // 1d923..1d92e
  F.Behind_Sprite_Clip_2106f(0x5fa78, R32(0x64e7c));       // 1d933..1d93e
  for (i = 0; i < 0x1a; i++) {                                   // 1d943..1d956, 1d971
    F.Behind_Sprite_Clip_2106f((Math.imul(i, 0x18c) + 0x3a878) | 0, R32(0x64e7c)); // 1d958..1d96c
  }
  F.Behind_Sprite_Clip_2106f(0x45d74, R32(0x64e7c));       // 1d973..1d97e
  for (i = 0; i < 0x19; i++) {                                   // 1d983..1d996, 1d9b1
    F.Behind_Sprite_Clip_2106f((Math.imul(i, 0x18c) + 0x35b20) | 0, R32(0x64e7c)); // 1d998..1d9ac
  }
  for (i = 0; i < 0x19; i++) {                                   // 1d9b3..1d9c6, 1d9e1
    F.Behind_Sprite_Clip_2106f((Math.imul(i, 0x18c) + 0x381cc) | 0, R32(0x64e7c)); // 1d9c8..1d9dc
  }
  for (i = 0; i < 0xd; i++) {                                    // 1d9e3..1d9f6, 1da11
    F.Behind_Sprite_Clip_2106f((Math.imul(i, 0x18c) + 0x34704) | 0, R32(0x64e7c)); // 1d9f8..1da0c
  }
  F.Behind_Sprite_Clip_2106f(0x33dbc, R32(0x64e7c));       // 1da13..1da1e
  F.Behind_Sprite_Clip_2106f(0x3dd10, R32(0x64e7c));       // 1da23..1da2e
  for (i = 0; i < 7; i++) {                                      // 1da33..1da46, 1da61
    F.Behind_Sprite_Clip_2106f((Math.imul(i, 0x18c) + 0x44010) | 0, R32(0x64e7c)); // 1da48..1da5c
  }
  for (i = 0; i < 5; i++) {                                      // 1da63..1da76, 1da91
    F.Behind_Sprite_Clip_2106f((Math.imul(i, 0x18c) + 0x44ae4) | 0, R32(0x64e7c)); // 1da78..1da8c
  }
  for (i = 0; i < 3; i++) {                                      // 1da93..1daa6, 1dac1
    F.Behind_Sprite_Clip_2106f((Math.imul(i, 0x18c) + 0x452a0) | 0, R32(0x64e7c)); // 1daa8..1dabc
  }
  F.Behind_Sprite_Clip_2106f(0x33aa4, R32(0x64e7c));       // 1dac3..1dace
  F.Behind_Sprite_Clip_2106f(0x33918, R32(0x64e7c));       // 1dad3..1dade
  F.Behind_Sprite_Clip_2106f(0x5fd90, R32(0x64e7c));       // 1dae3..1daee

  // 1daf3..1db05: [0x5fd74] (= 0x5fc04 + 0x170, sprite `state`, LIBRARY.md) == 0 or == 0x44 -> skip to 1db1c
  if (!(R32(0x5fd74) === 0 || R32(0x5fd74) === 0x44)) {
    F.Draw_Sprite_Clip_212c0(0x5fc04, R32(0x64e7c), 1);    // 1db07..1db17
  }
  // 1db1c..1db23: [0x5ff00] (= 0x5fd90 + 0x170, sprite `state`, LIBRARY.md) != 1 -> exit 1db3a
  if (R32(0x5ff00) === 1) {
    F.Draw_Sprite_Clip_212c0(0x5fd90, R32(0x64e7c), 1);    // 1db25..1db35
  }
}
