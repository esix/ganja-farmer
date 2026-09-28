// 0x1aa02  int main(eax, edx)   [Watcom main; frame 0x1c; ends at RET 0x1e0c7]
// Skeleton only: the body between the listed addresses is split into chunks (re/agents/MAIN_PLAN.md §2),
// each in src/game/1aa02/chunk_<start>.js with one entry, one exit and no live registers/locals at
// either boundary. This file holds the prologue, the three outer loops, the calls between chunks and the
// epilogue: 0x1aa02..0x1aa26, 0x1cbe4..0x1cc3c, 0x1d0b4..0x1d0c1, 0x1dffd, 0x1e002..0x1e018, 0x1e0be..0x1e0c7.
// Arguments: EAX and EDX are stored to [ebp-0x14]/[ebp-0x10] and never read (MAIN_PLAN §1.1).
// Return value: 0 (0x1e0be xor eax,eax); the caller 0x24f89 passes EAX on to 0x28bdc (MAIN_PLAN §1).
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';
import { initSystemAndLoadSprites } from './1aa02/1aa26_initSystemAndLoadSprites.js';
import { loadMenuAndGroundSprites } from './1aa02/1af47_loadMenuAndGroundSprites.js';
import { loadAircraftAndHudSprites } from './1aa02/1b4b9_loadAircraftAndHudSprites.js';
import { loadCharacterSprites } from './1aa02/1b9a9_loadCharacterSprites.js';
import { loadMusicAndSounds } from './1aa02/1bed0_loadMusicAndSounds.js';
import { loadMoreSoundsAndShowLogos } from './1aa02/1c567_loadMoreSoundsAndShowLogos.js';
import { startNewGame } from './1aa02/1cc3c_startNewGame.js';
import { handleFrameInput } from './1aa02/1d0c1_handleFrameInput.js';
import { updateGameFrame } from './1aa02/1d630_updateGameFrame.js';
import { drawGameFrame } from './1aa02/1db3a_drawGameFrame.js';
import { shutdown } from './1aa02/1e018_shutdown.js';
import { SPRITE, gameState, jah } from './data.js';

register(0x1aa02, 'main_1aa02', async function main(a1, a2) {
  // 0x1aa02..0x1aa13: __CHK(0x50) omitted; push ebx,ecx,esi,edi,ebp; mov ebp,esp; sub esp,0x1c
  // (no address-taken locals: MAIN_PLAN §1.1)
  let v14 = a1;   // 0x1aa19 [ebp-0x14] = EAX  (never read)
  let v10 = a2;   // 0x1aa1c [ebp-0x10] = EDX  (never read)
  let v0c = 0;    // 0x1aa1f [ebp-0xc]  = 0    (never read)
  initSystemAndLoadSprites();                                       // I1 0x1aa26..0x1af47
  loadMenuAndGroundSprites();                                       // I2 0x1af47..0x1b4b9
  loadAircraftAndHudSprites();                                       // I3 0x1b4b9..0x1b9a9
  loadCharacterSprites();                                       // I4 0x1b9a9..0x1bed0
  loadMusicAndSounds();                                       // I5 0x1bed0..0x1c567
  await loadMoreSoundsAndShowLogos();                                       // I6 0x1c567..0x1cbe4
  for (;;) {
    if (R32(gameState) === 0x25) break;                        // 0x1cbe4 cmp [0x30be4],0x25; je 0x1e018
    await F.runMainMenu_11659();                                     // 0x1cbf1
    F.Fill_Screen_20768(0);                            // 0x1cbf6 xor eax,eax; 0x1cbf8 call
    if (R32(gameState) === 0x25) break;                        // 0x1cbfd cmp; 0x1cc04 jne; 0x1cc06 jmp 0x1e018
    W32(jah, 0);                                         // 0x1cc0b
    W32((jah + SPRITE.y), R32((jah + SPRITE.height)));                              // 0x1cc15..0x1cc1a
    W32((jah + SPRITE.y), -R32((jah + SPRITE.y)) | 0);                         // 0x1cc1f neg dword [0x45d78]
    W32((jah + SPRITE.state), 0x21);                                      // 0x1cc25
    while (R32(gameState) !== 0x1c) {                          // 0x1cc2f cmp [0x30be4],0x1c; je 0x1e013
      startNewGame();                                   // L1 0x1cc3c..0x1d0b4
      while (R32(gameState) !== 0x1c) {                        // 0x1d0b4 cmp [0x30be4],0x1c; je 0x1e002
        await handleFrameInput();                                 // G1 0x1d0c1..0x1d630
        updateGameFrame();                                 // G2 0x1d630..0x1db3a
        await drawGameFrame();                                 // G3 0x1db3a..0x1dffd
      }                                                      // 0x1dffd jmp 0x1d0b4
      await F.enterHighScore_1098f();                                   // 0x1e002
      F.Fill_Screen_20768(0);                          // 0x1e007 xor eax,eax; 0x1e009 call
    }                                                        // 0x1e00e jmp 0x1cc2f
  }                                                          // 0x1e013 jmp 0x1cbe4
  shutdown();                                       // S1 0x1e018..0x1e0be
  return 0;                                                  // 0x1e0be xor eax,eax; 0x1e0c0..0x1e0c7 epilogue
});
