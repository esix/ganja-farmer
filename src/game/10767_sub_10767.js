// 0x10767  void sub_10767(void)   [Watcom, no args, no return value: EAX at RET is fclose's/fopen's leftover]
// Opens "scores.dat" (0x3001b) with mode "r" (0x30019). If fopen returns non-zero, calls
// sub_10010(fp, 0x60a70 + i*0x18) for i = 0, 1, 2, ... until it returns 0, then fclose(fp).
// sub_10010 is fread(entry, 0x18, 1, fp) (see 10010_sub_10010.js). The 0x60a70 table with stride 0x18 is
// the one sub_10676 writes to "scores.dat" (9 entries there).
// The loop has no upper bound on i: entries are read until sub_10010 returns 0 (0x107b1 test eax,eax / je).
import { F, register } from '../runtime/registry.js';

register(0x10767, 'sub_10767', async function sub_10767() {
  let i; // [ebp-4]
  let fp; // [ebp-0xc]

  i = 0; // 0x1077f
  fp = await F.fopen_2264a(0x3001b /* "scores.dat" */, 0x30019 /* "r" */); // 0x10786..0x10795
  if (fp !== 0) { // 0x10798 cmp / je 0x107c5
    for (;;) {
      // 0x1079e..0x107ac: EDX = 0x60a70 + i*0x18, EAX = fp
      if ((await F.sub_10010(fp, (0x60a70 + Math.imul(i, 0x18)) | 0)) === 0) break; // 0x107b1 test / je 0x107bd
      i++; // 0x107b5 mov eax,[ebp-4] (unused) / 0x107b8 inc [ebp-4]
    }
    await F.fclose_228ed(fp); // 0x107bd..0x107c0
  }
});
