// 0x10676  void sub_10676(void)   [Watcom, no args, no return value]
// Writes the 9-entry table at 0x60a70 (stride 0x18) to "scores.dat" (mode "w").
// If 0x31ee0 != 0, first re-initializes every entry: calls istream_extract_cstr(0x64eb8 /* istream object */, entry+8),
// sets entry+0 = 100000 - i*10000 and entry+4 = 10 - i.
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';

register(0x10676, 'sub_10676', async function sub_10676() {
  let r; // [ebp-8]: receives sub_2270d results, never read
  let i; // [ebp-0xc]
  let fp; // [ebp-0x10]

  r = 0;
  i = 0;
  if (R32(0x31ee0) !== 0) {
    for (i = 0; i < 9; i++) {
      await F.istream_extract_cstr_2231a(0x64eb8, 0x60a70 + i * 0x18 + 8);
      W32(0x60a70 + i * 0x18, 100000 - i * 10000);
      W32(0x60a74 + i * 0x18, 10 - i);
      r = 0;
    }
  }
  fp = await F.fopen_2264a(0x3000e /* "scores.dat" */, 0x3000c /* "w" */);
  if (fp !== 0) {
    for (i = 0; i < 9; i++) {
      r = await F.fwrite_2270d(0x60a70 + i * 0x18, 0x18, 1, fp);
    }
    await F.fclose_228ed(fp);
  }
});
