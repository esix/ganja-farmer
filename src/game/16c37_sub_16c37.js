// 0x16c37  void sub_16c37(void)   [Watcom, no args, no return value]
// Arguments: none. The prologue (0x16c41..0x16c46) saves EBX, ECX, EDX, ESI, EDI (callee saves; per NOTES.md
// "Prologue saves exactly the non-argument registers among EBX/ECX/EDX" => 0 register args), the body writes
// EAX/EDX before any read, and the function ends with a plain `ret` (no stack args). signatures.json agrees
// (regs 0, stack 0). The "2" in functions.tsv is the callers column (callers: 0x15e42, 0x1d186), not params.
// Return: EAX holds the leftover of the last Erase_Sprite_Clip call; not set deliberately (returns: false).
// Calls Erase_Sprite_Clip(s, double_buffer) (0x211fc; 0x64e7c = double_buffer, LIBRARY.md) for a fixed list of
// structs / arrays of stride 0x18c (sprite struct size, LIBRARY.md), in the order below.
// Note: decompiled.c shows `* 99` for some loops (pointer-typed arithmetic); the disassembly uses imul 0x18c
// in every loop.
import { F, register } from '../runtime/registry.js';
import { R32 } from '../runtime/mem.js';

register(0x16c37, 'sub_16c37', function sub_16c37() {
  let i; // [ebp-4]

  F.Erase_Sprite_Clip_211fc(0x5fc04, R32(0x64e7c));
  F.Erase_Sprite_Clip_211fc(0x5fd90, R32(0x64e7c));
  F.Erase_Sprite_Clip_211fc(0x33c30, R32(0x64e7c));
  for (i = 0; i < 5; i++) {
    F.Erase_Sprite_Clip_211fc(i * 0x18c + 0x33f48, R32(0x64e7c));
  }
  for (i = 0; i < 3; i++) {
    F.Erase_Sprite_Clip_211fc(i * 0x18c + 0x3d86c, R32(0x64e7c));
  }
  for (i = 0; i < 0x3f; i++) {
    F.Erase_Sprite_Clip_211fc(i * 0x18c + 0x3de9c, R32(0x64e7c));
  }
  for (i = 0; i < 0x3f; i++) {
    F.Erase_Sprite_Clip_211fc(i * 0x18c + 0x46218, R32(0x64e7c));
  }
  for (i = 0; i < 0xc8; i++) {
    F.Erase_Sprite_Clip_211fc(i * 0x18c + 0x4c518, R32(0x64e7c));
  }
  for (i = 0; i < 4; i++) {
    F.Erase_Sprite_Clip_211fc(i * 0x18c + 0x3d23c, R32(0x64e7c));
  }
  for (i = 0; i < 1; i++) {
    F.Erase_Sprite_Clip_211fc(i * 0x18c + 0x3d0b0, R32(0x64e7c));
  }
  for (i = 0; i < 0x1a; i++) {
    F.Erase_Sprite_Clip_211fc(i * 0x18c + 0x3a878, R32(0x64e7c));
  }
  F.Erase_Sprite_Clip_211fc(0x45d74, R32(0x64e7c));
  F.Erase_Sprite_Clip_211fc(0x5fa78, R32(0x64e7c));
  F.Erase_Sprite_Clip_211fc(0x4c38c, R32(0x64e7c));
  for (i = 0; i < 0x19; i++) {
    F.Erase_Sprite_Clip_211fc(i * 0x18c + 0x35b20, R32(0x64e7c));
  }
  for (i = 0; i < 0x19; i++) {
    F.Erase_Sprite_Clip_211fc(i * 0x18c + 0x381cc, R32(0x64e7c));
  }
  F.Erase_Sprite_Clip_211fc(0x45f00, R32(0x64e7c));
  F.Erase_Sprite_Clip_211fc(0x4608c, R32(0x64e7c));
  for (i = 0; i < 0xd; i++) {
    F.Erase_Sprite_Clip_211fc(i * 0x18c + 0x34704, R32(0x64e7c));
  }
  for (i = 0; i < 7; i++) {
    F.Erase_Sprite_Clip_211fc(i * 0x18c + 0x44010, R32(0x64e7c));
  }
  for (i = 0; i < 5; i++) {
    F.Erase_Sprite_Clip_211fc(i * 0x18c + 0x44ae4, R32(0x64e7c));
  }
  for (i = 0; i < 3; i++) {
    F.Erase_Sprite_Clip_211fc(i * 0x18c + 0x452a0, R32(0x64e7c));
  }
  F.Erase_Sprite_Clip_211fc(0x33dbc, R32(0x64e7c));
  F.Erase_Sprite_Clip_211fc(0x3dd10, R32(0x64e7c));
  F.Erase_Sprite_Clip_211fc(0x33918, R32(0x64e7c));
  F.Erase_Sprite_Clip_211fc(0x33aa4, R32(0x64e7c));
});
