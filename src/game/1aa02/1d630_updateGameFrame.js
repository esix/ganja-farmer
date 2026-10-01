// main (0x1aa02) chunk G2: range [0x1d630, 0x1db3a)
// Entry 0x1d630, single exit 0x1db3a (falls through to chunk G3, drawGameFrame).
// No live registers/locals at either end (MAIN_PLAN.md §2). Local: [ebp-8] (chunk-local let).
// Contents: 18 unconditional game calls (0x1d630..0x1d685); stores to [0x30bec] under keyboard_state tests
// (0x64f04 = keyboard_state[128], int32 per make scancode, LIBRARY.md), five of them followed by activateA10Jet;
// applyLevelEnemyLimits; conditional toggles/stores of [0x60edc] depending on [0x60ee8] / [0x60edc] / [0x60b50];
// Behind_Sprite_Clip(sprite, [0x64e7c]) on single sprites and in 14 counted loops (stride 0x18c);
// two conditional Draw_Sprite_Clip(sprite, [0x64e7c], 1).
// Callees: updatePlayer, updateJahPowerupDrop, updateBullets, updateCruiseMissile, updateChoppers, updateParatroopers, updateExplosions, updateA10Jet, updateBombs,
// updatePlants, updateCropDusters, updateDusterSpray, updateStatusDigits, updateMissile, updateMissileSmoke, updateBongSmoke, updateUfo, cycleRastaColors,
// activateA10Jet x5, applyLevelEnemyLimits (all: no args, no return value used), Behind_Sprite_Clip_2106f (EAX sprite,
// EDX buffer) 26 call sites, Draw_Sprite_Clip_212c0 (EAX sprite, EDX buffer, EBX transparent) 2 call sites.
// 0x64e7c = double_buffer (LIBRARY.md "Key globals"); it is re-read before every call as in the binary.
// The `mov eax,[ebp-8]` before every `inc [ebp-8]` is a dead read and produces nothing.
import { F } from '../../runtime/registry.js';
import { R32, W32 } from '../../runtime/mem.js';
import { CRUISE_MISSILE, NUKE_CLOUD, WEAPON } from '../states.js';
import { KEY, a10Jets, bombs, bongSmoke, choppers, cropDusters, cruiseMissile, dusterSpray, explosions, groundTroops, gunSight, jah, killsDigits, levelDigits, messageBox, missile, missileSmoke, missileTarget, nukeCloud, paratroopers, plants, powerupDrop, rasta, scoreDigits, statusBar, ufo, van } from '../data.js';
import { G, keyDown, sprite } from '../access.js';

// STAGE 2 CHANGE (gameplay, by request): while the left button is held, the default gun fires again every
// DEFAULT_GUN_REPEAT_FRAMES game frames (the game loop runs at ~18 frames/s, so 3 -> ~6 shots/s, about the pace of
// fast clicking; the automatic gun, which fires every other frame, ~9 shots/s, stays faster). A press still fires
// at once and a release still re-arms at once.
const DEFAULT_GUN_REPEAT_FRAMES = 3;
let defaultGunHeldFrames = 0;

