// 0x15e15  void runLevelEndSequence(void)   [Watcom, no args, no return value]
// Size 0x631 bytes (0x15e15..0x16445 RET).
// Args: none — EAX/EDX/EBX/ECX are loaded before any read; EBX/ECX/EDX/ESI/EDI/EBP are saved/restored
// (0x15e1f..0x15e24 / 0x1643f..0x16444). signatures.json: regs 0, stack 0.
// Return: none — EAX at the RET is clearEnemies's leftover; the only call site (0x15ded) is followed by
// 0x15df2 `inc dword [0x30bec]`, which does not read EAX. signatures.json returns=false.
// Summary (facts from the disassembly):
//   eraseGameSprites(); Draw_Sprite_Clip(s, [0x64e7c], 1) for 0x33918, 0x44010 + i*0x18c (i<7), 0x44ae4 + i*0x18c
//   (i<4), 0x452a0 + i*0x18c (i<3), 0x33c30; stores constants to globals (below); scans the 26 structs
//   0x3a878 + i*0x18c for the longest run of consecutive dword [+0x170] == 0 and stores dword [+0] of the
//   struct at the start of that run to [0x60bcc] (initially -1; strict `>` so the first longest run wins);
//   then loops while [0x30bf4] == 0x22 ([0x30bf4] is set to 0x22 right before the loop):
//     [0x60a64] = Timer_Query(); cycleRastaColors(); Erase_Sprite_Clip for a list of structs; [0x60bc4] = 1;
//     updatePlayer(); updateStatusDigits(); updateJahReplant(); updatePlants(); Behind_Sprite_Clip for the list;
//     Draw_Sprite_Clip(.., 1) for the list; Show_Double_Buffer([0x64e7c], 0);
//     waits until Timer_Query() - [0x60a64] >= 1 (signed, jge) calling updateMusic();
//   after the loop: activateA10Jet(); [0x60bc4] = 0; clearEnemies().
// Evidence: [0x64e7c] = double_buffer (LIBRARY.md). The addresses passed to Draw/Erase/Behind_Sprite_Clip are
// sprite* (LIBRARY.md sprite, size 0x18c). Hence:
//   0x45d74 is a sprite: 0x45d74 x (+0), 0x45d78 y (+4), 0x45d80 height (+0xc), 0x45d88 counter_2 (+0x14),
//     0x45ee4 state (+0x170).
//   0x3dd10 is a sprite: 0x3de78 = 0x3dd10 + 0x168 curr_frame.
//   0x3a878 + i*0x18c are sprites: +0x170 (0x3a9e8) state, +0 x.
//   0x33dbc is a sprite: 0x33f24 = 0x33dbc + 0x168 (curr_frame), 0x33f2c = 0x33dbc + 0x170 (state).
//   UNCERTAIN: LIBRARY.md lists 0x33f24 among "game arrays" of sprites; here only the arithmetic above is used.
// 0x30bec, 0x30be8, 0x30bf8, 0x60ee4, 0x60bcc, 0x60bc4, 0x30bf4, 0x60a64: address only (0x60a64 holds the
// Timer_Query value stored at 0x16047 and is subtracted at 0x16412).
// Frame (sub esp,0x10): [ebp-0x10] i (loop counter), [ebp-0xc] k (start index of the run), [ebp-8] run
// (current run length), [ebp-4] best (longest run). No address is taken and every slot is written before it
// is read, so they are plain locals.
// Busy-wait note: the loop 0x1640d..0x16422 exits on the BIOS tick (Timer_Query). Its only body call, updateMusic,
// calls dws_MSongStatus / dws_MPlay / dws_DPlay (10050_sub_10050.js), which do not yield, so the loop gets
// `await yieldCpu()`. The outer loop (0x16035) contains that wait loop, so it yields on every pass.
// All dword comparisons signed (jge/jle/jne). No x87 instructions.
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';
import { yieldCpu } from '../runtime/cpu.js';
import { JAH, LEVEL_END_LOOP, PLANT, RASTA } from './states.js';
import { gunSight, jah, killsDigits, levelDigits, messageBox, plants, rasta, scoreDigits, statusBar, van } from './data.js';
import { G, sprite } from './access.js';

