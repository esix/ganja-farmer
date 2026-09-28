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
import { SPRITE, cruiseMissile, level, levelEnding, nukeCloud, plants, savedPalette, sndNuke } from './data.js';

register(0x16fbb, 'updateCruiseMissile_16fbb', function updateCruiseMissile() {
  const c = stackAlloc(4); // [ebp-4]: RGB_color (3 bytes used), address passed to Read/Write_Color_Reg
  let i;                   // [ebp-8]
  let j;                   // [ebp-0xc]

  // 16fd3..17008: state 0x46
  if (R32((cruiseMissile + SPRITE.state)) === 0x46) {
    W32((cruiseMissile + SPRITE.currFrame), R32((cruiseMissile + SPRITE.currFrame)) + 1);
    if (R32((cruiseMissile + SPRITE.currFrame)) > 1) W32((cruiseMissile + SPRITE.currFrame), 0);
    W32(cruiseMissile, R32(cruiseMissile) + 5);
    if (R32(cruiseMissile) > 0x140) W32((cruiseMissile + SPRITE.state), 0);
  }
  // 17012..17044: state 0x45
  if (R32((cruiseMissile + SPRITE.state)) === 0x45) {
    W32((cruiseMissile + SPRITE.currFrame), R32((cruiseMissile + SPRITE.currFrame)) + 1);
    if (R32((cruiseMissile + SPRITE.currFrame)) > 3) W32((cruiseMissile + SPRITE.currFrame), 2);
    W32(cruiseMissile, R32(cruiseMissile) - 5);
    if (R32(cruiseMissile) < -0x1e) W32((cruiseMissile + SPRITE.state), 0);
  }
  // 1704e..17083
  if (R32(cruiseMissile) > 0 && R32(cruiseMissile) < 0x140) {
    W32((cruiseMissile + SPRITE.counter2), R32((cruiseMissile + SPRITE.counter2)) + 1);
    if (R32((cruiseMissile + SPRITE.counter2)) > 3) W32((cruiseMissile + SPRITE.counter2), 3);
    W32((cruiseMissile + SPRITE.y), R32((cruiseMissile + SPRITE.y)) + R32((cruiseMissile + SPRITE.counter2)));
  }
  // 17089..17100
  if (R32((cruiseMissile + SPRITE.y)) > 0xa0 && (R32((cruiseMissile + SPRITE.state)) === 0x46 || R32((cruiseMissile + SPRITE.state)) === 0x45)) {
    W32((cruiseMissile + SPRITE.state), 0x44);
    W32((cruiseMissile + SPRITE.threshold1), 0xc);
    F.Read_Palette_20618(0, 0xff, savedPalette);  // 170bf..170cb
    W32((nukeCloud + SPRITE.state), 1);
    F.dws_DPlay_1eff8(sndNuke);               // 170da..170e5 (cdecl, add esp,4)
    W32(nukeCloud, R32(cruiseMissile) - 0x28);
    W32((nukeCloud + SPRITE.y), R32((cruiseMissile + SPRITE.y)) - R32((nukeCloud + SPRITE.height)));
  }
  // 17105..172bd: state 0x44
  if (R32((cruiseMissile + SPRITE.state)) === 0x44) {
    W32((nukeCloud + SPRITE.counter2), R32((nukeCloud + SPRITE.counter2)) + 1);
    if (R32((nukeCloud + SPRITE.counter2)) === 1) {
      W32((nukeCloud + SPRITE.currFrame), R32((nukeCloud + SPRITE.currFrame)) + 1);
    } else {
      W32((nukeCloud + SPRITE.counter2), 0);
    }
    if (R32((nukeCloud + SPRITE.currFrame)) > 5) W32((nukeCloud + SPRITE.currFrame), 5);
    if (R32((cruiseMissile + SPRITE.threshold1)) > 6) {
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
    W32((cruiseMissile + SPRITE.threshold1), R32((cruiseMissile + SPRITE.threshold1)) - 1);
    if (R32((cruiseMissile + SPRITE.threshold1)) < 0) {
      W32((cruiseMissile + SPRITE.state), 0);
      W32((nukeCloud + SPRITE.state), 0);
      W32((nukeCloud + SPRITE.currFrame), 0);
      F.Write_Palette_2069f(0, 0xff, savedPalette);
    }
    // 1725c..172bd
    if (R32((cruiseMissile + SPRITE.threshold1)) < 4) {
      for (j = 0; j < 0x1a; j++) {
        if (R32((plants + SPRITE.state) + j * SPRITE.SIZE) === 1) {
          W32((plants + SPRITE.state) + j * SPRITE.SIZE, 0x29);
          W32((plants + SPRITE.counter1) + j * SPRITE.SIZE, 0xb4);
          W32((plants + SPRITE.currFrame) + j * SPRITE.SIZE, 2);
        }
      }
    }
  }
  // 172bf..1738f
  if (R32((cruiseMissile + SPRITE.state)) === 0 && R32(levelEnding) === 0) {
    // 172d9..172ec: rand() % 2 via cdq-style `sar edx,0x1f; idiv ecx` (signed remainder)
    if (imod(F.rand_232c7(), 2) === 1) {
      W32((cruiseMissile + SPRITE.state), 0x46);
      W32(cruiseMissile, (Math.imul(R32(level) - 0x14, 0x64) - 0x320) | 0);
    } else {
      W32((cruiseMissile + SPRITE.state), 0x45);
      W32(cruiseMissile, (0x320 - Math.imul(R32(level) - 0x14, 0x64)) | 0);
    }
    // 17334..17356
    if (R32((cruiseMissile + SPRITE.state)) === 0x46 && (R32(cruiseMissile) < -0x320 || R32(cruiseMissile) > -0x1e)) {
      W32(cruiseMissile, -0x1e);
    }
    // 17360..17385
    if (R32((cruiseMissile + SPRITE.state)) === 0x45 && (R32(cruiseMissile) > 0x320 || R32(cruiseMissile) < 0x15e)) {
      W32(cruiseMissile, 0x15e);
    }
    W32((cruiseMissile + SPRITE.y), 0x1e);
  }
  stackFree(4);
});
