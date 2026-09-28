// 0x12e85  void sub_12e85(void)   [Watcom, no args, no return value]  (code 0x12e85..0x1352b RET)
// No register arguments: after `push 0x2c; call __CHK` it pushes EBX/ECX/EDX/ESI/EDI/EBP and writes every
// register before reading it (signatures.json regs=0). Return value: none — EAX at RET is a leftover (loop
// test path); the only call site 0x1d644 is followed directly by `call 0x136a5` (regs=0) and signatures.json
// has returns=false.
//
// Structures (sprite struct, stride 0x18c, LIBRARY.md "Structures"):
//   0x33f48 + i*0x18c, i = 0..4: sprite array — main (decompiled.c:4302-4317) Sprite_Inits 5 entries there and
//     fills their frames from "chopper2.pcx" (0x301bb). Fields used: x (+0x000) 0x33f48, y (+0x004) 0x33f4c,
//     counter_1 (+0x010) 0x33f58, counter_2 (+0x014) 0x33f5c, counter_3 (+0x018) 0x33f60,
//     curr_frame (+0x168) 0x340b0, state (+0x170) 0x340b8.
//   0x35b20 + k*0x18c, k = 0..24: sprite array — main (decompiled.c:4322-4324) Sprite_Inits 25 entries there
//     ("ptroop.pcx", 0x301c8). Fields used: x 0x35b20, y 0x35b24, curr_frame 0x35c88, state 0x35c90.
//   (Only struct offsets are cited; what the fields mean to the game is not claimed.)
//   dws_DPLAY structs (LIBRARY.md): 0x61240 (soundnum +0xA = 0x6124a), 0x61280 (soundnum = 0x6128a).
// Other globals, meaning unknown: 0x60f04 (5 words, the DSoundStatus result pointer per entry), 0x60b98
// (index into the 0x35b20 array, wrapped to 0 at 0x19), 0x60bbc, 0x60a68, 0x60a6c, 0x60b90/0x60b94 (read by
// 0x1352c to set x = [0x60b90] and y = [0x60b94]+6 of the ring entry it writes), 0x60b58 + 4*[0x60b8c] ([0x60b8c] is 0x1352c's ring index).
//
// Summary: for each of the 5 entries of 0x33f48: sound status query / conditional DPlay; state 0x1c / 0x1b
// movement with rand()-driven re-initialisation of x/counters; a conditional state write to the next 0x35b20 entry; state 0x1a frame cycling
// and counter_3 countdown; 4 x 0x1352c + sound when counter_2 < 0; rand()-driven re-initialisation when state == 0.
// All `% n` are `sar edx,31; idiv ecx/ebx` remainders (imod).
import { F, register } from '../runtime/registry.js';
import { R16, R32, W32 } from '../runtime/mem.js';
import { imod } from '../runtime/cpu.js';

