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
// Stage 1 kept the locals in one emulated block laid out like the original frame for that reason; stage 2
// makes them JS variables (see below), so those out-of-bounds colours are not reproduced.
import { F, register } from '../runtime/registry.js';
import { R32 } from '../runtime/mem.js';
import { highScoreRowColors, highScores, levelDigits, scoreDigits } from './data.js';
import { G, highScore, sprite } from './access.js';

// Stage 2: the locals ([ebp-0x38] colours, [ebp-0x10] FILE*, [ebp-8] i, [ebp-4] j) are JS variables instead of
// an emulated stack frame. DEVIATION (unreachable with the game's own SCORES.DAT, 9 records): with more than
// 10 records the original read row colours past its 10-entry copy, from the frame's other slots.
register(0x107ce, 'drawHighScoreTable_107ce', function drawHighScoreTable() {
  const rowColors = [];
  for (let k = 0; k < 10; k++) rowColors.push(R32(highScoreRowColors + k * 4));   // 0x107ed rep movsd (ecx=10)
  const fp = F.fopen_2264a(0x30028 /* "scores.dat" */, 0x30026 /* "r" */);   // 0x10806
  if (fp === 0) return;                                                       // 0x1080e je 0x10986

  for (let i = 0; ; i++) {                                                    // [ebp-8]; 0x10976 inc
    if (F.readHighScoreEntry_10010(fp, highScore(i).addr) === 0) break;      // 0x10818..0x1082d
    G.score = highScore(i).score;                                             // 0x10833
    G.level = highScore(i).level;                                             // 0x10842
    F.updateStatusDigits_15788();                                             // 0x10851

    for (let j = 0; j < 7; j++) {                                             // 0x10856..0x10869
      sprite(scoreDigits, j).x = ((j << 2) + 0xa8) | 0;                       // 0x1086b
      sprite(scoreDigits, j).y = (i * 0xd + 0x55) | 0;                        // 0x10884
    }
    for (let j = 0; j < 3; j++) {                                             // 0x1089a..0x108ad
      sprite(levelDigits, j).x = ((j << 2) + 0x104) | 0;                      // 0x108af
      sprite(levelDigits, j).y = (i * 0xd + 0x55) | 0;                        // 0x108c8
    }
    for (let j = 0; j < 7; j++) F.Draw_Sprite_Clip_212c0(sprite(scoreDigits, j).addr, G.doubleBuffer, 1); // 0x1090c
    for (let j = 0; j < 3; j++) F.Draw_Sprite_Clip_212c0(sprite(levelDigits, j).addr, G.doubleBuffer, 1); // 0x10941
    // 0x10948..0x1096e: name at record + 8, colour of the row
    F.Print_String_DB_221aa(0x21, (i * 0xd + 0x53) | 0, rowColors[i], (i * 0x18 + highScores + 8) | 0, 1);
  }
  F.fclose_228ed(fp);                                                         // 0x10981
});
