// 0x15c34  void sub_15c34(void)   [Watcom, no args, no return value]
// Loop i = 0 .. 0 (i < 1): W32(0x3d220 + i*0x18c, 1).
// 0x3d220: dword, element stride 0x18c (the sprite struct size, LIBRARY.md); no struct base using it was
// found, so no field meaning is claimed.
// EAX at RET is the leftover 0 from `mov eax,[ebp-4]` at 15c55 on the exiting pass; no caller reads it -> no return value.
import { register } from '../runtime/registry.js';
import { W32 } from '../runtime/mem.js';
import { SPRITE, a10Jets } from './data.js';

register(0x15c34, 'sub_15c34', function sub_15c34() {
  let i; // [ebp-4]
  // 15c4c..15c72; the `mov eax,[ebp-4]` at 15c55 before `inc` is overwritten by imul on a continuing pass and
  // is the leftover EAX on the exiting pass (unobservable)
  for (i = 0; i < 1; i++) {
    W32((a10Jets + SPRITE.state) + Math.imul(i, SPRITE.SIZE), 1);
  }
});
