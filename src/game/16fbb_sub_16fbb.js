// 0x16fbb  void sub_16fbb(void)   [Watcom, no args, no return value]
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

register(0x16fbb, 'sub_16fbb', async function sub_16fbb() {
  const c = stackAlloc(4); // [ebp-4]: RGB_color (3 bytes used), address passed to Read/Write_Color_Reg
  let i;                   // [ebp-8]
  let j;                   // [ebp-0xc]

  // 16fd3..17008: state 0x46
  if (R32(0x5fd74) === 0x46) {
    W32(0x5fd6c, R32(0x5fd6c) + 1);
    if (R32(0x5fd6c) > 1) W32(0x5fd6c, 0);
    W32(0x5fc04, R32(0x5fc04) + 5);
    if (R32(0x5fc04) > 0x140) W32(0x5fd74, 0);
  }
  // 17012..17044: state 0x45
  if (R32(0x5fd74) === 0x45) {
    W32(0x5fd6c, R32(0x5fd6c) + 1);
    if (R32(0x5fd6c) > 3) W32(0x5fd6c, 2);
    W32(0x5fc04, R32(0x5fc04) - 5);
    if (R32(0x5fc04) < -0x1e) W32(0x5fd74, 0);
  }
  // 1704e..17083
  if (R32(0x5fc04) > 0 && R32(0x5fc04) < 0x140) {
    W32(0x5fc18, R32(0x5fc18) + 1);
    if (R32(0x5fc18) > 3) W32(0x5fc18, 3);
    W32(0x5fc08, R32(0x5fc08) + R32(0x5fc18));
  }
  // 17089..17100
  if (R32(0x5fc08) > 0xa0 && (R32(0x5fd74) === 0x46 || R32(0x5fd74) === 0x45)) {
    W32(0x5fd74, 0x44);
    W32(0x5fc20, 0xc);
    await F.Read_Palette_20618(0, 0xff, 0x60bd4);  // 170bf..170cb
    W32(0x5ff00, 1);
    await F.dws_DPlay_1eff8(0x614a0);               // 170da..170e5 (cdecl, add esp,4)
    W32(0x5fd90, R32(0x5fc04) - 0x28);
    W32(0x5fd94, R32(0x5fc08) - R32(0x5fd9c));
  }
  // 17105..172bd: state 0x44
  if (R32(0x5fd74) === 0x44) {
    W32(0x5fda4, R32(0x5fda4) + 1);
    if (R32(0x5fda4) === 1) {
      W32(0x5fef8, R32(0x5fef8) + 1);
    } else {
      W32(0x5fda4, 0);
    }
    if (R32(0x5fef8) > 5) W32(0x5fef8, 5);
    if (R32(0x5fc20) > 6) {
      // 17153..171b7: every DAC entry 0..0xfe: each component += 2 (byte add), clamped to 0x3f
      for (i = 0; i < 0xff; i++) {
        await F.Read_Color_Reg_205a8(i, c);
        W8(c, (R8(c) + 2) & 0xff);
        if (R8(c) > 0x3f) W8(c, 0x3f);
        W8(c + 1, (R8(c + 1) + 2) & 0xff);
        if (R8(c + 1) > 0x3f) W8(c + 1, 0x3f);
        W8(c + 2, (R8(c + 2) + 2) & 0xff);
        if (R8(c + 2) > 0x3f) W8(c + 2, 0x3f);
        await F.Write_Color_Reg_20541(i, c);
      }
    } else {
      // 171bb..1721c: every DAC entry 0..0xfe: each component += 0xfe (byte add, i.e. -2 mod 256)
      for (i = 0; i < 0xff; i++) {
        await F.Read_Color_Reg_205a8(i, c);
        W8(c, (R8(c) + 0xfe) & 0xff);
        // ORIGINAL BUG: 171e2..171e9 `xor eax,eax; mov al,[ebp-4]; test eax,eax; jge` — the byte is
        // zero-extended, so the value is never negative and the clamp to 0 never runs; a component below 2
        // wraps to 0xfe/0xff. Same for +1 (171f3..171fa) and +2 (17204..1720b).
        if (R8(c) < 0) W8(c, 0);
        W8(c + 1, (R8(c + 1) + 0xfe) & 0xff);
        if (R8(c + 1) < 0) W8(c + 1, 0);
        W8(c + 2, (R8(c + 2) + 0xfe) & 0xff);
        if (R8(c + 2) < 0) W8(c + 2, 0);
        await F.Write_Color_Reg_20541(i, c);
      }
    }
    // 1721e..17257
    W32(0x5fc20, R32(0x5fc20) - 1);
    if (R32(0x5fc20) < 0) {
      W32(0x5fd74, 0);
      W32(0x5ff00, 0);
      W32(0x5fef8, 0);
      await F.Write_Palette_2069f(0, 0xff, 0x60bd4);
    }
    // 1725c..172bd
    if (R32(0x5fc20) < 4) {
      for (j = 0; j < 0x1a; j++) {
        if (R32(0x3a9e8 + j * 0x18c) === 1) {
          W32(0x3a9e8 + j * 0x18c, 0x29);
          W32(0x3a888 + j * 0x18c, 0xb4);
          W32(0x3a9e0 + j * 0x18c, 2);
        }
      }
    }
  }
  // 172bf..1738f
  if (R32(0x5fd74) === 0 && R32(0x60bbc) === 0) {
    // 172d9..172ec: rand() % 2 via cdq-style `sar edx,0x1f; idiv ecx` (signed remainder)
    if (imod(await F.rand_232c7(), 2) === 1) {
      W32(0x5fd74, 0x46);
      W32(0x5fc04, (Math.imul(R32(0x30bec) - 0x14, 0x64) - 0x320) | 0);
    } else {
      W32(0x5fd74, 0x45);
      W32(0x5fc04, (0x320 - Math.imul(R32(0x30bec) - 0x14, 0x64)) | 0);
    }
    // 17334..17356
    if (R32(0x5fd74) === 0x46 && (R32(0x5fc04) < -0x320 || R32(0x5fc04) > -0x1e)) {
      W32(0x5fc04, -0x1e);
    }
    // 17360..17385
    if (R32(0x5fd74) === 0x45 && (R32(0x5fc04) > 0x320 || R32(0x5fc04) < 0x15e)) {
      W32(0x5fc04, 0x15e);
    }
    W32(0x5fc08, 0x1e);
  }
  stackFree(4);
});
