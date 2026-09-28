// 0x12130  void sub_12130(void)   [Watcom, no args, no return value]  (code 0x12130..0x12e84 RET)
// No register arguments: after `push 0x38; call __CHK` it pushes EBX/ECX/EDX/ESI/EDI/EBP and writes every
// register before reading it (signatures.json regs=0). Return value: none — EAX at RET is a leftover (the
// loop-test path's `imul`/`mov eax,[ebp-0x10]`); the only call site 0x1d63a is followed directly by
// `call 0x16fbb`, and signatures.json has returns=false.
// Frame: sub esp,0x18: [ebp-0x18] double temp (fstp/fld only), [ebp-0x10] i, [ebp-0xc] j, [ebp-4] k.
// No address is taken and every access is a fixed slot, so they are plain JS locals.
//
// Table at 0x5ff20, stride 0x30, entries i = 0..0x3b (60). Per entry e = i*0x30 (same layout as in
// 11c2a_sub_11c2a.js): 0x5ff20+e / 0x5ff24+e / 0x5ff28+e are passed as x, y, color to Write_Pixel_DB
// (0x22219, eax/edx/ebx) and 0x5ff28+e is assigned Read_Pixel_DB(x, y) (0x2225c, eax/edx);
// 0x5ff2c+e flag (processed when == 1; 11c2a sets it to 1); 0x5ff30/0x5ff34/0x5ff38/0x5ff3c int32;
// 0x5ff40+e, 0x5ff48+e double. (Meanings not claimed.)
//
// Sprite structs (stride 0x18c; field names from LIBRARY.md "Structures"):
//   0x33f48 + k*0x18c, k < 5: array Sprite_Init'd by main, frames from "chopper2.pcx" (see 12e85_sub_12e85.js
//     header). Fields: x 0x33f48, y 0x33f4c, width 0x33f50, height 0x33f54, counter_2 (+0x14) 0x33f5c.
//   0x3d23c + k*0x18c, k < 4: x, y 0x3d240, width 0x3d244, height 0x3d248, state (+0x170) 0x3d3ac.
//   0x3d0b0 + j*0x18c, j < 1: x, y 0x3d0b4, width 0x3d0b8, height 0x3d0bc, threshold_1 (+0x1c) 0x3d0cc,
//     state (+0x170) 0x3d220.
//   0x3d86c + k*0x18c, k < 3: x, y 0x3d870, width 0x3d874, height 0x3d878, counter_2 (+0x14) 0x3d880,
//     state (+0x170) 0x3d9dc.
//   0x5fc04: x, y 0x5fc08, width 0x5fc0c, height 0x5fc10, state (+0x170) 0x5fd74.
//   0x4c38c: x, y 0x4c390, width 0x4c394, height 0x4c398, counter_2 (+0x14) 0x4c3a0, threshold_2 (+0x20)
//     0x4c3ac, state (+0x170) 0x4c4fc.
//   Evidence that 0x3d23c/0x3d0b0/0x3d86c/0x5fc04/0x4c38c are sprites: 16c37_sub_16c37.js passes each base
//   (+ i*0x18c) to Erase_Sprite_Clip. Only struct offsets are cited, not what the game uses them for.
// dws_DPLAY structs (LIBRARY.md): 0x61260 (soundnum +0xa = 0x6126a), 0x61280 (soundnum = 0x6128a);
//   DDiscard is cdecl with the zero-extended word (`xor r,r; mov r16,[..]; push r`).
// Other globals by address only: 0x60b54, 0x60a68, 0x60a6c, 0x60b90/0x60b94 (read by 0x1352c: x = [0x60b90],
//   y = [0x60b94]+6 of its ring entry), 0x60b58 + 4*[0x60b8c] ([0x60b8c] is 0x1352c's ring index).
//
// Summary: for each entry with flag == 1: Write_Pixel_DB(x, y, color) if on screen (color 0xe0 first
// replaced by 0x80 if y < 0x82, else 2); y moved by the double at +0x40 (y - v if 0 < v or unordered, else
// y + v); counters +0x38/+0x3c reloaded from +0x30/+0x34 when [0x60b54] >= 10, decremented, and x/y
// incremented while they are >= 0; x += double at +0x48; reset (flag 0, x = y = 1) if not 0 < y, 0 < x < 0x140;
// color = Read_Pixel_DB(x, y) if on screen; then rectangle tests of (x, y) against the sprites above with
// jitter / sound / 0x1352c bursts / adds to [0x60a68]. For every entry (flag == 1 or not): reset if not
// 0 < x < 0x140, 0 < y < 0xc8; then if flag == 0: Write_Pixel_DB if on screen and reset.
// "On screen" = 0 <= y <= 0xc8 and 0 <= x <= 0x140 (signed).
// All `% n` are `sar edx,31; idiv` remainders (imod). rand() calls: the sprite offset is loaded into ECX
// before the calls and used after them (rand 0x232c7..0x232ea writes only EAX and the pushed/popped EDX;
// its helper 0x232c1 is `mov eax,0x310e8; ret`).
//
// Floating point: fild of an int32 is exact; `fadd/fsub qword` rounds once to double (PC=53, PORTING.md; a
// subnormal result would be rounded twice by the x87 but once by JS — LATENT: every result is chopped to an
// int, audit round1 F-risky F4),
// the fstp/fld through [ebp-0x18] is exact for a double. Float->int: `call __CHP` (0x222a4, truncation,
// argument/result in ST0) then `fistp dword` -> fistp32 (as in 11c2a_sub_11c2a.js: an integral value in
// int32 range is stored exactly; out of range / NaN stores the integer indefinite 0x80000000 since CW 0x127F
// masks invalid-operation; a -0 stores 0). No FPATAN/FSIN/FCOS here, so no Ext values occur.
// `fldz; fcomp qword [+0x40]; fnstsw ax; sahf; jb`: CF = 1 when 0 < v or unordered (NaN) -> subtract path.
// Difftest caveat (audit round1 F-risky F2): this function has no trig, so its own difftest is exact; but
// the doubles +0x40/+0x48 it consumes come from 0x11c2a's atan/cos/sin, where the harness's unicorn trig is
// 53-bit and wrong on game-realistic inputs — at the 4:3 ratios the 53-bit values change the integer x/y
// computed here. The 11c2a -> 12130 chain is confirmed with 64-bit values by re/audit/round1/F-risky/x87/
// sens.mjs (all ~238000 reachable inputs: 0 integer changes between faithful 64-bit neighbours) and
// sens_naive.mjs (89 inputs change with 53-bit trig), not by the difftest.
import { F, register } from '../runtime/registry.js';
import { R16, R32, W32, RF64 } from '../runtime/mem.js';
import { imod } from '../runtime/cpu.js';
import { BULLETS_FIELD, DPLAY, SPRITE, a10Jets, bombs, bullets, choppers, cropDusters, cruiseMissile, explosionDelays, explosionNext, explosionX, explosionY, frameCounter10, kills, score, sndExplosion, sndRicochet, ufo } from './data.js';

