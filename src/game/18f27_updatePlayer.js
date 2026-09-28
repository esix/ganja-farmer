// 0x18f27  void updatePlayer(void)   [Watcom, no args, no return value]  (code 0x18f27..0x1977d RET)
// No register arguments: after `push 0x24; call __CHK` it pushes EBX/ECX/EDX/ESI/EDI/EBP (`sub esp, 0`: no
// locals) and writes every register before reading it (signatures.json regs 0). Return value: none — EAX at RET
// is a leftover (a load / callee result); both call sites (0x1617b, 0x1d630) are followed directly by calls to
// 0x15788 / 0x16446, which take no register args (signatures.json regs 0), so EAX is not read.
//
// Structures (LIBRARY.md "Structures"):
//   dws_DPLAY (stride 0x20, +0xA soundnum): 0x61300, 0x613e0, 0x611a0, 0x613a0, 0x611c0, 0x611e0, 0x61200,
//     0x61220, 0x61400, 0x61420 are passed to dws_DPlay (LIBRARY.md `dws_DPlay(dws_DPLAY *dp)`); the words
//     read at 0x6130a, 0x613ea, 0x6142a, 0x611aa, 0x613aa, 0x611ca, 0x611ea, 0x6120a, 0x6122a are +0xA of
//     structs at 0x61300, 0x613e0, 0x61420, 0x611a0, 0x613a0, 0x611c0, 0x611e0, 0x61200, 0x61220 and are
//     passed as soundnum to dws_DDiscard / dws_DSoundStatus.
//   0x60f14: the WORD *result of dws_DSoundStatus (LIBRARY.md); read back as a word after each call.
//   0x61668: passed as RGB_color* to Write_Color_Reg (LIBRARY.md: bytes +0, +1, +2 = r, g, b).
//   0x33aa4 / 0x33dbc are sprites (x +0, y +4; evidence in 1977e_sub_1977e.js header).
// All other globals by address only; no game meaning is claimed.
import { F, register } from '../runtime/registry.js';
import { R8, W8, R16, R32, W32 } from '../runtime/mem.js';
import { imod } from '../runtime/cpu.js';
import { DPLAY, SPRITE, bongBlowPending, bongHitTimer, bongShotsLeft, bongState, currentWeapon, fireReady, gunSight, idleTimer, inLevelEndSequence, jointGlowColor, missile, mouseButtons, prevGunSightX, prevGunSightY, randomVoice, rasta, rastaAnimDelay, score, smokeGlowPhase, sndBong, sndBongBlow, sndBongBubble, sndGetSome, sndGunShot, sndIShot, sndMissile, sndPdie4, sndSmokin, sndYaMon, soundStatus } from './data.js';