register(0x12e85, 'sub_12e85', function sub_12e85() {
  let i; // [ebp-8]
  let j; // [ebp-4]
  let r;
  let v;

  for (i = 0; i < 5; i++) {
    // 0x12eb6: cdecl dws_DSoundStatus(zero-extended word [0x6124a], 0x60f04 + i*2)
    F.dws_DSoundStatus_1f348(R16(0x6124a), 0x60f04 + i * 2);
    // 0x12ed4: word [0x60f04+i*2] == 0 && x < 0x140 && x > -0x96 (signed jl / jg) -> dws_DPlay(0x61240)
    if (R16(0x60f04 + i * 2) === 0 &&
        R32(0x33f48 + Math.imul(i, 0x18c)) < 0x140 &&
        R32(0x33f48 + Math.imul(i, 0x18c)) > -0x96) {
      F.dws_DPlay_1eff8(0x61240);
    }

    // 0x12f1b: state == 0x1c
    if (R32(0x340b8 + Math.imul(i, 0x18c)) === 0x1c) {
      // 0x12f2f: x += counter_1
      W32(0x33f48 + Math.imul(i, 0x18c), (R32(0x33f48 + Math.imul(i, 0x18c)) + R32(0x33f58 + Math.imul(i, 0x18c))) | 0);
      // 0x12f49: x > 0x154 (jle skips)
      if (R32(0x33f48 + Math.imul(i, 0x18c)) > 0x154) {
        r = F.rand_232c7();
        if (imod(r, 2) === 1) {
          // 0x12f78
          W32(0x340b8 + Math.imul(i, 0x18c), 0x1b);
          r = F.rand_232c7();
          W32(0x33f4c + Math.imul(i, 0x18c), imod(r, 0x2d));
          r = F.rand_232c7();
          W32(0x33f58 + Math.imul(i, 0x18c), (-1 - imod(r, 7)) | 0);
        } else {
          // 0x12fd6
          r = F.rand_232c7();
          W32(0x33f48 + Math.imul(i, 0x18c), (-200 - imod(r, 0x12c)) | 0);
          r = F.rand_232c7();
          W32(0x33f58 + Math.imul(i, 0x18c), (imod(r, 7) + 1) | 0);
        }
      }
      // 0x13020: inc curr_frame; if > 3 -> 2
      W32(0x340b0 + Math.imul(i, 0x18c), (R32(0x340b0 + Math.imul(i, 0x18c)) + 1) | 0);
      if (R32(0x340b0 + Math.imul(i, 0x18c)) > 3) {
        W32(0x340b0 + Math.imul(i, 0x18c), 2);
      }
    }

    // 0x13047: state == 0x1b (re-read; the block above may have just set it)
    if (R32(0x340b8 + Math.imul(i, 0x18c)) === 0x1b) {
      // 0x1305b: x += counter_1
      W32(0x33f48 + Math.imul(i, 0x18c), (R32(0x33f48 + Math.imul(i, 0x18c)) + R32(0x33f58 + Math.imul(i, 0x18c))) | 0);
      // 0x13075: x < -0x82 (jge skips)
      if (R32(0x33f48 + Math.imul(i, 0x18c)) < -0x82) {
        r = F.rand_232c7();
        if (imod(r, 2) === 1) {
          // 0x130a4
          W32(0x340b8 + Math.imul(i, 0x18c), 0x1c);
          r = F.rand_232c7();
          W32(0x33f4c + Math.imul(i, 0x18c), imod(r, 0x2d));
          r = F.rand_232c7();
          W32(0x33f58 + Math.imul(i, 0x18c), (imod(r, 7) + 1) | 0);
        } else {
          // 0x130fa
          r = F.rand_232c7();
          W32(0x33f48 + Math.imul(i, 0x18c), (imod(r, 0x12c) + 0x140) | 0);
          r = F.rand_232c7();
          W32(0x33f58 + Math.imul(i, 0x18c), (-1 - imod(r, 7)) | 0);
        }
      }
      // 0x1314a: inc curr_frame; if > 1 -> 0
      W32(0x340b0 + Math.imul(i, 0x18c), (R32(0x340b0 + Math.imul(i, 0x18c)) + 1) | 0);
      if (R32(0x340b0 + Math.imul(i, 0x18c)) > 1) {
        W32(0x340b0 + Math.imul(i, 0x18c), 0);
      }
    }

    // 0x13171: mov eax,[0x60b98]; inc eax; cmp eax,0x19; jl — the incremented value is only in EAX and is
    // never stored; memory is only written (0) when [0x60b98] + 1 >= 0x19.
    if (!(((R32(0x60b98) + 1) | 0) < 0x19)) {
      W32(0x60b98, 0);
    }

    // 0x13186: (state == 0x1c || state == 0x1b) && rand() % 15 == 5 && x > -0x28 && x < 0xeb
    //          && state of 0x35b20 entry [0x60b98]+1 == 0 && [0x60bbc] == 0
    // ORIGINAL BUG: when [0x60b98] == 24 the state test at 0x131e7 reads entry 25, one past the 25-entry
    // 0x35b20 array (address 0x35c90 + 25*0x18c = 0x3833c = state (+0x170) of entry 0 of the 0x381cc sprite array,
    // decompiled.c:4348).
    if ((R32(0x340b8 + Math.imul(i, 0x18c)) === 0x1c || R32(0x340b8 + Math.imul(i, 0x18c)) === 0x1b) &&
        imod(F.rand_232c7(), 0xf) === 5 &&
        R32(0x33f48 + Math.imul(i, 0x18c)) > -0x28 &&
        R32(0x33f48 + Math.imul(i, 0x18c)) < 0xeb &&
        R32(0x35c90 + Math.imul((R32(0x60b98) + 1) | 0, 0x18c)) === 0 &&
        R32(0x60bbc) === 0) {
      // 0x1320c: inc [0x60b98]; if >= 0x19 -> 0
      W32(0x60b98, (R32(0x60b98) + 1) | 0);
      if (R32(0x60b98) >= 0x19) {
        W32(0x60b98, 0);
      }
      // 0x13225: entry[[0x60b98]].x = x + 0x3c
      v = (R32(0x33f48 + Math.imul(i, 0x18c)) + 0x3c) | 0;
      W32(0x35b20 + Math.imul(R32(0x60b98), 0x18c), v);
      // 0x13245: entry[[0x60b98]].y = y + 0x19
      v = (R32(0x33f4c + Math.imul(i, 0x18c)) + 0x19) | 0;
      W32(0x35b24 + Math.imul(R32(0x60b98), 0x18c), v);
      // 0x13265: state = 0x1b; 0x13279: curr_frame = 0
      W32(0x35c90 + Math.imul(R32(0x60b98), 0x18c), 0x1b);
      W32(0x35c88 + Math.imul(R32(0x60b98), 0x18c), 0);
    }

    // 0x1328d: state == 0x1a
    if (R32(0x340b8 + Math.imul(i, 0x18c)) === 0x1a) {
      // 0x132a1: curr_frame == 2 || == 3 -> inc; if > 3 -> 2
      if (R32(0x340b0 + Math.imul(i, 0x18c)) === 2 || R32(0x340b0 + Math.imul(i, 0x18c)) === 3) {
        W32(0x340b0 + Math.imul(i, 0x18c), (R32(0x340b0 + Math.imul(i, 0x18c)) + 1) | 0);
        if (R32(0x340b0 + Math.imul(i, 0x18c)) > 3) {
          W32(0x340b0 + Math.imul(i, 0x18c), 2);
        }
      }
      // 0x132e8: curr_frame == 0 || == 1 -> inc; if > 1 -> 0 (re-read after the block above)
      if (R32(0x340b0 + Math.imul(i, 0x18c)) === 0 || R32(0x340b0 + Math.imul(i, 0x18c)) === 1) {
        W32(0x340b0 + Math.imul(i, 0x18c), (R32(0x340b0 + Math.imul(i, 0x18c)) + 1) | 0);
        if (R32(0x340b0 + Math.imul(i, 0x18c)) > 1) {
          W32(0x340b0 + Math.imul(i, 0x18c), 0);
        }
      }
      // 0x1332f: dec counter_3; if < 0 (jge skips): state = 0, [0x60a68] += 0x65, [0x60a6c]++
      W32(0x33f60 + Math.imul(i, 0x18c), (R32(0x33f60 + Math.imul(i, 0x18c)) - 1) | 0);
      if (R32(0x33f60 + Math.imul(i, 0x18c)) < 0) {
        W32(0x340b8 + Math.imul(i, 0x18c), 0);
        W32(0x60a68, (R32(0x60a68) + 0x65) | 0);
        W32(0x60a6c, (R32(0x60a6c) + 1) | 0);
      }
    }

    // 0x13363: counter_2 < 0 && state != 0x1a && state != 0
    if (R32(0x33f5c + Math.imul(i, 0x18c)) < 0 &&
        R32(0x340b8 + Math.imul(i, 0x18c)) !== 0x1a &&
        R32(0x340b8 + Math.imul(i, 0x18c)) !== 0) {
      for (j = 0; j < 4; j++) {
        // 0x133b3: ecx = x + 0xf (read before rand); [0x60b90] = ecx + rand() % 0x28
        v = (R32(0x33f48 + Math.imul(i, 0x18c)) + 0xf) | 0;
        r = F.rand_232c7();
        W32(0x60b90, (v + imod(r, 0x28)) | 0);
        // 0x133de: ebx = y - 0xa (read before rand); [0x60b94] = ebx + rand() % 0xf
        v = (R32(0x33f4c + Math.imul(i, 0x18c)) - 0xa) | 0;
        r = F.rand_232c7();
        W32(0x60b94, (v + imod(r, 0xf)) | 0);
        // 0x13409: [0x60b58 + [0x60b8c]*4] = rand() % 7 + 0x30 ([0x60b8c] read after rand)
        r = F.rand_232c7();
        W32(0x60b58 + (R32(0x60b8c) << 2), (imod(r, 7) + 0x30) | 0);
        // 0x1342d
        F.sub_1352c();
        // 0x13432: cdecl dws_DDiscard(zero-extended word [0x6128a]); 0x13443: dws_DPlay(0x61280)
        F.dws_DDiscard_1f770(R16(0x6128a));
        F.dws_DPlay_1eff8(0x61280);
      }
      // 0x13456: state = 0x1a; counter_3 = 0xa
      W32(0x340b8 + Math.imul(i, 0x18c), 0x1a);
      W32(0x33f60 + Math.imul(i, 0x18c), 0xa);
    }

    // 0x13478: state == 0
    if (R32(0x340b8 + Math.imul(i, 0x18c)) === 0) {
      r = F.rand_232c7();
      if (imod(r, 2) === 1) {
        // 0x134a4: x = 0x1cc; counter_2 = 10; if [0x60bbc] == 0: state = 0x1c
        W32(0x33f48 + Math.imul(i, 0x18c), 0x1cc);
        W32(0x33f5c + Math.imul(i, 0x18c), 0xa);
        if (R32(0x60bbc) === 0) {
          W32(0x340b8 + Math.imul(i, 0x18c), 0x1c);
        }
      } else {
        // 0x134e2: x = -200; counter_2 = 10; if [0x60bbc] == 0: state = 0x1b
        W32(0x33f48 + Math.imul(i, 0x18c), -200);
        W32(0x33f5c + Math.imul(i, 0x18c), 0xa);
        if (R32(0x60bbc) === 0) {
          W32(0x340b8 + Math.imul(i, 0x18c), 0x1b);
        }
      }
    }
  }
});
