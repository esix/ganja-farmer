// 0x159e7  void sub_159e7(void)   [Watcom, no args, no return value]
// Args: none (no register is read before being written; signature FUN_000159e7(void), functions.tsv).
// Return: none — EAX at the RET (0x15c33) is a leftover of a loop (`mov eax,[ebp-4]` / `imul`) or of
// `mov eax,[0x30bec]`; nothing sets it deliberately.
// No calls. Depending on the signed dword [0x30bec] (re-read at every test, as the original does), it stores 0
// into dword elements of stride 0x18c (the sprite struct size, LIBRARY.md; no field meaning is claimed here) at
// 0x3d220 (1 element), 0x340b8 (5 elements), 0x3d9dc (3 elements), and into the dwords 0x4c4fc and 0x5fd74:
//   v <  5         : 0x3d220[0]; 0x340b8[v..4]; 0x3d9dc[0..2]
//   5 <= v, v-5<6  : 0x340b8[v-5..4]; 0x3d9dc[0..2]
//   11 <= v < 14   : 0x3d9dc[v-10..2]; 0x340b8[1..4]
//   14 <= v < 19   : 0x340b8[v-13..4]
//   v < 19         : [0x4c4fc] = 0
//   v < 25         : [0x5fd74] = 0
//   18 < v < 24    : 0x340b8[v-18..4]; 0x3d9dc[v-18..2]
// All comparisons are signed (jge/jl/jle). Element address = base + imul(i, 0x18c), 32-bit wrap (>>> 0).
import { register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';
import { SPRITE, a10Jets, choppers, cropDusters, cruiseMissile, level, ufo } from './data.js';

const A = (base, i) => (base + Math.imul(i, SPRITE.SIZE)) >>> 0; // `imul eax,[ebp-4],0x18c; mov [eax+base], 0`

register(0x159e7, 'sub_159e7', function sub_159e7() {
  let i; // [ebp-4]

  // 159ff: cmp [0x30bec],5; jge 15a85
  if ((R32(level) | 0) < 5) {
    for (i = 0; i < 1; i++) W32(A((a10Jets + SPRITE.state), i), 0);                 // 15a0c..15a32
    for (i = R32(level) | 0; i < 5; i++) W32(A((choppers + SPRITE.state), i), 0);  // 15a34..15a5b
    for (i = 0; i < 3; i++) W32(A((cropDusters + SPRITE.state), i), 0);                 // 15a5d..15a83
  }

  // 15a85: cmp [0x30bec],5; jl skip; eax=[0x30bec]-5; cmp eax,6; jl body (else 15af1)
  if ((R32(level) | 0) >= 5 && ((R32(level) - 5) | 0) < 6) {
    for (i = (R32(level) - 5) | 0; i < 5; i++) W32(A((choppers + SPRITE.state), i), 0); // 15a9d..15ac7
    for (i = 0; i < 3; i++) W32(A((cropDusters + SPRITE.state), i), 0);                       // 15ac9..15aef
  }

  // 15af1: cmp [0x30bec],0xb; jl skip; cmp [0x30bec],0xe; jl body (else 15b59)
  if ((R32(level) | 0) >= 0xb && (R32(level) | 0) < 0xe) {
    for (i = (R32(level) - 0xa) | 0; i < 3; i++) W32(A((cropDusters + SPRITE.state), i), 0); // 15b05..15b2f
    for (i = 1; i < 5; i++) W32(A((choppers + SPRITE.state), i), 0);                        // 15b31..15b57
  }

  // 15b59: cmp [0x30bec],0xe; jl skip; cmp [0x30bec],0x13; jl body (else 15b99)
  if ((R32(level) | 0) >= 0xe && (R32(level) | 0) < 0x13) {
    for (i = (R32(level) - 0xd) | 0; i < 5; i++) W32(A((choppers + SPRITE.state), i), 0); // 15b6d..15b97
  }

  // 15b99: cmp [0x30bec],0x13; jge 15bac
  if ((R32(level) | 0) < 0x13) W32((ufo + SPRITE.state), 0);
  // 15bac: cmp [0x30bec],0x19; jge 15bbf
  if ((R32(level) | 0) < 0x19) W32((cruiseMissile + SPRITE.state), 0);

  // 15bbf: cmp [0x30bec],0x12; jle skip; cmp [0x30bec],0x18; jl body (else 15c2b)
  if ((R32(level) | 0) > 0x12 && (R32(level) | 0) < 0x18) {
    for (i = (R32(level) - 0x12) | 0; i < 5; i++) W32(A((choppers + SPRITE.state), i), 0); // 15bd3..15bfd
    for (i = (R32(level) - 0x12) | 0; i < 3; i++) W32(A((cropDusters + SPRITE.state), i), 0); // 15bff..15c29
  }
});
