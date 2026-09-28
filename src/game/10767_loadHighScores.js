// 0x10767  void loadHighScores(void)   [Watcom, no args, no return value: EAX at RET is fclose's/fopen's leftover]
// Opens "scores.dat" (0x3001b) with mode "r" (0x30019). If fopen returns non-zero, calls
// readHighScoreEntry(fp, 0x60a70 + i*0x18) for i = 0, 1, 2, ... until it returns 0, then fclose(fp).
// readHighScoreEntry is fread(entry, 0x18, 1, fp) (see 10010_sub_10010.js). The 0x60a70 table with stride 0x18 is
// the one saveHighScores writes to "scores.dat" (9 entries there).
// The loop has no upper bound on i: entries are read until readHighScoreEntry returns 0 (0x107b1 test eax,eax / je).
import { F, register } from '../runtime/registry.js';
import { highScores } from './data.js';

register(0x10767, 'loadHighScores_10767', function loadHighScores() {
  let i; // [ebp-4]
  let fp; // [ebp-0xc]

  i = 0; // 0x1077f
  fp = F.fopen_2264a(0x3001b /* "scores.dat" */, 0x30019 /* "r" */); // 0x10786..0x10795
  if (fp !== 0) { // 0x10798 cmp / je 0x107c5
    for (;;) {
      // 0x1079e..0x107ac: EDX = 0x60a70 + i*0x18, EAX = fp
      if ((F.readHighScoreEntry_10010(fp, (highScores + Math.imul(i, 0x18)) | 0)) === 0) break; // 0x107b1 test / je 0x107bd
      i++; // 0x107b5 mov eax,[ebp-4] (unused) / 0x107b8 inc [ebp-4]
    }
    F.fclose_228ed(fp); // 0x107bd..0x107c0
  }
});
