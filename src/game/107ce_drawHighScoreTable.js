// 0x107ce  void drawHighScoreTable(void)   [Watcom, no args, no return value]
// Args: none (EAX/EDX/EBX/ECX are loaded before any read; EBX/ECX/EDX/ESI/EDI are saved/restored).
// Return: none — EAX at the RET (0x1098e) is a leftover (0 from fopen on failure, fclose's result
// otherwise); the only caller (0x1134e in 0x1128e) does not read EAX (next insn: cmp [ebp-4],0).
// Copies 10 dwords from 0x30c24 into a local array, opens "scores.dat" (0x30028) with mode "r" (0x30026)
// and, if that succeeds, for i = 0, 1, ... while readHighScoreEntry(fp, 0x60a70 + i*0x18) != 0 (i.e. while the fread
// in readHighScoreEntry returns non-zero — see 10010_sub_10010.js):
//   [0x60a68] = entry+0, [0x30bec] = entry+4 (entry = 0x60a70 + i*0x18), calls updateStatusDigits,
//   sets x (+0) / y (+4) (LIBRARY.md sprite) of the 7 elements at 0x44010 (stride 0x18c) to 0xa8 + 4*j /
//   0x55 + 13*i and of the 3 elements at 0x452a0 to 0x104 + 4*j / 0x55 + 13*i, draws all 10 with
//   Draw_Sprite_Clip(elem, [0x64e7c] (double_buffer, LIBRARY.md), 1), then
//   Print_String_DB(0x21, 13*i + 0x53, localArray[i] /* color arg */, entry + 8, 1).
// Then fclose(fp).
// ORIGINAL BUG: the loop has no upper bound on i. The file written by saveHighScores holds 9 entries, but a longer
// file makes fread write past 0x60a70 + 9*0x18, and for i >= 10 the color read [ebp-0x38 + i*4] runs past the
// 10-dword local array into the other frame slots ([ebp-0x10] fp, [ebp-0xc] never written, [ebp-8] i,
// [ebp-4] j) and, for i >= 14, into the saved EBP / registers / return address.
// All locals therefore live in one emulated block laid out like the original frame ([ebp-0x38] .. [ebp-4]),
// so the out-of-bounds reads for i = 10..13 see the same slots as the original.
// UNCERTAIN: for i >= 14 the original reads saved registers (caller state) that this port cannot model;
// the port reads whatever lies above the block in the emulated stack.
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';
import { stackAlloc, stackFree } from '../runtime/stack.js';
import { HIGHSCORES_FIELD, SPRITE, doubleBuffer, highScoreRowColors, highScores, level, levelDigits, score, scoreDigits } from './data.js';

register(0x107ce, 'drawHighScoreTable_107ce', function drawHighScoreTable() {
  const frame = stackAlloc(0x38);              // sub esp, 0x38
  const L = (off) => frame + 0x38 - off;       // address of [ebp - off]
  const ARR = L(0x38);                          // [ebp-0x38]: 10 dwords copied from 0x30c24
  const FP = L(0x10);                           // [ebp-0x10]: FILE* from fopen
  const I = L(8);                               // [ebp-8]: entry index
  const J = L(4);                               // [ebp-4]: loop counter

  W32(I, 0);                                                             // 0x107e6
  for (let k = 0; k < 10; k++) W32(ARR + k * 4, R32(highScoreRowColors + k * 4));   // 0x107ed rep movsd (ecx=10)
  W32(FP, F.fopen_2264a(0x30028 /* "scores.dat" */, 0x30026 /* "r" */));  // 0x10806
  if (R32(FP) === 0) { stackFree(0x38); return; }                        // 0x1080e je 0x10986

  for (;;) {
    // 0x10818..0x1082d
    if ((F.readHighScoreEntry_10010(R32(FP), (highScores + R32(I) * 0x18) | 0)) === 0) break;
    W32(score, R32((R32(I) * 0x18 + highScores) | 0));                    // 0x10833
    W32(level, R32((R32(I) * 0x18 + (highScores + HIGHSCORES_FIELD.level)) | 0));                    // 0x10842
    F.updateStatusDigits_15788();                                                  // 0x10851

    for (W32(J, 0); (R32(J) | 0) < 7; W32(J, R32(J) + 1)) {              // 0x10856..0x10869 (jge: signed)
      W32((R32(J) * SPRITE.SIZE + scoreDigits) | 0, ((R32(J) << 2) + 0xa8) | 0);   // 0x1086b
      W32((R32(J) * SPRITE.SIZE + (scoreDigits + SPRITE.y)) | 0, (R32(I) * 0xd + 0x55) | 0);    // 0x10884
    }
    for (W32(J, 0); (R32(J) | 0) < 3; W32(J, R32(J) + 1)) {              // 0x1089a..0x108ad
      W32((R32(J) * SPRITE.SIZE + levelDigits) | 0, ((R32(J) << 2) + 0x104) | 0);  // 0x108af
      W32((R32(J) * SPRITE.SIZE + (levelDigits + SPRITE.y)) | 0, (R32(I) * 0xd + 0x55) | 0);    // 0x108c8
    }
    for (W32(J, 0); (R32(J) | 0) < 7; W32(J, R32(J) + 1)) {              // 0x108de..0x108f1
      F.Draw_Sprite_Clip_212c0((scoreDigits + R32(J) * SPRITE.SIZE) | 0, R32(doubleBuffer), 1);  // 0x1090c
    }
    for (W32(J, 0); (R32(J) | 0) < 3; W32(J, R32(J) + 1)) {              // 0x10913..0x10926
      F.Draw_Sprite_Clip_212c0((levelDigits + R32(J) * SPRITE.SIZE) | 0, R32(doubleBuffer), 1);  // 0x10941
    }
    // 0x10948..0x1096e: push 1; ecx = 0x60a70 + i*0x18 + 8; ebx = [ebp-0x38 + i*4]; edx = i*0xd + 0x53; eax = 0x21
    F.Print_String_DB_221aa(0x21, (R32(I) * 0xd + 0x53) | 0, R32((ARR + (R32(I) << 2)) | 0),
                                  (R32(I) * 0x18 + highScores + 8) | 0, 1);
    W32(I, R32(I) + 1);                                                   // 0x10976 inc [ebp-8]
  }
  F.fclose_228ed(R32(FP));                                          // 0x10981
  stackFree(0x38);
});
