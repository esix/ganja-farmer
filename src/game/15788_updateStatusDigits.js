// 0x15788  void updateStatusDigits(void)   [Watcom, no args, no return value]
// Args: none (EAX/EDX are loaded before any read). Return: none — EAX at the RET (0x159e6) is a leftover of
// the last loop: always 2 from `mov eax,[ebp-4]` at 0x159af on the final exit; nothing sets it deliberately.
// Splits three integers into decimal digits with div 0x23744 and stores each digit at +0x168 of a
// 0x18c-stride element (0x18c = sprite struct size, +0x168 = curr_frame (LIBRARY.md) — that 0x44010 is a
// sprite array is not verified here):
//   [0x60a68] -> 7 digits at 0x44178 + i*0x18c (i = 0..6, most significant first; the last is the
//                remainder after /10, stored directly),
//   [0x60a6c] -> 4 digits at 0x44c4c + i*0x18c (divisors 1000, 100, 10, 1),
//   [0x30bec] -> 3 digits at 0x45408 + i*0x18c (divisors 100, 10, 1).
// Then every stored digit that is negative is set to 0.
// div_t temporaries: the original passes a hidden result pointer in ESI to div 0x23744 (one 8-byte slot per
// call site, [ebp-0x18], [ebp-0x20], ... [ebp-0x50]); they are address-taken, so they live in one emulated
// stack block laid out like the original frame: block + 0x40 - 8*k == ebp - 0x10 - 8*k.
// The struct copy target [ebp-0x10] (quot) / [ebp-0xc] (rem) is filled only by `movsd` pairs and read by
// value, so it is kept as two plain locals.
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';
import { idiv } from '../runtime/cpu.js';
import { stackAlloc, stackFree } from '../runtime/stack.js';
import { SPRITE, kills, killsDigits, level, levelDigits, score, scoreDigits } from './data.js';

register(0x15788, 'updateStatusDigits_15788', function updateStatusDigits() {
  let i;    // [ebp-4]
  let d;    // [ebp-8]: divisor
  let quot; // [ebp-0x10]: div_t.quot copy
  let rem;  // [ebp-0xc]: div_t.rem copy (also reused as the dividend before the two loops)
  const frame = stackAlloc(0x40); // [ebp-0x50 .. ebp-0x10): div_t result slots
  const T = (off) => frame + 0x40 - off + 0x10; // address of [ebp - off]

  i = 0;       // 0x157a0
  d = 1000;    // 0x157a7 (overwritten below before being read)
  F.div_23744(R32(score), 1000000, T(0x18));                // 0x157bb
  quot = R32(T(0x18)); rem = R32(T(0x18) + 4);                       // 0x157c6 movsd x2
  W32((scoreDigits + SPRITE.currFrame), quot);
  F.div_23744(rem, 100000, T(0x20));                           // 0x157db
  quot = R32(T(0x20)); rem = R32(T(0x20) + 4);
  W32((scoreDigits + 1 * SPRITE.SIZE + SPRITE.currFrame), quot);
  F.div_23744(rem, 10000, T(0x28));                            // 0x157fb
  quot = R32(T(0x28)); rem = R32(T(0x28) + 4);
  W32((scoreDigits + 2 * SPRITE.SIZE + SPRITE.currFrame), quot);
  F.div_23744(rem, 1000, T(0x30));                             // 0x1581b
  quot = R32(T(0x30)); rem = R32(T(0x30) + 4);
  W32((scoreDigits + 3 * SPRITE.SIZE + SPRITE.currFrame), quot);
  F.div_23744(rem, 100, T(0x38));                              // 0x1583b
  quot = R32(T(0x38)); rem = R32(T(0x38) + 4);
  W32((scoreDigits + 4 * SPRITE.SIZE + SPRITE.currFrame), quot);
  F.div_23744(rem, 10, T(0x40));                               // 0x1585b
  quot = R32(T(0x40)); rem = R32(T(0x40) + 4);
  W32((scoreDigits + 5 * SPRITE.SIZE + SPRITE.currFrame), quot);
  W32((scoreDigits + 6 * SPRITE.SIZE + SPRITE.currFrame), rem);                                                 // 0x15873

  d = 1000;                                                          // 0x15878
  rem = R32(kills);                                                // 0x15884 -> [ebp-0xc]
  for (i = 0; i < 4; i++) {
    F.div_23744(rem, d, T(0x48));                              // 0x158a5
    quot = R32(T(0x48)); rem = R32(T(0x48) + 4);
    W32((killsDigits + SPRITE.currFrame) + i * SPRITE.SIZE, quot);
    d = idiv(d, 10);                                                 // 0x158d0 cdq-style sar; idiv
  }

  d = 100;                                                           // 0x158d7
  rem = R32(level);                                                // 0x158e3 -> [ebp-0xc]
  for (i = 0; i < 3; i++) {
    F.div_23744(rem, d, T(0x50));                              // 0x15904
    quot = R32(T(0x50)); rem = R32(T(0x50) + 4);
    W32((levelDigits + SPRITE.currFrame) + i * SPRITE.SIZE, quot);
    d = idiv(d, 10);                                                 // 0x1592f
  }

  for (i = 0; i < 7; i++) {
    if ((R32((scoreDigits + SPRITE.currFrame) + i * SPRITE.SIZE) | 0) < 0) W32((scoreDigits + SPRITE.currFrame) + i * SPRITE.SIZE, 0);   // 0x15952 cmp/jge (signed)
  }
  for (i = 0; i < 4; i++) {
    if ((R32((killsDigits + SPRITE.currFrame) + i * SPRITE.SIZE) | 0) < 0) W32((killsDigits + SPRITE.currFrame) + i * SPRITE.SIZE, 0);   // 0x1598a
  }
  for (i = 0; i < 3; i++) {
    if ((R32((levelDigits + SPRITE.currFrame) + i * SPRITE.SIZE) | 0) < 0) W32((levelDigits + SPRITE.currFrame) + i * SPRITE.SIZE, 0);   // 0x159c2
  }

  stackFree(0x40);
});