register(0x18f27, 'updatePlayer_18f27', function updatePlayer() {
  // 0x18f3f..0x18f9b
  if ((R32(mouseButtons) === 1 || R32(prevGunSightY) !== R32((gunSight + SPRITE.y)) || R32(prevGunSightX) !== R32(gunSight)) && // 18f3f..18f62
      (R32((rasta + SPRITE.state)) === 0x2c || R32((rasta + SPRITE.state)) === 0x2b) && // 18f64..18f74
      R32(inLevelEndSequence) !== 1 && // 18f7a
      R32((rasta + SPRITE.state)) !== 0x3a && // 18f85
      R32((rasta + SPRITE.state)) !== 0x3b) { // 18f90
    W32((rasta + SPRITE.state), 1); // 18f9b
  }

  // 0x18fa5..0x19018
  if (R32(mouseButtons) !== 1 && R32(prevGunSightY) === R32((gunSight + SPRITE.y)) && R32(prevGunSightX) === R32(gunSight) &&
      R32((rasta + SPRITE.state)) === 1) {
    W32(idleTimer, (R32(idleTimer) - 1) | 0); // 18fd7 dec
    if (R32(idleTimer) < 0) { // 18fdd cmp 0; jge
      W32((rasta + SPRITE.state), 0x2b);
      W32((rasta + SPRITE.currFrame), 0xa);
      W32(rastaAnimDelay, 0);
      W32(idleTimer, 0x64);
      W32(smokeGlowPhase, 2);
    }
  }

  // 0x19018..0x19115
  if (R32((rasta + SPRITE.state)) === 0x2c) {
    if (R32(smokeGlowPhase) === 2) {
      W8(jointGlowColor, (R8(jointGlowColor) + 2) & 0xff); // 1902e add byte
      F.Write_Color_Reg_20541(0xb6, jointGlowColor); // 19035..1903f
      if (R8(jointGlowColor) > 0x3c) { // 19044..1904e movzx; cmp 0x3c; jle
        W32(smokeGlowPhase, 0);
      }
    }
    W32(rastaAnimDelay, (R32(rastaAnimDelay) + 1) | 0); // 1905a inc
    if (R32(rastaAnimDelay) > 4) { // 19060 jle
      if (R32(smokeGlowPhase) === 0) {
        W32((rasta + SPRITE.currFrame), (R32((rasta + SPRITE.currFrame)) + 1) | 0); // 19076 inc
        if (R32((rasta + SPRITE.currFrame)) > 0x12) { // 1907c jle
          W32(smokeGlowPhase, 1);
          W32((rasta + SPRITE.currFrame), 0x12);
          W8(jointGlowColor, 4);
          W8((jointGlowColor + 0x1), 2);
          F.Write_Color_Reg_20541(0xb6, jointGlowColor); // 190a7..190b1
          F.dws_DDiscard_1f770(R16((sndPdie4 + DPLAY.soundnum))); // 190b6..190bf (cdecl, zero-extended word)
          F.dws_DPlay_1eff8(sndPdie4); // 190c7..190cd (cdecl)
          W32(score, (R32(score) + 0x3e8) | 0); // 190d5
        }
      }
      if (R32(smokeGlowPhase) === 1) { // 190df
        W32((rasta + SPRITE.currFrame), (R32((rasta + SPRITE.currFrame)) - 1) | 0); // 190e8 dec
        if (R32((rasta + SPRITE.currFrame)) < 0x10) { // 190ee jge
          W32((rasta + SPRITE.currFrame), 0x10);
          W32(smokeGlowPhase, 2);
        }
      }
      W32(rastaAnimDelay, 0); // 1910b
    }
  }

  // 0x19115..0x1915f
  if (R32((rasta + SPRITE.state)) === 0x2b) {
    F.Write_Color_Reg_20541(0xb6, jointGlowColor); // 1911e..19128
    W32(rastaAnimDelay, (R32(rastaAnimDelay) + 1) | 0); // 1912d inc
    if (R32(rastaAnimDelay) > 4) { // 19133 jle
      W32((rasta + SPRITE.currFrame), (R32((rasta + SPRITE.currFrame)) + 1) | 0); // 1913c inc
      if (R32((rasta + SPRITE.currFrame)) > 0xf) { // 19142 jle
        W32((rasta + SPRITE.state), 0x2c);
      }
      W32(rastaAnimDelay, 0); // 19155
    }
  }

  // 0x1915f..0x191b2
  if (R32((rasta + SPRITE.state)) === 0x3a) {
    W32(rastaAnimDelay, (R32(rastaAnimDelay) + 1) | 0); // 19168 inc
    if (R32(rastaAnimDelay) > 4) { // 1916e jle
      W32((rasta + SPRITE.currFrame), (R32((rasta + SPRITE.currFrame)) + 1) | 0); // 19177 inc
      if (R32((rasta + SPRITE.currFrame)) > 0x22) { // 1917d jle
        W32((rasta + SPRITE.state), 0x3b);
        W32(bongHitTimer, 0x5a);
        F.dws_DPlay_1eff8(sndBongBubble); // 1919a..191a0 (cdecl)
      }
      W32(rastaAnimDelay, 0); // 191a8
    }
  }

  // 0x191b2..0x1921d
  if (R32((rasta + SPRITE.state)) === 0x3b) {
    W32((rasta + SPRITE.currFrame), 0x22); // 191bb
    W32(bongHitTimer, (R32(bongHitTimer) - 1) | 0); // 191c5 dec
    F.dws_DSoundStatus_1f348(R16((sndBongBubble + DPLAY.soundnum)), soundStatus); // 191cb..191da (cdecl, push 0x60f14 then word)
    if (R16(soundStatus) === 0 || R32(bongHitTimer) < 0) { // 191e2 je / 191ec jge
      W32((rasta + SPRITE.state), 1);
      W32(bongState, 0x3c);
      W32(bongShotsLeft, 0x3c);
      W32(bongBlowPending, 1);
    }
  }

  // 0x1921d
  if (R32((rasta + SPRITE.state)) !== 1) {
    return; // jne 0x19777 (epilogue)
  }

  F.dws_DSoundStatus_1f348(R16((sndBong + DPLAY.soundnum)), soundStatus); // 1922a..19239 (cdecl)
  if (R16(soundStatus) !== 0 && R32(mouseButtons) !== 1) { // 19241 je skip / 1924b jne do
    F.dws_DDiscard_1f770(R16((sndBong + DPLAY.soundnum))); // 19256..1925f
    W32(bongBlowPending, 1); // 19267
  }

  // 0x19271..0x192b3
  if (R32(currentWeapon) === 0x37 || R32(currentWeapon) === 0x36) {
    W32((rasta + SPRITE.currFrame), 0);
  }
  if (R32(currentWeapon) === 0x35) {
    W32((rasta + SPRITE.currFrame), 0x14);
  }
  if (R32(currentWeapon) === 0x38) {
    W32((rasta + SPRITE.currFrame), 0x23);
  }

  // 0x192b3..0x19315: 0xbe < 0x33aa4.x + 6 < 0x140
  if (((R32(gunSight) + 6) | 0) > 0xbe && ((R32(gunSight) + 6) | 0) < 0x140) {
    if (R32(currentWeapon) === 0x37 || R32(currentWeapon) === 0x36) {
      W32((rasta + SPRITE.currFrame), 2);
    }
    if (R32(currentWeapon) === 0x35) {
      W32((rasta + SPRITE.currFrame), 0x16);
    }
    if (R32(currentWeapon) === 0x38) {
      W32((rasta + SPRITE.currFrame), 0x24);
    }
  }

  // 0x19315..0x19374: 0 < 0x33aa4.x + 6 < 0x82
  if (((R32(gunSight) + 6) | 0) > 0 && ((R32(gunSight) + 6) | 0) < 0x82) {
    if (R32(currentWeapon) === 0x37 || R32(currentWeapon) === 0x36) {
      W32((rasta + SPRITE.currFrame), 4);
    }
    if (R32(currentWeapon) === 0x35) {
      W32((rasta + SPRITE.currFrame), 0x18);
    }
    if (R32(currentWeapon) === 0x38) {
      W32((rasta + SPRITE.currFrame), 0x25);
    }
  }

  // 0x19374..0x193e1: 0x118 < 0x33aa4.x + 6 < 0x140 and 0x33aa4.y > 0x50
  if (((R32(gunSight) + 6) | 0) > 0x118 && ((R32(gunSight) + 6) | 0) < 0x140 && R32((gunSight + SPRITE.y)) > 0x50) {
    if (R32(currentWeapon) === 0x37 || R32(currentWeapon) === 0x36) {
      W32((rasta + SPRITE.currFrame), 6);
    }
    if (R32(currentWeapon) === 0x35) {
      W32((rasta + SPRITE.currFrame), 0x1a);
    }
    if (R32(currentWeapon) === 0x38) {
      W32((rasta + SPRITE.currFrame), 0x26);
    }
  }

  // 0x193e1..0x19449: 0 < 0x33aa4.x + 6 < 0x28 and 0x33aa4.y > 0x50
  if (((R32(gunSight) + 6) | 0) > 0 && ((R32(gunSight) + 6) | 0) < 0x28 && R32((gunSight + SPRITE.y)) > 0x50) {
    if (R32(currentWeapon) === 0x37 || R32(currentWeapon) === 0x36) {
      W32((rasta + SPRITE.currFrame), 8);
    }
    if (R32(currentWeapon) === 0x35) {
      W32((rasta + SPRITE.currFrame), 0x1c);
    }
    if (R32(currentWeapon) === 0x38) {
      W32((rasta + SPRITE.currFrame), 0x27);
    }
  }

  // 0x19449..0x194ad: 0x33aa4.x + 6 > 0x33dbc.x and 0x33aa4.y + 6 > 0x33dbc.y
  if (((R32(gunSight) + 6) | 0) > R32(rasta) && ((R32((gunSight + SPRITE.y)) + 6) | 0) > R32((rasta + SPRITE.y))) {
    if (R32(currentWeapon) === 0x37 || R32(currentWeapon) === 0x36) {
      W32((rasta + SPRITE.currFrame), 6);
    }
    if (R32(currentWeapon) === 0x35) {
      W32((rasta + SPRITE.currFrame), 0x1a);
    }
    if (R32(currentWeapon) === 0x38) {
      W32((rasta + SPRITE.currFrame), 0x26);
    }
  }

  // 0x194ad..0x19511: 0x33aa4.x + 6 < 0x33dbc.x and 0x33aa4.y + 6 > 0x33dbc.y
  if (((R32(gunSight) + 6) | 0) < R32(rasta) && ((R32((gunSight + SPRITE.y)) + 6) | 0) > R32((rasta + SPRITE.y))) {
    if (R32(currentWeapon) === 0x37 || R32(currentWeapon) === 0x36) {
      W32((rasta + SPRITE.currFrame), 8);
    }
    if (R32(currentWeapon) === 0x35) {
      W32((rasta + SPRITE.currFrame), 0x1c);
    }
    if (R32(currentWeapon) === 0x38) {
      W32((rasta + SPRITE.currFrame), 0x27);
    }
  }

  // 0x19511..0x19523
  if (R32(mouseButtons) !== 1 || R32(fireReady) !== 1) {
    return; // jmp 0x19777 (epilogue)
  }

  F.dws_DDiscard_1f770(R16((sndGunShot + DPLAY.soundnum))); // 19528..19531
  if (R32((missile + SPRITE.state)) === 0) {
    F.dws_DDiscard_1f770(R16((sndMissile + DPLAY.soundnum))); // 19542..1954b
  }

  if (imod(F.rand_232c7(), 0x1e) === 0xf) { // 19553..19569: cdq-style sar; idiv 30; cmp edx, 15
    W32(randomVoice, imod(F.rand_232c7(), 4)); // 1956f..19582: idiv 4 -> remainder
    F.dws_DDiscard_1f770(R16((sndYaMon + DPLAY.soundnum))); // 19588..19592
    F.dws_DDiscard_1f770(R16((sndSmokin + DPLAY.soundnum))); // 1959a..195a4
    F.dws_DDiscard_1f770(R16((sndGetSome + DPLAY.soundnum))); // 195ac..195b6
    F.dws_DDiscard_1f770(R16((sndIShot + DPLAY.soundnum))); // 195be..195c8
    if (R32(randomVoice) === 0) {
      F.dws_DPlay_1eff8(sndYaMon);
    }
    if (R32(randomVoice) === 1) {
      F.dws_DPlay_1eff8(sndSmokin);
    }
    if (R32(randomVoice) === 2) {
      F.dws_DPlay_1eff8(sndGetSome);
    }
    if (R32(randomVoice) === 3) {
      F.dws_DPlay_1eff8(sndIShot);
    }
  } else { // 0x1962e
    if (R32(currentWeapon) === 0x37 || R32(currentWeapon) === 0x36) {
      F.dws_DPlay_1eff8(sndGunShot); // 19640..19646
    }
    if (R32(currentWeapon) === 0x35 && R32((missile + SPRITE.state)) === 0) { // 1964e jne skip / 19657 je do
      F.dws_DPlay_1eff8(sndMissile); // 19662..19668
    }
  }

  // 0x19670..0x196bf
  if (R32(currentWeapon) === 0x37 || R32(currentWeapon) === 0x36) {
    W32((rasta + SPRITE.currFrame), (R32((rasta + SPRITE.currFrame)) + 1) | 0); // 19682 inc
    F.fireBullet_11c2a(); // 19688
    if (R32(currentWeapon) === 0x36) {
      W32(fireReady, 0); // 19696
    }
  }
  if (R32(currentWeapon) === 0x35 && R32((missile + SPRITE.state)) === 0) { // 196a0 jne skip / 196a9 je do
    W32((rasta + SPRITE.currFrame), (R32((rasta + SPRITE.currFrame)) + 1) | 0); // 196b4 inc
    F.fireMissile_1864d(); // 196ba
  }

  // 0x196bf
  if (R32(currentWeapon) !== 0x38) {
    return; // jne 0x19777 (epilogue)
  }
  if (R32(bongState) === 0x3c) { // 196cc
    W32(bongShotsLeft, (R32(bongShotsLeft) - 1) | 0); // 196d9 dec
    if (R32(bongShotsLeft) > 0) { // 196df jle
      F.fireBongSmoke_1977e(); // 196e8
      if (R32(bongBlowPending) === 1) {
        F.dws_DPlay_1eff8(sndBongBlow); // 196f6..196fc
        W32(bongBlowPending, 0); // 19704
      }
      F.dws_DSoundStatus_1f348(R16((sndBong + DPLAY.soundnum)), soundStatus); // 1970e..1971d
      if (R16(soundStatus) === 0) { // 19725 jne
        F.dws_DPlay_1eff8(sndBong); // 1972f..19735
      }
    } else { // 0x1973f
      W32(bongState, 0x39);
      F.dws_DDiscard_1f770(R16((sndBong + DPLAY.soundnum))); // 19749..19752
    }
  }
  if (R32(bongState) === 0x39) { // 1975a
    W32((rasta + SPRITE.state), 0x3a);
    W32((rasta + SPRITE.currFrame), 0x1e);
  }
});