// fistp dword of an integral ST0 (see header)
const fistp32 = (v) => (v >= -2147483648 && v <= 2147483647 ? v | 0 : -2147483648);

// "on screen" test used at 0x12172, 0x12368, 0x12dac: 0 <= y <= 0xc8 && 0 <= x <= 0x140 (signed jl/jle/jge)
const onScreen = (e) => !(R32((bullets + BULLETS_FIELD.y) + e) < 0) && R32((bullets + BULLETS_FIELD.y) + e) <= 0xc8 &&
                         R32(bullets + e) >= 0 && R32(bullets + e) <= 0x140;

register(0x12130, 'sub_12130', function sub_12130() {
  let i; // [ebp-0x10]
  let j; // [ebp-0xc]
  let k; // [ebp-4]
  let t; // [ebp-0x18] (double)
  let e; // i * 0x30 (imul eax, [ebp-0x10], 0x30 — recomputed from the local at every use)
  let o; // k*0x18c or j*0x18c (loaded into ECX before rand calls)
  let d; // EBX after `sub ebx, edx`
  let r;

  for (i = 0; i < 0x3c; i++) {                                                  // 12148..1215b (jge: signed)
    e = Math.imul(i, 0x30);
    if (R32((bullets + BULLETS_FIELD.active) + e) === 1) {                                               // 12165: cmp ..,1; jne 12ce7
      if (onScreen(e)) {                                                        // 12172..121ae
        if (R32((bullets + BULLETS_FIELD.savedPixel) + e) === 0xe0) {                                        // 121b6
          if (R32((bullets + BULLETS_FIELD.y) + e) < 0x82) {                                        // 121c6: jge 121e2
            W32((bullets + BULLETS_FIELD.savedPixel) + e, 0x80);                                             // 121d6
          } else {
            W32((bullets + BULLETS_FIELD.savedPixel) + e, 2);                                                // 121e6
          }
        }
        F.Write_Pixel_DB_22219(R32(bullets + e), R32((bullets + BULLETS_FIELD.y) + e), R32((bullets + BULLETS_FIELD.savedPixel) + e)); // 121f0..1220e
      }

      // 12213..12222: fldz; fcomp [+0x40]; jb 12251 (0 < v or unordered)
      if (!(0 >= RF64((bullets + BULLETS_FIELD.vy) + e))) {
        t = R32((bullets + BULLETS_FIELD.y) + e);                                                   // 12259..1225f fild; fstp
        t = t - RF64((bullets + BULLETS_FIELD.vy) + e);                                              // 12262..1226b fld; fsub; fstp
        W32((bullets + BULLETS_FIELD.y) + e, fistp32(F.__CHP_222a4(t)));                      // 1226e..12276 fld; __CHP; fistp
      } else {
        t = R32((bullets + BULLETS_FIELD.y) + e);                                                   // 1222c..12232
        t = t + RF64((bullets + BULLETS_FIELD.vy) + e);                                              // 12235..1223e fld; fadd; fstp
        W32((bullets + BULLETS_FIELD.y) + e, fistp32(F.__CHP_222a4(t)));                      // 12241..12249
      }

      if (R32(frameCounter10) >= 0xa) {                                                // 1227c: jl 122ad
        W32((bullets + BULLETS_FIELD.xStepCounter) + e, R32((bullets + BULLETS_FIELD.xStepTenths) + e));                                     // 12285..12293
        W32((bullets + BULLETS_FIELD.yStepCounter) + e, R32((bullets + BULLETS_FIELD.yStepTenths) + e));                                     // 12299..122a7
      }
      W32((bullets + BULLETS_FIELD.yStepCounter) + e, (R32((bullets + BULLETS_FIELD.yStepCounter) + e) - 1) | 0);                             // 122b1 dec
      if (R32((bullets + BULLETS_FIELD.yStepCounter) + e) >= 0) {                                              // 122b7: jl 122ca
        W32((bullets + BULLETS_FIELD.y) + e, (R32((bullets + BULLETS_FIELD.y) + e) + 1) | 0);                           // 122c4 inc
      }
      W32((bullets + BULLETS_FIELD.xStepCounter) + e, (R32((bullets + BULLETS_FIELD.xStepCounter) + e) - 1) | 0);                             // 122ce dec
      if (R32((bullets + BULLETS_FIELD.xStepCounter) + e) >= 0) {                                              // 122d4: jl 122e7
        W32(bullets + e, (R32(bullets + e) + 1) | 0);                           // 122e1 inc
      }
      t = R32(bullets + e);                                                     // 122ef..122f5
      t = t + RF64((bullets + BULLETS_FIELD.vx) + e);                                                // 122f8..12301
      W32(bullets + e, fistp32(F.__CHP_222a4(t)));                        // 12304..1230c

      // 12312..1233c: reset unless y > 0 && x > 0 && x < 0x140
      if (!(R32((bullets + BULLETS_FIELD.y) + e) > 0 && R32(bullets + e) > 0 && R32(bullets + e) < 0x140)) {
        W32((bullets + BULLETS_FIELD.active) + e, 0);                                                    // 12342
        W32((bullets + BULLETS_FIELD.y) + e, 1);                                                    // 12350
        W32(bullets + e, 1);                                                    // 1235e
      }
      if (onScreen(e)) {                                                        // 12368..123a4
        W32((bullets + BULLETS_FIELD.savedPixel) + e, F.Read_Pixel_DB_2225c(R32(bullets + e), R32((bullets + BULLETS_FIELD.y) + e))); // 123a8..123c5
      }

      // 123cb..12524: sprites 0x33f48, k < 5
      for (k = 0; k < 5; k++) {
        o = Math.imul(k, SPRITE.SIZE);
        // 123e4..12474: x+10 < px && x+w-10 > px && y+h-5 > py && y+5 < py
        if (((R32(choppers + o) + 0xa) | 0) < R32(bullets + e) &&
            ((((R32(choppers + o) + R32((choppers + SPRITE.width) + o)) | 0) - 0xa) | 0) > R32(bullets + e) &&
            ((((R32((choppers + SPRITE.y) + o) + R32((choppers + SPRITE.height) + o)) | 0) - 5) | 0) > R32((bullets + BULLETS_FIELD.y) + e) &&
            ((R32((choppers + SPRITE.y) + o) + 5) | 0) < R32((bullets + BULLETS_FIELD.y) + e)) {
          W32((choppers + SPRITE.counter2) + o, (R32((choppers + SPRITE.counter2) + o) - 1) | 0);                         // 12482 dec counter_2
          r = F.rand_232c7();                                             // 1248f
          d = imod(r, 3);
          r = F.rand_232c7();                                             // 124a4
          d = (d - imod(r, 3)) | 0;                                             // 124b7 sub ebx, edx
          W32(choppers + o, (R32(choppers + o) + d) | 0);                         // 124b9 add [ecx+0x33f48]
          r = F.rand_232c7();                                             // 124c6
          d = imod(r, 3);
          r = F.rand_232c7();                                             // 124db
          d = (d - imod(r, 3)) | 0;                                             // 124ee
          W32((choppers + SPRITE.y) + o, (R32((choppers + SPRITE.y) + o) + d) | 0);                         // 124f0 add [ecx+0x33f4c]
          W32((bullets + BULLETS_FIELD.active) + e, 0);                                                  // 124fa
          F.dws_DDiscard_1f770(R16((sndRicochet + DPLAY.soundnum)));                             // 12504..1250e (cdecl)
          F.dws_DPlay_1eff8(sndRicochet);                                     // 12516..1251c (cdecl)
        }
      }

      // 12529..1266e: sprites 0x3d23c, k < 4
      for (k = 0; k < 4; k++) {
        o = Math.imul(k, SPRITE.SIZE);
        // 12542..125d8: px > x && x+w > px && py > y && y+h > py && state == 1
        if (R32(bullets + e) > R32(bombs + o) &&
            ((R32(bombs + o) + R32((bombs + SPRITE.width) + o)) | 0) > R32(bullets + e) &&
            R32((bullets + BULLETS_FIELD.y) + e) > R32((bombs + SPRITE.y) + o) &&
            ((R32((bombs + SPRITE.y) + o) + R32((bombs + SPRITE.height) + o)) | 0) > R32((bullets + BULLETS_FIELD.y) + e) &&
            R32((bombs + SPRITE.state) + o) === 1) {
          W32((bombs + SPRITE.state) + o, 0);                                                  // 125df
          W32(explosionX, (R32(bombs + o) - 0xc) | 0);                           // 125f0..12600
          W32(explosionY, (R32((bombs + SPRITE.y) + o) - 0x16) | 0);                          // 12605..12615
          W32(explosionDelays + (R32(explosionNext) << 2), 0x33);                             // 1261a..12622
          F.sub_1352c();                                                  // 1262c
          F.dws_DDiscard_1f770(R16((sndExplosion + DPLAY.soundnum)));                             // 12631..1263a (cdecl)
          F.dws_DPlay_1eff8(sndExplosion);                                     // 12642..12648 (cdecl)
          W32((bullets + BULLETS_FIELD.active) + e, 0);                                                  // 12650
          W32(score, (R32(score) + 0x1f5) | 0);                             // 1265e
          W32(kills, (R32(kills) + 1) | 0);                                 // 12668
        }
      }

      // 12673..126c7: sprite 0x5fc04: px > x && x+w > px && py > y && y+h > py
      if (R32(bullets + e) > R32(cruiseMissile) &&
          ((R32(cruiseMissile) + R32((cruiseMissile + SPRITE.width))) | 0) > R32(bullets + e) &&
          R32((bullets + BULLETS_FIELD.y) + e) > R32((cruiseMissile + SPRITE.y)) &&
          ((R32((cruiseMissile + SPRITE.y)) + R32((cruiseMissile + SPRITE.height))) | 0) > R32((bullets + BULLETS_FIELD.y) + e)) {
        W32((cruiseMissile + SPRITE.state), 0);                                                        // 126cb state
        W32(explosionX, (R32(cruiseMissile) - 0xc) | 0);                                 // 126d5..126dd
        W32(explosionY, (R32((cruiseMissile + SPRITE.y)) - 0x16) | 0);                                // 126e2..126ea
        W32(explosionDelays + (R32(explosionNext) << 2), 0x33);                               // 126ef..126f7
        F.sub_1352c();                                                    // 12701
        F.dws_DDiscard_1f770(R16((sndExplosion + DPLAY.soundnum)));                               // 12706..1270f (cdecl)
        F.dws_DPlay_1eff8(sndExplosion);                                       // 12717..1271d (cdecl)
      }

      // 12725..1296d: sprites 0x3d0b0, j < 1
      for (j = 0; j < 1; j++) {
        o = Math.imul(j, SPRITE.SIZE);
        // 1273e..127d4: px > x && x+w > px && py > y && y+h > py && state != 0
        if (R32(bullets + e) > R32(a10Jets + o) &&
            ((R32(a10Jets + o) + R32((a10Jets + SPRITE.width) + o)) | 0) > R32(bullets + e) &&
            R32((bullets + BULLETS_FIELD.y) + e) > R32((a10Jets + SPRITE.y) + o) &&
            ((R32((a10Jets + SPRITE.y) + o) + R32((a10Jets + SPRITE.height) + o)) | 0) > R32((bullets + BULLETS_FIELD.y) + e) &&
            R32((a10Jets + SPRITE.state) + o) !== 0) {
          W32((a10Jets + SPRITE.threshold1) + o, (R32((a10Jets + SPRITE.threshold1) + o) - 1) | 0);                         // 127e2 dec threshold_1
          r = F.rand_232c7();                                             // 127ef
          d = imod(r, 3);
          r = F.rand_232c7();                                             // 12804
          d = (d - imod(r, 3)) | 0;                                             // 12817
          W32(a10Jets + o, (R32(a10Jets + o) + d) | 0);                         // 12819
          r = F.rand_232c7();                                             // 12826
          d = imod(r, 3);
          r = F.rand_232c7();                                             // 1283b
          d = (d - imod(r, 3)) | 0;                                             // 1284e
          W32((a10Jets + SPRITE.y) + o, (R32((a10Jets + SPRITE.y) + o) + d) | 0);                         // 12850
          W32((bullets + BULLETS_FIELD.active) + e, 0);                                                  // 1285a
          F.dws_DDiscard_1f770(R16((sndRicochet + DPLAY.soundnum)));                             // 12864..1286e (cdecl)
          F.dws_DPlay_1eff8(sndRicochet);                                     // 12876..1287c (cdecl)
        }
        if (R32((a10Jets + SPRITE.threshold1) + Math.imul(j, SPRITE.SIZE)) < 0) {                           // 12884: jge 1296d
          W32((a10Jets + SPRITE.state) + Math.imul(j, SPRITE.SIZE), 0);                                // 12898 state
          for (k = 0; k < 4; k++) {                                             // 128a9..128bc
            o = Math.imul(j, SPRITE.SIZE);                                            // 128c2 imul ecx
            r = F.rand_232c7();                                           // 128c9
            W32(explosionX, (imod(r, 0x1e) + R32(a10Jets + o)) | 0);               // 128dc..128e4 (x read after rand)
            o = Math.imul(j, SPRITE.SIZE);                                            // 128ea
            r = F.rand_232c7();                                           // 128f1
            W32(explosionY, (imod(r, 0x14) + R32((a10Jets + SPRITE.y) + o)) | 0);               // 12904..1290c
            W32(explosionDelays + (R32(explosionNext) << 2), 0x33);                           // 12912..1291b
            F.sub_1352c();                                                // 12925
            F.dws_DDiscard_1f770(R16((sndExplosion + DPLAY.soundnum)));                           // 1292a..12934 (cdecl)
            F.dws_DPlay_1eff8(sndExplosion);                                   // 1293c..12942 (cdecl)
          }
          W32((bullets + BULLETS_FIELD.active) + e, 0);                                                  // 1294f
          W32(score, (R32(score) + 0x12c) | 0);                             // 1295d
          W32(kills, (R32(kills) + 1) | 0);                                 // 12967
        }
      }

      // 12972..12b71: sprites 0x3d86c, k < 3
      for (k = 0; k < 3; k++) {
        o = Math.imul(k, SPRITE.SIZE);
        // 1298b..12a21: px > x && x+w > px && py > y && y+h > py && state != 0
        if (R32(bullets + e) > R32(cropDusters + o) &&
            ((R32(cropDusters + o) + R32((cropDusters + SPRITE.width) + o)) | 0) > R32(bullets + e) &&
            R32((bullets + BULLETS_FIELD.y) + e) > R32((cropDusters + SPRITE.y) + o) &&
            ((R32((cropDusters + SPRITE.y) + o) + R32((cropDusters + SPRITE.height) + o)) | 0) > R32((bullets + BULLETS_FIELD.y) + e) &&
            R32((cropDusters + SPRITE.state) + o) !== 0) {
          W32((cropDusters + SPRITE.counter2) + o, (R32((cropDusters + SPRITE.counter2) + o) - 1) | 0);                         // 12a2f dec counter_2
          r = F.rand_232c7();                                             // 12a3c
          d = imod(r, 3);
          r = F.rand_232c7();                                             // 12a51
          d = (d - imod(r, 3)) | 0;                                             // 12a64
          W32(cropDusters + o, (R32(cropDusters + o) + d) | 0);                         // 12a66
          r = F.rand_232c7();                                             // 12a73
          d = imod(r, 3);
          r = F.rand_232c7();                                             // 12a88
          d = (d - imod(r, 3)) | 0;                                             // 12a9b
          W32((cropDusters + SPRITE.y) + o, (R32((cropDusters + SPRITE.y) + o) + d) | 0);                         // 12a9d
          W32((bullets + BULLETS_FIELD.active) + e, 0);                                                  // 12aa7
          F.dws_DDiscard_1f770(R16((sndRicochet + DPLAY.soundnum)));                             // 12ab1..12abb (cdecl)
          F.dws_DPlay_1eff8(sndRicochet);                                     // 12ac3..12ac9 (cdecl)
        }
        if (R32((cropDusters + SPRITE.counter2) + o) < 0) {                                             // 12ad1: jge 12b71
          W32((cropDusters + SPRITE.state) + o, 0);                                                  // 12ae5 state
          W32(explosionX, (R32(cropDusters + o) - 0xc) | 0);                           // 12af6..12b06
          W32(explosionY, (R32((cropDusters + SPRITE.y) + o) - 0x16) | 0);                          // 12b0b..12b1b
          W32(explosionDelays + (R32(explosionNext) << 2), 0x33);                             // 12b20..12b28
          F.sub_1352c();                                                  // 12b32
          F.dws_DDiscard_1f770(R16((sndExplosion + DPLAY.soundnum)));                             // 12b37..12b40 (cdecl)
          F.dws_DPlay_1eff8(sndExplosion);                                     // 12b48..12b4e (cdecl)
          W32((bullets + BULLETS_FIELD.active) + e, 0);                                                  // 12b56
          W32(score, (R32(score) + 0x64) | 0);                              // 12b64
          W32(kills, (R32(kills) + 1) | 0);                                 // 12b6b
        }
      }

      // 12b76..12bd5: sprite 0x4c38c: px > x && x+w > px && py > y && y+h > py && state != 0
      if (R32(bullets + e) > R32(ufo) &&
          ((R32(ufo) + R32((ufo + SPRITE.width))) | 0) > R32(bullets + e) &&
          R32((bullets + BULLETS_FIELD.y) + e) > R32((ufo + SPRITE.y)) &&
          ((R32((ufo + SPRITE.y)) + R32((ufo + SPRITE.height))) | 0) > R32((bullets + BULLETS_FIELD.y) + e) &&
          R32((ufo + SPRITE.state)) !== 0) {
        W32((ufo + SPRITE.threshold2), (R32((ufo + SPRITE.threshold2)) - 1) | 0);                                   // 12bd9 dec threshold_2
        W32((ufo + SPRITE.counter2), Math.imul(R32((ufo + SPRITE.counter2)), -1));                              // 12bdf imul eax, [..], -1
        W32((bullets + BULLETS_FIELD.active) + e, 0);                                                    // 12beb
        F.dws_DDiscard_1f770(R16((sndRicochet + DPLAY.soundnum)));                               // 12bf9..12c02 (cdecl)
        F.dws_DPlay_1eff8(sndRicochet);                                       // 12c0a..12c10 (cdecl)
      }
      if (R32((ufo + SPRITE.threshold2)) < 0 && R32((ufo + SPRITE.state)) !== 0) {                             // 12c18..12c28
        W32((ufo + SPRITE.state), 0);                                                        // 12c2f state
        for (k = 0; k < 4; k++) {                                               // 12c39..12c4c
          r = F.rand_232c7();                                             // 12c4e
          W32(explosionX, (R32(ufo) + imod(r, 0x1e)) | 0);                     // 12c5f..12c68 (x read after rand)
          r = F.rand_232c7();                                             // 12c6d
          W32(explosionY, (imod(r, 0x14) + R32((ufo + SPRITE.y))) | 0);                     // 12c7e..12c87
          W32(explosionDelays + (R32(explosionNext) << 2), 0x33);                             // 12c8d..12c96
          F.sub_1352c();                                                  // 12ca0
          F.dws_DDiscard_1f770(R16((sndExplosion + DPLAY.soundnum)));                             // 12ca5..12cae (cdecl)
          F.dws_DPlay_1eff8(sndExplosion);                                     // 12cb6..12cbc (cdecl)
        }
        W32((bullets + BULLETS_FIELD.active) + e, 0);                                                    // 12cc9
        W32(score, (R32(score) + 0x3e8) | 0);                               // 12cd7
        W32(kills, (R32(kills) + 1) | 0);                                   // 12ce1
      }
    }

    // 12ce7..12d23: reset unless y > 0 && x > 0 && x < 0x140 && y < 0xc8
    if (!(R32((bullets + BULLETS_FIELD.y) + e) > 0 && R32(bullets + e) > 0 &&
          R32(bullets + e) < 0x140 && R32((bullets + BULLETS_FIELD.y) + e) < 0xc8)) {
      W32((bullets + BULLETS_FIELD.active) + e, 0);                                                      // 12d25
      W32((bullets + BULLETS_FIELD.y) + e, 1);                                                      // 12d33
      W32(bullets + e, 1);                                                      // 12d41
      W32((bullets + BULLETS_FIELD.vx) + e, 0);                                                      // 12d53: +0x48 = 0.0 (lo)
      W32((bullets + 0x2c) + e, 0);                                                      // 12d5d (hi)
      W32((bullets + BULLETS_FIELD.vy) + e, 0);                                                      // 12d6b: +0x40 = -5.0 (lo)
      W32((bullets + 0x24) + e, 0xc0140000 | 0);                                         // 12d75 (hi)
      W32((bullets + BULLETS_FIELD.xStepTenths) + e, 0);                                                      // 12d83
      W32((bullets + BULLETS_FIELD.yStepTenths) + e, 0);                                                      // 12d91
    }
    if (R32((bullets + BULLETS_FIELD.active) + e) === 0) {                                               // 12d9f: jne 12e77
      if (onScreen(e)) {                                                        // 12dac..12de8
        F.Write_Pixel_DB_22219(R32(bullets + e), R32((bullets + BULLETS_FIELD.y) + e), R32((bullets + BULLETS_FIELD.savedPixel) + e)); // 12dec..12e0a
      }
      W32((bullets + BULLETS_FIELD.y) + e, 1);                                                      // 12e13
      W32(bullets + e, 1);                                                      // 12e21
      W32((bullets + BULLETS_FIELD.vx) + e, 0);                                                      // 12e2f: +0x48 = 0.0
      W32((bullets + 0x2c) + e, 0);                                                      // 12e39
      W32((bullets + BULLETS_FIELD.vy) + e, 0);                                                      // 12e47: +0x40 = -5.0
      W32((bullets + 0x24) + e, 0xc0140000 | 0);                                         // 12e51
      W32((bullets + BULLETS_FIELD.xStepTenths) + e, 0);                                                      // 12e5f
      W32((bullets + BULLETS_FIELD.yStepTenths) + e, 0);                                                      // 12e6d
    }
  }                                                                             // 12e77 jmp 12151 (i++)
});
