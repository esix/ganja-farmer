// 0x10676  void saveHighScores(void)   [Watcom, no args, no return value]
// Writes the 9-entry table at 0x60a70 (stride 0x18) to "scores.dat" (mode "w").
// If 0x31ee0 != 0, first re-initializes every entry: calls istream_extract_cstr(0x64eb8 /* istream object */, entry+8),
// sets entry+0 = 100000 - i*10000 and entry+4 = 10 - i.
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';
import { HIGHSCORES_FIELD, cin, highScores, resetHighScores } from './data.js';

register(0x10676, 'saveHighScores_10676', function saveHighScores() {
  let r; // [ebp-8]: receives sub_2270d results, never read
  let i; // [ebp-0xc]
  let fp; // [ebp-0x10]

  r = 0;
  i = 0;
  if (R32(resetHighScores) !== 0) {
    for (i = 0; i < 9; i++) {
      F.istream_extract_cstr_2231a(cin, highScores + i * 0x18 + 8);
      W32(highScores + i * 0x18, 100000 - i * 10000);
      W32((highScores + HIGHSCORES_FIELD.level) + i * 0x18, 10 - i);
      r = 0;
    }
  }
  fp = F.fopen_2264a(0x3000e /* "scores.dat" */, 0x3000c /* "w" */);
  if (fp !== 0) {
    for (i = 0; i < 9; i++) {
      r = F.fwrite_2270d(highScores + i * 0x18, 0x18, 1, fp);
    }
    F.fclose_228ed(fp);
  }
});
