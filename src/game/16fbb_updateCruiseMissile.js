// 0x16fbb  void updateCruiseMissile(void)   [Watcom, no args, no return value]
// Arguments: none. The prologue (0x16fc5..0x16fca) saves EBX, ECX, EDX, ESI, EDI; no register is read before
// being written, and the function ends with a plain `ret` (0x173a1, no stack args). signatures.json agrees
// (regs 0, stack 0). The single caller (0x1d63f) is followed by `call 0x12e85`, EAX not read.
// Return: EAX at the RET is a leftover (a callee result or a stored value); nothing sets it deliberately.
// Globals: 0x5fc04 and 0x5fd90 are passed as the sprite argument of Erase_Sprite_Clip by 0x16c37, so the
// offsets below are read against the sprite layout (LIBRARY.md), relative to those two bases:
//   0x5fc04 x, 0x5fc08 y, 0x5fc18 counter_2 (+0x14), 0x5fc20 threshold_1 (+0x1c), 0x5fd6c curr_frame (+0x168),
//   0x5fd74 state (+0x170);  0x5fd90 x, 0x5fd94 y, 0x5fd9c height (+0xc), 0x5fda4 counter_2 (+0x14),
//   0x5fef8 curr_frame (+0x168), 0x5ff00 state (+0x170).
// 0x60bd4: RGB_palette (LIBRARY.md). 0x614a0: dws_DPLAY passed to dws_DPlay (LIBRARY.md).
// 0x60bbc, 0x30bec: unknown globals (read only).
// 0x3a888 / 0x3a9e0 / 0x3a9e8 + i*0x18c (i < 0x1a): stride = sprite size; with a base of 0x3a878 these would be
// counter_1 (+0x10), curr_frame (+0x168), state (+0x170) (0x3a878 is a 26-sprite array: Sprite_Init loop, re/decomp/decompiled.c:4398).
import { F, register } from '../runtime/registry.js';
import { R8, R32, W8, W32 } from '../runtime/mem.js';
import { imod } from '../runtime/cpu.js';
import { stackAlloc, stackFree } from '../runtime/stack.js';
import { CRUISE_MISSILE, NUKE_CLOUD, PLANT } from './states.js';
import { cruiseMissile, nukeCloud, plants, savedPalette, sndNuke } from './data.js';
import { G, sprite } from './access.js';