register(0x15e15, 'runLevelEndSequence_15e15', async function runLevelEndSequence() {
  let i;    // [ebp-0x10]
  let k;    // [ebp-0xc]
  let run;  // [ebp-8]
  let best; // [ebp-4]

  k = 0;                                                                      // 0x15e2d
  run = 0;                                                                    // 0x15e34
  best = 0;                                                                   // 0x15e3b
  F.eraseGameSprites_16c37();                                                        // 0x15e42
  F.Draw_Sprite_Clip_212c0(statusBar, G.doubleBuffer, 1);                   // 0x15e47..0x15e57
  // 0x15e5c..0x15e8f (mov eax,[ebp-0x10] at 0x15e65 is a dead load, same in every loop below)
  for (i = 0; i < 7; i++) {
    F.Draw_Sprite_Clip_212c0(sprite(scoreDigits, i).addr, G.doubleBuffer, 1);
  }
  for (i = 0; i < 4; i++) {                                                   // 0x15e91..0x15ec4
    F.Draw_Sprite_Clip_212c0(sprite(killsDigits, i).addr, G.doubleBuffer, 1);
  }
  for (i = 0; i < 3; i++) {                                                   // 0x15ec6..0x15ef9
    F.Draw_Sprite_Clip_212c0(sprite(levelDigits, i).addr, G.doubleBuffer, 1);
  }
  F.Draw_Sprite_Clip_212c0(van, G.doubleBuffer, 1);                   // 0x15efb..0x15f0b
  sprite(rasta).state = RASTA.LIGHTING_UP;                                                         // 0x15f10
  sprite(rasta).currFrame = 0xa;                                                          // 0x15f1a
  G.rastaAnimDelay = 0;                                                            // 0x15f24
  G.idleTimer = 0x64;                                                         // 0x15f2e
  G.smokeGlowPhase = 2;                                                            // 0x15f38
  sprite(jah).x = 0;                                                            // 0x15f42
  sprite(jah).y = sprite(jah).height;                                                 // 0x15f4c..0x15f51
  sprite(jah).y = -sprite(jah).y | 0;                                            // 0x15f56 neg dword
  sprite(jah).state = JAH.DESCENDING_TO_REPLANT;                                                         // 0x15f5c
  sprite(jah).counter2 = Math.imul(G.level, 0xa);                                 // 0x15f66..0x15f6e
  sprite(messageBox).currFrame = 0;                                                            // 0x15f73
  k = 0;                                                                      // 0x15f7d
  run = 0;                                                                    // 0x15f84
  best = 0;                                                                   // 0x15f8b
  G.jahReplantX = -1;                                                           // 0x15f92
  // 0x15f9c..0x15ff9: for (i = 0; i < 0x1a; i++)
  for (i = 0; i < 0x1a; i++) {
    if (sprite(plants, i).state === PLANT.DEAD) {                     // 0x15fb1..0x15fbf
      run = (run + 1) | 0;                                                    // 0x15fc1..0x15fc4
    } else {
      if (run > best) {                                                       // 0x15fc9..0x15fcf (jle: signed)
        best = run;                                                           // 0x15fd1..0x15fd4
        k = (i - run) | 0;                                                    // 0x15fd7..0x15fdd
        G.jahReplantX = sprite(plants, k).x;               // 0x15fe0..0x15fed
      }
      run = 0;                                                                // 0x15ff2
    }
  }
  // 0x15ffb..0x16024: same test once more after the loop (i == 0x1a here)
  if (run > best) {                                                           // 0x15ffb..0x16001 (jle: signed)
    best = run;                                                               // 0x16003..0x16006
    k = (i - run) | 0;                                                        // 0x16009..0x1600f
    G.jahReplantX = sprite(plants, k).x;                   // 0x16012..0x1601f
  }
  run = 0;                                                                    // 0x16024
  G.levelEndLoopState = LEVEL_END_LOOP.RUNNING;                                                         // 0x1602b

  // 0x16035: cmp dword [0x30bf4], 0x22; jne 0x16429
  while (G.levelEndLoopState === LEVEL_END_LOOP.RUNNING) {
    G.frameStartTime = F.Timer_Query_235f9();                                // 0x16042..0x16047
    F.cycleRastaColors_14fba();                                                      // 0x1604c
    F.Erase_Sprite_Clip_211fc(van, G.doubleBuffer);                   // 0x16051..0x1605c
    F.Erase_Sprite_Clip_211fc(rasta, G.doubleBuffer);                   // 0x16061..0x1606c
    F.Erase_Sprite_Clip_211fc(statusBar, G.doubleBuffer);                   // 0x16071..0x1607c
    F.Erase_Sprite_Clip_211fc(messageBox, G.doubleBuffer);                   // 0x16081..0x1608c
    F.Erase_Sprite_Clip_211fc(gunSight, G.doubleBuffer);                   // 0x16091..0x1609c
    F.Erase_Sprite_Clip_211fc(jah, G.doubleBuffer);                   // 0x160a1..0x160ac
    for (i = 0; i < 0x1a; i++) {                                              // 0x160b1..0x160df
      F.Erase_Sprite_Clip_211fc(sprite(plants, i).addr, G.doubleBuffer);
    }
    for (i = 0; i < 7; i++) {                                                 // 0x160e1..0x1610f
      F.Erase_Sprite_Clip_211fc(sprite(scoreDigits, i).addr, G.doubleBuffer);
    }
    for (i = 0; i < 5; i++) {                                                 // 0x16111..0x1613f
      F.Erase_Sprite_Clip_211fc(sprite(killsDigits, i).addr, G.doubleBuffer);
    }
    for (i = 0; i < 3; i++) {                                                 // 0x16141..0x1616f
      F.Erase_Sprite_Clip_211fc(sprite(levelDigits, i).addr, G.doubleBuffer);
    }
    G.inLevelEndSequence = 1;                                                          // 0x16171
    F.updatePlayer_18f27();                                                      // 0x1617b
    F.updateStatusDigits_15788();                                                      // 0x16180
    F.updateJahReplant_16837();                                                      // 0x16185
    F.updatePlants_14425();                                                      // 0x1618a
    F.Behind_Sprite_Clip_2106f(van, G.doubleBuffer);                  // 0x1618f..0x1619a
    F.Behind_Sprite_Clip_2106f(rasta, G.doubleBuffer);                  // 0x1619f..0x161aa
    F.Behind_Sprite_Clip_2106f(statusBar, G.doubleBuffer);                  // 0x161af..0x161ba
    F.Behind_Sprite_Clip_2106f(messageBox, G.doubleBuffer);                  // 0x161bf..0x161ca
    F.Behind_Sprite_Clip_2106f(jah, G.doubleBuffer);                  // 0x161cf..0x161da
    F.Behind_Sprite_Clip_2106f(gunSight, G.doubleBuffer);                  // 0x161df..0x161ea
    for (i = 0; i < 0x1a; i++) {                                              // 0x161ef..0x1621d
      F.Behind_Sprite_Clip_2106f(sprite(plants, i).addr, G.doubleBuffer);
    }
    for (i = 0; i < 7; i++) {                                                 // 0x1621f..0x1624d
      F.Behind_Sprite_Clip_2106f(sprite(scoreDigits, i).addr, G.doubleBuffer);
    }
    for (i = 0; i < 5; i++) {                                                 // 0x1624f..0x1627d
      F.Behind_Sprite_Clip_2106f(sprite(killsDigits, i).addr, G.doubleBuffer);
    }
    for (i = 0; i < 3; i++) {                                                 // 0x1627f..0x162ad
      F.Behind_Sprite_Clip_2106f(sprite(levelDigits, i).addr, G.doubleBuffer);
    }
    for (i = 0; i < 0x1a; i++) {                                              // 0x162af..0x162e2
      F.Draw_Sprite_Clip_212c0(sprite(plants, i).addr, G.doubleBuffer, 1);
    }
    F.Draw_Sprite_Clip_212c0(messageBox, G.doubleBuffer, 1);                 // 0x162e4..0x162f4
    F.Draw_Sprite_Clip_212c0(jah, G.doubleBuffer, 1);                 // 0x162f9..0x16309
    F.Draw_Sprite_Clip_212c0(van, G.doubleBuffer, 1);                 // 0x1630e..0x1631e
    F.Draw_Sprite_Clip_212c0(rasta, G.doubleBuffer, 1);                 // 0x16323..0x16333
    F.Draw_Sprite_Clip_212c0(statusBar, G.doubleBuffer, 1);                 // 0x16338..0x16348
    for (i = 0; i < 7; i++) {                                                 // 0x1634d..0x16380
      F.Draw_Sprite_Clip_212c0(sprite(scoreDigits, i).addr, G.doubleBuffer, 1);
    }
    for (i = 0; i < 4; i++) {                                                 // 0x16382..0x163b5
      F.Draw_Sprite_Clip_212c0(sprite(killsDigits, i).addr, G.doubleBuffer, 1);
    }
    for (i = 0; i < 3; i++) {                                                 // 0x163b7..0x163ea
      F.Draw_Sprite_Clip_212c0(sprite(levelDigits, i).addr, G.doubleBuffer, 1);
    }
    F.Draw_Sprite_Clip_212c0(gunSight, G.doubleBuffer, 1);                 // 0x163ec..0x163fc
    F.Show_Double_Buffer_21531(G.doubleBuffer, 0);                        // 0x16401..0x16408
    // 0x1640d..0x16422: while (Timer_Query() - [0x60a64] < 1) updateMusic();  (cmp eax,1; jge: signed)
    // Busy-wait on the clock; updateMusic does not yield (see header), so the loop yields.
    while ((((F.Timer_Query_235f9()) - G.frameStartTime) | 0) < 1) {
      F.updateMusic_10050();                                                    // 0x1641d
      await yieldCpu();
    }
  }                                                                           // 0x16424 jmp 0x16035
  F.activateA10Jet_15c34();                                                        // 0x16429
  G.inLevelEndSequence = 0;                                                            // 0x1642e
  F.clearEnemies_1a825();                                                        // 0x16438
});
