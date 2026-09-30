// 0x14425  void updatePlants(void)   [Watcom, no args, no return value]
// Per-frame state update of the 26-entry sprite array at 0x3a878 (stride 0x18c; Sprite_Init'ed in a
// 0x1a-iteration loop, decompiled.c "Sprite_Init(&DAT_0003a878 + iStack_18 * 0x18c, ...)"). Field names
// from the sprite struct (LIBRARY.md): +0x10 counter_1 (0x3a888), +0x14 counter_2 (0x3a88c),
// +0x18 counter_3 (0x3a890), +0x168 curr_frame (0x3a9e0), +0x170 state (0x3a9e8). For each sprite i:
//   state 0x33: --counter_3; if < 0: state = 1, curr_frame = 0.
//   state 0x29: ++curr_frame (> 4 -> 2); --counter_1; if < 0: state = 0, curr_frame = 5.
//   state 0x32: --counter_2; if < 0: state = 0x29, counter_1 = 0xb4, curr_frame = 2, then
//               dws_DDiscard(word [0x6128a]) and dws_DPlay(0x61280) (dws_DPLAY at 0x61280, +0xA soundnum,
//               LIBRARY.md "STK structures").
// The three checks run in sequence, so a state set by an earlier block is seen by a later one in the same
// iteration (0x32 -> 0x29 is set last, so it takes effect next call).
// Return value: none. EAX at RET (0x14592) is the leftover of `mov eax,[ebp-8]` at 0x14446 (the loop counter);
// both call sites (0x1618a, 0x1d65d) are followed by `mov edx,[0x64e7c]` then an EAX-overwriting `mov eax, 0x33c30` (0x16195) resp. a call to
// 0x15127 (no register args, signatures.json regs 0); signatures.json returns=false.
import { F, register } from '../runtime/registry.js';
import { R16, R32, W32 } from '../runtime/mem.js';
import { plants, sndExplosion } from './data.js';
import { dplay, sprite } from './access.js';

register(0x14425, 'updatePlants_14425', function updatePlants() {
  let i; // [ebp-8]

  // 0x1443d..0x14450: for (i = 0; i < 0x1a; i++)  (signed jge)
  for (i = 0; i < 0x1a; i++) {
    // 0x14456: if (state == 0x33)
    if (sprite(plants, i).state === 0x33) {
      // 0x1446d: dec counter_3; cmp 0; jge
      sprite(plants, i).counter3 = (sprite(plants, i).counter3 - 1) | 0;
      if (sprite(plants, i).counter3 < 0) {
        sprite(plants, i).state = 1; // 0x14483: state = 1
        sprite(plants, i).currFrame = 0; // 0x14494: curr_frame = 0
      }
    }
    // 0x1449e: if (state == 0x29)
    if (sprite(plants, i).state === 0x29) {
      // 0x144b5: inc curr_frame; cmp 4; jle (signed)
      sprite(plants, i).currFrame = (sprite(plants, i).currFrame + 1) | 0;
      if (sprite(plants, i).currFrame > 4) {
        sprite(plants, i).currFrame = 2; // 0x144cb
      }
      // 0x144dc: dec counter_1; cmp 0; jge
      sprite(plants, i).counter1 = (sprite(plants, i).counter1 - 1) | 0;
      if (sprite(plants, i).counter1 < 0) {
        sprite(plants, i).state = 0; // 0x144f2: state = 0
        sprite(plants, i).currFrame = 5; // 0x14503: curr_frame = 5
      }
    }
    // 0x1450d: if (state == 0x32)
    if (sprite(plants, i).state === 0x32) {
      // 0x14524: dec counter_2; cmp 0; jge
      sprite(plants, i).counter2 = (sprite(plants, i).counter2 - 1) | 0;
      if (sprite(plants, i).counter2 < 0) {
        sprite(plants, i).state = 0x29; // 0x1453a: state = 0x29
        sprite(plants, i).counter1 = 0xb4; // 0x1454b: counter_1 = 180
        sprite(plants, i).currFrame = 2;    // 0x1455c: curr_frame = 2
        // 0x14566..0x14574: xor eax,eax; mov ax,[0x6128a]; push eax; call dws_DDiscard; add esp,4
        F.dws_DDiscard_1f770(dplay(sndExplosion).soundnum);
        // 0x14577..0x14582: push 0x61280; call dws_DPlay; add esp,4
        F.dws_DPlay_1eff8(sndExplosion);
      }
    }
  }
});