register(0x16fbb, 'updateCruiseMissile_16fbb', function updateCruiseMissile() {
  const c = stackAlloc(4); // [ebp-4]: RGB_color (3 bytes used), address passed to Read/Write_Color_Reg
  let i;                   // [ebp-8]
  let j;                   // [ebp-0xc]

  // 16fd3..17008: state 0x46
  if (sprite(cruiseMissile).state === CRUISE_MISSILE.FLYING_RIGHT) {
    sprite(cruiseMissile).currFrame = sprite(cruiseMissile).currFrame + 1;
    if (sprite(cruiseMissile).currFrame > 1) sprite(cruiseMissile).currFrame = 0;
    sprite(cruiseMissile).x = sprite(cruiseMissile).x + 5;
    if (sprite(cruiseMissile).x > 0x140) sprite(cruiseMissile).state = CRUISE_MISSILE.INACTIVE;
  }
  // 17012..17044: state 0x45
  if (sprite(cruiseMissile).state === CRUISE_MISSILE.FLYING_LEFT) {
    sprite(cruiseMissile).currFrame = sprite(cruiseMissile).currFrame + 1;
    if (sprite(cruiseMissile).currFrame > 3) sprite(cruiseMissile).currFrame = 2;
    sprite(cruiseMissile).x = sprite(cruiseMissile).x - 5;
    if (sprite(cruiseMissile).x < -0x1e) sprite(cruiseMissile).state = CRUISE_MISSILE.INACTIVE;
  }
  // 1704e..17083
  if (sprite(cruiseMissile).x > 0 && sprite(cruiseMissile).x < 0x140) {
    sprite(cruiseMissile).counter2 = sprite(cruiseMissile).counter2 + 1;
    if (sprite(cruiseMissile).counter2 > 3) sprite(cruiseMissile).counter2 = 3;
    sprite(cruiseMissile).y = sprite(cruiseMissile).y + sprite(cruiseMissile).counter2;
  }
  // 17089..17100
  if (sprite(cruiseMissile).y > 0xa0 && (sprite(cruiseMissile).state === CRUISE_MISSILE.FLYING_RIGHT || sprite(cruiseMissile).state === CRUISE_MISSILE.FLYING_LEFT)) {
    sprite(cruiseMissile).state = CRUISE_MISSILE.DETONATED;
    sprite(cruiseMissile).threshold1 = 0xc;
    F.Read_Palette_20618(0, 0xff, savedPalette);  // 170bf..170cb
    sprite(nukeCloud).state = NUKE_CLOUD.VISIBLE;
    F.dws_DPlay_1eff8(sndNuke);               // 170da..170e5 (cdecl, add esp,4)
    sprite(nukeCloud).x = sprite(cruiseMissile).x - 0x28;
    sprite(nukeCloud).y = sprite(cruiseMissile).y - sprite(nukeCloud).height;
  }
  // 17105..172bd: state 0x44
  if (sprite(cruiseMissile).state === CRUISE_MISSILE.DETONATED) {
    sprite(nukeCloud).counter2 = sprite(nukeCloud).counter2 + 1;
    if (sprite(nukeCloud).counter2 === 1) {
      sprite(nukeCloud).currFrame = sprite(nukeCloud).currFrame + 1;
    } else {
      sprite(nukeCloud).counter2 = 0;
    }
    if (sprite(nukeCloud).currFrame > 5) sprite(nukeCloud).currFrame = 5;
    if (sprite(cruiseMissile).threshold1 > 6) {
      // 17153..171b7: every DAC entry 0..0xfe: each component += 2 (byte add), clamped to 0x3f
      for (i = 0; i < 0xff; i++) {
        F.Read_Color_Reg_205a8(i, c);
        W8(c, (R8(c) + 2) & 0xff);
        if (R8(c) > 0x3f) W8(c, 0x3f);
        W8(c + 1, (R8(c + 1) + 2) & 0xff);
        if (R8(c + 1) > 0x3f) W8(c + 1, 0x3f);
        W8(c + 2, (R8(c + 2) + 2) & 0xff);
        if (R8(c + 2) > 0x3f) W8(c + 2, 0x3f);
        F.Write_Color_Reg_20541(i, c);
      }
    } else {
      // 171bb..1721c: every DAC entry 0..0xfe: each component += 0xfe (byte add, i.e. -2 mod 256)
      for (i = 0; i < 0xff; i++) {
        F.Read_Color_Reg_205a8(i, c);
        W8(c, (R8(c) + 0xfe) & 0xff);
        // ORIGINAL BUG: 171e2..171e9 `xor eax,eax; mov al,[ebp-4]; test eax,eax; jge` — the byte is
        // zero-extended, so the value is never negative and the clamp to 0 never runs; a component below 2
        // wraps to 0xfe/0xff. Same for +1 (171f3..171fa) and +2 (17204..1720b).
        if (R8(c) < 0) W8(c, 0);
        W8(c + 1, (R8(c + 1) + 0xfe) & 0xff);
        if (R8(c + 1) < 0) W8(c + 1, 0);
        W8(c + 2, (R8(c + 2) + 0xfe) & 0xff);
        if (R8(c + 2) < 0) W8(c + 2, 0);
        F.Write_Color_Reg_20541(i, c);
      }
    }
    // 1721e..17257
    sprite(cruiseMissile).threshold1 = sprite(cruiseMissile).threshold1 - 1;
    if (sprite(cruiseMissile).threshold1 < 0) {
      sprite(cruiseMissile).state = CRUISE_MISSILE.INACTIVE;
      sprite(nukeCloud).state = NUKE_CLOUD.HIDDEN;
      sprite(nukeCloud).currFrame = 0;
      F.Write_Palette_2069f(0, 0xff, savedPalette);
    }
    // 1725c..172bd
    if (sprite(cruiseMissile).threshold1 < 4) {
      for (j = 0; j < 0x1a; j++) {
        if (sprite(plants, j).state === PLANT.ALIVE) {
          sprite(plants, j).state = PLANT.BURNING;
          sprite(plants, j).counter1 = 0xb4;
          sprite(plants, j).currFrame = 2;
        }
      }
    }
  }
  // 172bf..1738f
  if (sprite(cruiseMissile).state === CRUISE_MISSILE.INACTIVE && G.levelEnding === 0) {
    // 172d9..172ec: rand() % 2 via cdq-style `sar edx,0x1f; idiv ecx` (signed remainder)
    if (imod(F.rand_232c7(), 2) === 1) {
      sprite(cruiseMissile).state = CRUISE_MISSILE.FLYING_RIGHT;
      sprite(cruiseMissile).x = (Math.imul(G.level - 0x14, 0x64) - 0x320) | 0;
    } else {
      sprite(cruiseMissile).state = CRUISE_MISSILE.FLYING_LEFT;
      sprite(cruiseMissile).x = (0x320 - Math.imul(G.level - 0x14, 0x64)) | 0;
    }
    // 17334..17356
    if (sprite(cruiseMissile).state === CRUISE_MISSILE.FLYING_RIGHT && (sprite(cruiseMissile).x < -0x320 || sprite(cruiseMissile).x > -0x1e)) {
      sprite(cruiseMissile).x = -0x1e;
    }
    // 17360..17385
    if (sprite(cruiseMissile).state === CRUISE_MISSILE.FLYING_LEFT && (sprite(cruiseMissile).x > 0x320 || sprite(cruiseMissile).x < 0x15e)) {
      sprite(cruiseMissile).x = 0x15e;
    }
    sprite(cruiseMissile).y = 0x1e;
  }
  stackFree(4);
});
