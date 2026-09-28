# Game functions

The game's functions, named in stage 2 from what they do (the data they touch is named in [DATA.md](DATA.md)).
Each file is `src/game/<address>_<name>.js` and each registry key `<name>_<address>`; the address is the
function's entry point in the original `GANJAFRM.EXE`. The phases of `main` are in `src/game/1aa02/`.

| address | name | what it does | confidence |
| --- | --- | --- | --- |
| 0x10010 | `readHighScoreEntry` | Reads one 0x18-byte high-score record (score, level, name) from the open scores.dat file; returns fread's count (0 at EOF). | high |
| 0x10050 | `updateMusic` | Background-music driver called every frame: when the current song has finished, advances to the next of 12 tracks (wrapping) and starts it, plus its digitized music sample when music samples are enabled. | high |
| 0x102d1 | `showPictureFadeIn` | Splash-screen helper: loads a PCX, blacks out the palette, shows the picture and fades palette entries 1..254 in over 20 ticks, holds for `delay` ticks, then runs Screen_Transition(effect) unless effect is 0x34. | high |
| 0x10676 | `saveHighScores` | Writes the 9-entry high-score table to scores.dat (optionally first resetting it to default scores 100000..20000 / levels 10..2 with names read from cin when resetHighScores is set). | high |
| 0x10767 | `loadHighScores` | Reads all high-score records from scores.dat into the highScores table. | high |
| 0x107ce | `drawHighScoreTable` | Reads scores.dat and draws each entry's score and level (as digit sprites) and the player name (colored per row) into the double buffer. | high |
| 0x1098f | `enterHighScore` | At game over: loads the table and, if the score beats an entry, stores score/level there, shows 'New Top Score' and lets the player type a name (15 chars, backspace, Enter), then saves scores.dat. | high |
| 0x10b7d | `showPauseScreen` | Pauses sound and music, prints 'Game Paused Mon! / Press Enter to continue' and waits for Enter or Space, then resumes audio. | high |
| 0x10c0b | `confirmQuit` | Pauses audio, asks 'Are you sure you want to quit Mon ? (y or n)', waits for Y or N and sets gameState = 0x1c (quit) on Y, then resumes audio. | high |
| 0x10cac | `runSoundOptionsMenu` | Sound settings screen: mouse-driven loop with three volume sliders (effects, music, master -> dws_XDig/XMusic/XMaster) and a music-samples toggle, playing a test sample, until right-click, Esc, Space or the exit button. | high |
| 0x1128e | `showHighScoreScreen` | Shows hiscore.pcx with the high-score table and a Jah sprite bouncing around the screen for ~300 ticks (Space skips after a few ticks). | high |
| 0x115bc | `showTitleScreen` | Displays the titp.pcx title picture for 65 ticks, playing the 'Ya Mon' sample at tick 50, then clears the screen. | high |
| 0x11659 | `runMainMenu` | Main menu loop: animates the menu background (5 PCX frames), tracks the mouse gunsight and handles clicks on Play (gameState 0x22), Quit (0x25), Sound options and How-to; shows the high-score screen after idle timeout or on Space. | high |
| 0x11c2a | `fireBullet` | Spawns one tracer bullet: takes the first free bullet slot, computes its velocity toward the gunsight (atan/cos/sin), places it at the gun muzzle for the rasta's current aim frame, saves the pixel under it, and charges 1 point from the score. | high |
| 0x12130 | `updateBullets` | Per frame, moves every active tracer bullet (restoring/redrawing its pixel), deactivates off-screen ones and tests hits against choppers, bombs, A-10s, crop dusters, cruise missile, UFO and paratroopers, playing ricochet/explosion sounds and adding score/kills. | high |
| 0x12e85 | `updateChoppers` | Per-frame update of the 5 helicopters: fly left/right, randomly drop paratroopers, play rotor sound, crash/explode when hit points run out (score+kills), respawn off-screen unless the level is ending. | high |
| 0x1352c | `spawnExplosion` | Takes the next slot of the 13-entry explosion ring and places a pending explosion (state 0x26, frame 0) at (explosionX, explosionY+6). | high |
| 0x135bb | `updateExplosions` | Ticks each explosion's start-delay counter (activating it after 50 frames) and animates active explosions, retiring them off-screen after frame 11. | high |
| 0x136a5 | `updateParatroopers` | Per-frame update of the 25 paratroopers and 25 ground troops: descent/landing, bullet hits (death sounds, score, kills), squishing, turning into ground troops that walk to plants and plant charges. | high |
| 0x14425 | `updatePlants` | Per-frame state update of the 26 herb plants: regrowth timer, burning animation until death, and planted charges exploding into fire (with explosion sound). | high |
| 0x14690 | `updateA10Jet` | Per-frame update of the A-10 jet: fly across, randomly start a bombing run that releases up to 4 bombs, and re-enter from a random side (unless the level is ending). | high |
| 0x14c6a | `updateBombs` | Per-frame update of the A-10's bombs: animate and fall with drift; on hitting the ground spawn an explosion with sound and set nearby living plants burning. | high |
| 0x14fba | `cycleRastaColors` | Rotates palette entries 0xf9..0xfc through the red/yellow/green/grey rasta colours by one phase each call. | high |
| 0x15127 | `updateCropDusters` | Per-frame update of the 3 crop dusters: fly across, randomly start spraying (emitting spray droplets into the ring), respawn at a random side unless the level is ending. | high |
| 0x1556a | `updateDusterSpray` | Per-frame update of the 63 herbicide droplets: drift down with jitter and, when a droplet reaches the plant row, kill the living plant under it. | high |
| 0x15788 | `updateStatusDigits` | Splits score (7), kills (4) and level (3) into decimal digits and sets the corresponding status-bar digit sprites' frames. | high |
| 0x159e7 | `applyLevelEnemyLimits` | Depending on the current level, deactivates (state 0) the enemies not yet available: A-10, some choppers and crop dusters, the UFO (before level 19) and the cruise missile (before level 25). | medium |
| 0x15c34 | `activateA10Jet` | Sets the A-10 jet's state to 1 (flying), re-enabling it. | high |
| 0x15c7d | `updateLevelProgress` | Counts down the level timer; when it runs out marks the level as ending, clears enemies after a grace period, and once all enemies are gone runs the level-complete sequence, increments the level and resets the timer. | medium |
| 0x15e15 | `runLevelEndSequence` | Level-complete sequence: finds the longest run of dead plants as the replant spot, then loops the Jah-descends-and-replants animation (with plant/status/colour updates) until Jah leaves, then re-enables the A-10 and clears enemies. | high |
| 0x16446 | `updateJahPowerupDrop` | On levels 5/10/15/20..50 sends Jah across the sky to drop a powerup crate (auto gun, missile launcher, bong or +42000 points) near the van, drops the crate, and on landing grants the weapon/points with its voice sample. | high |
| 0x16837 | `updateJahReplant` | Level-complete sequence: Jah descends, flies over the longest run of dead plants replanting them (state 0x33), shows 'Praise Jah' / 'Fight the power' messages, then flies away and ends the sequence (also a J+arrows debug control). | high |
| 0x16b96 | `showGameOver` | Plays the game-over sound, shows the 'GAME OVER' dialog, waits, transitions the screen and clears the buffer with blank.pcx. | high |
| 0x16c37 | `eraseGameSprites` | Erases every in-game sprite (enemies, projectiles, plants, Jah, HUD digits, rasta, cursor...) from the double buffer by restoring the background behind it. | high |
| 0x16fbb | `updateCruiseMissile` | Moves the nuke-carrying cruise missile across the screen, detonates it when it drops below the ground line (nuke cloud, palette flash, all growing plants set burning) and respawns it from a side based on the level. | high |
| 0x173a2 | `updateMissile` | Updates the player's homing rocket: lifetime, steering toward the DIE MON lock-on marker, smoke trail spawning, and collision tests against choppers, paratroopers, cruise missile, bombs, A-10, crop dusters and UFO with explosions/sounds/score. | high |
| 0x185bf | `updateMissileSmoke` | Makes the 63 missile smoke-trail puffs jitter horizontally and expire when their lifetime runs out. | high |
| 0x1864d | `fireMissile` | Launches a missile: places the lock-on marker at the gunsight, locks it onto whatever enemy (chopper, crop duster, A-10, cruise missile) is under it, and sets the rocket's start position/direction from the rasta pose. | high |
| 0x18a58 | `updateUfo` | Runs the UFO: colour-cycles its beam, flies in, picks a plant to abduct, beams it up with its sounds and flies away. | high |
| 0x18f27 | `updatePlayer` | Per-frame player logic: rasta idle joint-smoking and bong-loading animations, aims the rasta pose at the gunsight per weapon, and on mouse click fires the current weapon (gun shot, missile, bong smoke) with sounds and random voice lines. | medium |
| 0x1977e | `fireBongSmoke` | Spawns up to 3 bong smoke clouds at the rasta's pipe, with velocities aimed toward the gunsight (atan/cos/sin). | high |
| 0x19ade | `updateBongSmoke` | Moves the 200 bong smoke clouds, removes them off screen, and tests them against enemies (choppers, paratroopers, bombs, A-10, crop dusters, cruise missile, UFO) awarding score/kills with explosions and sounds. | high |
| 0x1a825 | `clearEnemies` | Removes every active enemy and projectile (paratroopers, ground troops, bombs, A-10, crop dusters and spray, explosions, bong smoke, choppers, missile, marker, cruise missile, UFO). | high |
| 0x1aa02 | `main` | the program: initialisation, then menu / game loop, then shutdown | high |
| 0x1aa26 | `initSystemAndLoadSprites` | Start-up part 1: sets VGA mode 13h, double buffer, keyboard driver, random seed, detects/initialises the sound system, and loads the gunsight, van, status bar, chopper and paratrooper sprites. | medium |
| 0x1af47 | `loadMenuAndGroundSprites` | Start-up part 2: loads ground troop, sound-menu, volume-slider, crop duster, plant and cloud (duster spray) sprites. | medium |
| 0x1b4b9 | `loadAircraftAndHudSprites` | Start-up part 3: loads smoke clouds, A-10, bombs, explosions and the score/kills/level digit sprites. | medium |
| 0x1b9a9 | `loadCharacterSprites` | Start-up part 4: loads rasta, dialog box, nuke cloud, Jah, UFO, cruise missile, powerup crate, missile and lock-on marker sprites. | medium |
| 0x1bed0 | `loadMusicAndSounds` | Start-up part 5: loads the music tracks (f*.dwm) and the first batch of sound effects (*.dwd) and sets their playback rates. | high |
| 0x1c567 | `loadMoreSoundsAndShowLogos` | Start-up part 6: loads the remaining sound effects and voices, starts the music, then shows the publisher/developer logo screens and the title (sub_115bc). | medium |
| 0x1cc3c | `startNewGame` | Sets up a new game: draws the background, resets score/level/kills/weapons, replants all plants, clears all enemies and positions the HUD digits. | high |
| 0x1d0c1 | `handleFrameInput` | Frame part 1: records frame start time, checks for all-herb-dead, reads the mouse into the gunsight, erases sprites, and handles keys (Esc menu, F2 sound menu, P pause, cheat codes like NUK/420/G+M/G+B/G+N) and right-click weapon cycling. | medium |
| 0x1d630 | `updateGameFrame` | Frame part 2: runs all per-frame game updates (player, Jah, enemies, projectiles, UFO, cruise missile...), level-select debug keys, enemy spawning (sub_159e7), fire-rate toggling, and saves backgrounds behind sprites. | high |
| 0x1db3a | `drawGameFrame` | Frame part 3: draws all sprites and bullets into the double buffer, shows it, waits for the next timer tick, checks level/game state (sub_15c7d) and shows game over when all herb is dead. | high |
| 0x1e018 | `shutdown` | Restores the timer, text video mode and keyboard, prints the exit text, and shuts down the sound system. | high |
| 0x23d7a | `labs` | C runtime labs(): signed absolute value (used by Time_Delay) | high |