export function updateGameFrame() {
  let i; // [ebp-8]

  F.updatePlayer_18f27();                                           // 1d630
  F.updateJahPowerupDrop_16446();                                           // 1d635
  F.updateBullets_12130();                                           // 1d63a
  F.updateCruiseMissile_16fbb();                                           // 1d63f
  F.updateChoppers_12e85();                                           // 1d644
  F.updateParatroopers_136a5();                                           // 1d649
  F.updateExplosions_135bb();                                           // 1d64e
  F.updateA10Jet_14690();                                           // 1d653
  F.updateBombs_14c6a();                                           // 1d658
  F.updatePlants_14425();                                           // 1d65d
  F.updateCropDusters_15127();                                           // 1d662
  F.updateDusterSpray_1556a();                                           // 1d667
  F.updateStatusDigits_15788();                                           // 1d66c
  F.updateMissile_173a2();                                           // 1d671
  F.updateMissileSmoke_185bf();                                           // 1d676
  F.updateBongSmoke_19ade();                                           // 1d67b
  F.updateUfo_18a58();                                           // 1d680
  F.cycleRastaColors_14fba();                                           // 1d685

  // keyboard_state[scancode] tests (address = 0x64f04 + scancode*4)
  if (keyDown(KEY.a) !== 0) {                                      // 1d68a..1d691 keyboard_state[0x1e]
    G.level = 0xe;                                           // 1d693
  }
  if (keyDown(KEY.d3) !== 0) {                                      // 1d69d..1d6a4 keyboard_state[0x04]
    G.level = 3;                                             // 1d6a6
  }
  if (keyDown(KEY.d5) !== 0) {                                      // 1d6b0..1d6b7 keyboard_state[0x06]
    G.level = 5;                                             // 1d6b9
    F.activateA10Jet_15c34();                                         // 1d6c3
  }
  if (keyDown(KEY.d6) !== 0) {                                      // 1d6c8..1d6cf keyboard_state[0x07]
    G.level = 6;                                             // 1d6d1
    F.activateA10Jet_15c34();                                         // 1d6db
  }
  if (keyDown(KEY.d7) !== 0) {                                      // 1d6e0..1d6e7 keyboard_state[0x08]
    G.level = 7;                                             // 1d6e9
    F.activateA10Jet_15c34();                                         // 1d6f3
  }
  if (keyDown(KEY.d8) !== 0) {                                      // 1d6f8..1d6ff keyboard_state[0x09]
    G.level = 8;                                             // 1d701
    F.activateA10Jet_15c34();                                         // 1d70b
  }
  if (keyDown(KEY.d9) !== 0) {                                      // 1d710..1d717 keyboard_state[0x0a]
    G.level = 9;                                             // 1d719
    F.activateA10Jet_15c34();                                         // 1d723
  }
  F.applyLevelEnemyLimits_159e7();                                           // 1d728

  // 1d72d..1d748: ([0x60ee8] == 0x37 || [0x60ee8] == 0x38 || [0x60ee8] == 0x35) -> 1d74a, else -> 1d769
  // ([0x60ee8] is re-read from memory by each cmp)
  if (G.currentWeapon === WEAPON.AUTO_GUN || G.currentWeapon === WEAPON.BONG || G.currentWeapon === WEAPON.MISSILE_LAUNCHER) {
    if (G.fireReady === 1) {                                    // 1d74a..1d751
      G.fireReady = 0;                                           // 1d753 (jmp 1d769)
    } else {
      G.fireReady = 1;                                           // 1d75f
    }
  }
  // 1d769..1d786: if [0x60ee8] == 0x36: [0x60edc] != 0 -> skip (1d784 jmp 1d790);
  //               else [0x60b50] == 1 -> skip; else [0x60edc] = 1
  if (G.currentWeapon === WEAPON.DEFAULT_GUN) {                                   // 1d769..1d770
    if (!(G.fireReady !== 0 || G.mouseButtons === 1)) {           // 1d772..1d782
      G.fireReady = 1;                                           // 1d786
      defaultGunHeldFrames = 0;
    } else if (G.fireReady === 0 && G.mouseButtons === 1 && ++defaultGunHeldFrames >= DEFAULT_GUN_REPEAT_FRAMES) {
      // STAGE 2 CHANGE (gameplay, by request): holding the button repeats the default gun, so it no longer
      // needs a click per shot. The original re-armed it only on release (above).
      G.fireReady = 1;
      defaultGunHeldFrames = 0;
    }
  }

  F.Behind_Sprite_Clip_2106f(van, G.doubleBuffer);       // 1d790..1d79b
  F.Behind_Sprite_Clip_2106f(cruiseMissile, G.doubleBuffer);       // 1d7a0..1d7ab
  for (i = 0; i < 4; i++) {                                      // 1d7b0..1d7c3, 1d7de
    F.Behind_Sprite_Clip_2106f(sprite(bombs, i).addr, G.doubleBuffer); // 1d7c5..1d7d9
  }
  for (i = 0; i < 5; i++) {                                      // 1d7e0..1d7f3, 1d80e
    F.Behind_Sprite_Clip_2106f(sprite(choppers, i).addr, G.doubleBuffer); // 1d7f5..1d809
  }
  for (i = 0; i < 3; i++) {                                      // 1d810..1d823, 1d83e
    F.Behind_Sprite_Clip_2106f(sprite(cropDusters, i).addr, G.doubleBuffer); // 1d825..1d839
  }
  for (i = 0; i < 0x3f; i++) {                                   // 1d840..1d853, 1d86e
    F.Behind_Sprite_Clip_2106f(sprite(dusterSpray, i).addr, G.doubleBuffer); // 1d855..1d869
  }
  for (i = 0; i < 0x3f; i++) {                                   // 1d870..1d883, 1d89e
    F.Behind_Sprite_Clip_2106f(sprite(missileSmoke, i).addr, G.doubleBuffer); // 1d885..1d899
  }
  for (i = 0; i < 0xc8; i++) {                                   // 1d8a0..1d8b6, 1d8d1
    F.Behind_Sprite_Clip_2106f(sprite(bongSmoke, i).addr, G.doubleBuffer); // 1d8b8..1d8cc
  }
  for (i = 0; i < 1; i++) {                                      // 1d8d3..1d8e6, 1d901
    F.Behind_Sprite_Clip_2106f(sprite(a10Jets, i).addr, G.doubleBuffer); // 1d8e8..1d8fc
  }
  F.Behind_Sprite_Clip_2106f(missile, G.doubleBuffer);       // 1d903..1d90e
  F.Behind_Sprite_Clip_2106f(missileTarget, G.doubleBuffer);       // 1d913..1d91e
  F.Behind_Sprite_Clip_2106f(ufo, G.doubleBuffer);       // 1d923..1d92e
  F.Behind_Sprite_Clip_2106f(powerupDrop, G.doubleBuffer);       // 1d933..1d93e
  for (i = 0; i < 0x1a; i++) {                                   // 1d943..1d956, 1d971
    F.Behind_Sprite_Clip_2106f(sprite(plants, i).addr, G.doubleBuffer); // 1d958..1d96c
  }
  F.Behind_Sprite_Clip_2106f(jah, G.doubleBuffer);       // 1d973..1d97e
  for (i = 0; i < 0x19; i++) {                                   // 1d983..1d996, 1d9b1
    F.Behind_Sprite_Clip_2106f(sprite(paratroopers, i).addr, G.doubleBuffer); // 1d998..1d9ac
  }
  for (i = 0; i < 0x19; i++) {                                   // 1d9b3..1d9c6, 1d9e1
    F.Behind_Sprite_Clip_2106f(sprite(groundTroops, i).addr, G.doubleBuffer); // 1d9c8..1d9dc
  }
  for (i = 0; i < 0xd; i++) {                                    // 1d9e3..1d9f6, 1da11
    F.Behind_Sprite_Clip_2106f(sprite(explosions, i).addr, G.doubleBuffer); // 1d9f8..1da0c
  }
  F.Behind_Sprite_Clip_2106f(rasta, G.doubleBuffer);       // 1da13..1da1e
  F.Behind_Sprite_Clip_2106f(messageBox, G.doubleBuffer);       // 1da23..1da2e
  for (i = 0; i < 7; i++) {                                      // 1da33..1da46, 1da61
    F.Behind_Sprite_Clip_2106f(sprite(scoreDigits, i).addr, G.doubleBuffer); // 1da48..1da5c
  }
  for (i = 0; i < 5; i++) {                                      // 1da63..1da76, 1da91
    F.Behind_Sprite_Clip_2106f(sprite(killsDigits, i).addr, G.doubleBuffer); // 1da78..1da8c
  }
  for (i = 0; i < 3; i++) {                                      // 1da93..1daa6, 1dac1
    F.Behind_Sprite_Clip_2106f(sprite(levelDigits, i).addr, G.doubleBuffer); // 1daa8..1dabc
  }
  F.Behind_Sprite_Clip_2106f(gunSight, G.doubleBuffer);       // 1dac3..1dace
  F.Behind_Sprite_Clip_2106f(statusBar, G.doubleBuffer);       // 1dad3..1dade
  F.Behind_Sprite_Clip_2106f(nukeCloud, G.doubleBuffer);       // 1dae3..1daee

  // 1daf3..1db05: [0x5fd74] (= 0x5fc04 + 0x170, sprite `state`, LIBRARY.md) == 0 or == 0x44 -> skip to 1db1c
  if (!(sprite(cruiseMissile).state === CRUISE_MISSILE.INACTIVE || sprite(cruiseMissile).state === CRUISE_MISSILE.DETONATED)) {
    F.Draw_Sprite_Clip_212c0(cruiseMissile, G.doubleBuffer, 1);    // 1db07..1db17
  }
  // 1db1c..1db23: [0x5ff00] (= 0x5fd90 + 0x170, sprite `state`, LIBRARY.md) != 1 -> exit 1db3a
  if (sprite(nukeCloud).state === NUKE_CLOUD.VISIBLE) {
    F.Draw_Sprite_Clip_212c0(nukeCloud, G.doubleBuffer, 1);    // 1db25..1db35
  }
}
