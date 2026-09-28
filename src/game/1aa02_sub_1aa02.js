// 0x1aa02  int sub_1aa02(eax, edx)   [Watcom main; frame 0x1c; ends at RET 0x1e0c7]
// Skeleton only: the body between the listed addresses is split into chunks (re/agents/MAIN_PLAN.md §2),
// each in src/game/1aa02/chunk_<start>.js with one entry, one exit and no live registers/locals at
// either boundary. This file holds the prologue, the three outer loops, the calls between chunks and the
// epilogue: 0x1aa02..0x1aa26, 0x1cbe4..0x1cc3c, 0x1d0b4..0x1d0c1, 0x1dffd, 0x1e002..0x1e018, 0x1e0be..0x1e0c7.
// Arguments: EAX and EDX are stored to [ebp-0x14]/[ebp-0x10] and never read (MAIN_PLAN §1.1).
// Return value: 0 (0x1e0be xor eax,eax); the caller 0x24f89 passes EAX on to 0x28bdc (MAIN_PLAN §1).
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';
import { chunk_1aa26 } from './1aa02/chunk_1aa26.js';
import { chunk_1af47 } from './1aa02/chunk_1af47.js';
import { chunk_1b4b9 } from './1aa02/chunk_1b4b9.js';
import { chunk_1b9a9 } from './1aa02/chunk_1b9a9.js';
import { chunk_1bed0 } from './1aa02/chunk_1bed0.js';
import { chunk_1c567 } from './1aa02/chunk_1c567.js';
import { chunk_1cc3c } from './1aa02/chunk_1cc3c.js';
import { chunk_1d0c1 } from './1aa02/chunk_1d0c1.js';
import { chunk_1d630 } from './1aa02/chunk_1d630.js';
import { chunk_1db3a } from './1aa02/chunk_1db3a.js';
import { chunk_1e018 } from './1aa02/chunk_1e018.js';
import { SPRITE, gameState, jah } from './data.js';

register(0x1aa02, 'sub_1aa02', async function sub_1aa02(a1, a2) {
  // 0x1aa02..0x1aa13: __CHK(0x50) omitted; push ebx,ecx,esi,edi,ebp; mov ebp,esp; sub esp,0x1c
  // (no address-taken locals: MAIN_PLAN §1.1)
  let v14 = a1;   // 0x1aa19 [ebp-0x14] = EAX  (never read)
  let v10 = a2;   // 0x1aa1c [ebp-0x10] = EDX  (never read)
  let v0c = 0;    // 0x1aa1f [ebp-0xc]  = 0    (never read)
  chunk_1aa26();                                       // I1 0x1aa26..0x1af47
  chunk_1af47();                                       // I2 0x1af47..0x1b4b9
  chunk_1b4b9();                                       // I3 0x1b4b9..0x1b9a9
  chunk_1b9a9();                                       // I4 0x1b9a9..0x1bed0
  chunk_1bed0();                                       // I5 0x1bed0..0x1c567
  await chunk_1c567();                                       // I6 0x1c567..0x1cbe4
  for (;;) {
    if (R32(gameState) === 0x25) break;                        // 0x1cbe4 cmp [0x30be4],0x25; je 0x1e018
    await F.sub_11659();                                     // 0x1cbf1
    F.Fill_Screen_20768(0);                            // 0x1cbf6 xor eax,eax; 0x1cbf8 call
    if (R32(gameState) === 0x25) break;                        // 0x1cbfd cmp; 0x1cc04 jne; 0x1cc06 jmp 0x1e018
    W32(jah, 0);                                         // 0x1cc0b
    W32((jah + SPRITE.y), R32((jah + SPRITE.height)));                              // 0x1cc15..0x1cc1a
    W32((jah + SPRITE.y), -R32((jah + SPRITE.y)) | 0);                         // 0x1cc1f neg dword [0x45d78]
    W32((jah + SPRITE.state), 0x21);                                      // 0x1cc25
    while (R32(gameState) !== 0x1c) {                          // 0x1cc2f cmp [0x30be4],0x1c; je 0x1e013
      chunk_1cc3c();                                   // L1 0x1cc3c..0x1d0b4
      while (R32(gameState) !== 0x1c) {                        // 0x1d0b4 cmp [0x30be4],0x1c; je 0x1e002
        await chunk_1d0c1();                                 // G1 0x1d0c1..0x1d630
        chunk_1d630();                                 // G2 0x1d630..0x1db3a
        await chunk_1db3a();                                 // G3 0x1db3a..0x1dffd
      }                                                      // 0x1dffd jmp 0x1d0b4
      await F.sub_1098f();                                   // 0x1e002
      F.Fill_Screen_20768(0);                          // 0x1e007 xor eax,eax; 0x1e009 call
    }                                                        // 0x1e00e jmp 0x1cc2f
  }                                                          // 0x1e013 jmp 0x1cbe4
  chunk_1e018();                                       // S1 0x1e018..0x1e0be
  return 0;                                                  // 0x1e0be xor eax,eax; 0x1e0c0..0x1e0c7 epilogue
});
