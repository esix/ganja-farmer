// 0x16c37  void eraseGameSprites(void)   [Watcom, no args, no return value]
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
import { SPRITE, a10Jets, bombs, bongSmoke, choppers, cropDusters, cruiseMissile, doubleBuffer, dusterSpray, explosions, groundTroops, gunSight, jah, killsDigits, levelDigits, messageBox, missile, missileSmoke, missileTarget, nukeCloud, paratroopers, plants, powerupDrop, rasta, scoreDigits, statusBar, ufo, van } from './data.js';

register(0x16c37, 'eraseGameSprites_16c37', function eraseGameSprites() {
  let i; // [ebp-4]

  F.Erase_Sprite_Clip_211fc(cruiseMissile, R32(doubleBuffer));
  F.Erase_Sprite_Clip_211fc(nukeCloud, R32(doubleBuffer));
  F.Erase_Sprite_Clip_211fc(van, R32(doubleBuffer));
  for (i = 0; i < 5; i++) {
    F.Erase_Sprite_Clip_211fc(i * SPRITE.SIZE + choppers, R32(doubleBuffer));
  }
  for (i = 0; i < 3; i++) {
    F.Erase_Sprite_Clip_211fc(i * SPRITE.SIZE + cropDusters, R32(doubleBuffer));
  }
  for (i = 0; i < 0x3f; i++) {
    F.Erase_Sprite_Clip_211fc(i * SPRITE.SIZE + dusterSpray, R32(doubleBuffer));
  }
  for (i = 0; i < 0x3f; i++) {
    F.Erase_Sprite_Clip_211fc(i * SPRITE.SIZE + missileSmoke, R32(doubleBuffer));
  }
  for (i = 0; i < 0xc8; i++) {
    F.Erase_Sprite_Clip_211fc(i * SPRITE.SIZE + bongSmoke, R32(doubleBuffer));
  }
  for (i = 0; i < 4; i++) {
    F.Erase_Sprite_Clip_211fc(i * SPRITE.SIZE + bombs, R32(doubleBuffer));
  }
  for (i = 0; i < 1; i++) {
    F.Erase_Sprite_Clip_211fc(i * SPRITE.SIZE + a10Jets, R32(doubleBuffer));
  }
  for (i = 0; i < 0x1a; i++) {
    F.Erase_Sprite_Clip_211fc(i * SPRITE.SIZE + plants, R32(doubleBuffer));
  }
  F.Erase_Sprite_Clip_211fc(jah, R32(doubleBuffer));
  F.Erase_Sprite_Clip_211fc(powerupDrop, R32(doubleBuffer));
  F.Erase_Sprite_Clip_211fc(ufo, R32(doubleBuffer));
  for (i = 0; i < 0x19; i++) {
    F.Erase_Sprite_Clip_211fc(i * SPRITE.SIZE + paratroopers, R32(doubleBuffer));
  }
  for (i = 0; i < 0x19; i++) {
    F.Erase_Sprite_Clip_211fc(i * SPRITE.SIZE + groundTroops, R32(doubleBuffer));
  }
  F.Erase_Sprite_Clip_211fc(missile, R32(doubleBuffer));
  F.Erase_Sprite_Clip_211fc(missileTarget, R32(doubleBuffer));
  for (i = 0; i < 0xd; i++) {
    F.Erase_Sprite_Clip_211fc(i * SPRITE.SIZE + explosions, R32(doubleBuffer));
  }
  for (i = 0; i < 7; i++) {
    F.Erase_Sprite_Clip_211fc(i * SPRITE.SIZE + scoreDigits, R32(doubleBuffer));
  }
  for (i = 0; i < 5; i++) {
    F.Erase_Sprite_Clip_211fc(i * SPRITE.SIZE + killsDigits, R32(doubleBuffer));
  }
  for (i = 0; i < 3; i++) {
    F.Erase_Sprite_Clip_211fc(i * SPRITE.SIZE + levelDigits, R32(doubleBuffer));
  }
  F.Erase_Sprite_Clip_211fc(rasta, R32(doubleBuffer));
  F.Erase_Sprite_Clip_211fc(messageBox, R32(doubleBuffer));
  F.Erase_Sprite_Clip_211fc(statusBar, R32(doubleBuffer));
  F.Erase_Sprite_Clip_211fc(gunSight, R32(doubleBuffer));
});
