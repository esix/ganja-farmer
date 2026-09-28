// 0x10010  int readHighScoreEntry(int a /*EAX*/, int b /*EDX*/)   [Watcom, 2 register args, returns EAX]
// Calls fread(b, 0x18, 1, a) (0x1e110) and returns its result.
// Callers 0x107ac / 0x10826 pass a = [ebp-0xc]/[ebp-0x10] and b = 0x60a70 + i*0x18 (one 0x18-byte
// entry of the table at 0x60a70), so `a` is used as the FILE* argument of fread.
import { F, register } from '../runtime/registry.js';

register(0x10010, 'readHighScoreEntry_10010', function readHighScoreEntry(a, b) {
  let r; // [ebp-4]

  r = F.fread_1e110(b, 0x18, 1, a); // library call (fread does not wait): synchronous
  return r;
});
