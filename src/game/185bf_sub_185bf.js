// 0x185bf  void sub_185bf(void)   [Watcom, no args, no return value]
// For each of 63 sprites in the array at 0x46218 (stride 0x18c; Sprite_Init'ed on it at ~decompiled.c:4412,
// drawn with Draw_Sprite_Clip): x += rand() % 4 - 2, calls rand() once more (result discarded),
// decrements counter_1 and sets state = 0 when counter_1 < 0 (field names: LIBRARY.md "sprite").
// EAX at RET is the leftover of the last loop-counter read; signatures.json returns=false.
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';
import { imod } from '../runtime/cpu.js';

register(0x185bf, 'sub_185bf', function sub_185bf() {
  let i; // [ebp-4]

  // 185d7: mov [ebp-4], 0 ; 185e6: cmp [ebp-4], 0x3f ; jge end ; 185e0: inc [ebp-4]
  for (i = 0; i < 0x3f; i++) {
    // 185ec..18609: ecx = i*0x18c; rand; edx = rand % 4 (idiv, signed) - 2; add [ecx+0x46218] (x), edx
    const r = F.rand_232c7();
    W32(0x46218 + i * 0x18c, (R32(0x46218 + i * 0x18c) + (imod(r, 4) - 2)) | 0);
    // 1860f..18616: second rand, EAX discarded (EDX = i*0x18c is dead)
    F.rand_232c7();
    // 1861b..1862f: dec [eax+0x46228] (counter_1); cmp 0; jge (signed)
    W32(0x46228 + i * 0x18c, (R32(0x46228 + i * 0x18c) - 1) | 0);
    if ((R32(0x46228 + i * 0x18c) | 0) < 0) {
      // 18638: mov [eax+0x46388] (state), 0
      W32(0x46388 + i * 0x18c, 0);
    }
  }
});
