// 0x173a2  void sub_173a2(void)   [Watcom, no args, no return value]
// Arguments: none. The prologue (0x173ac..0x173b1) only saves EBX/ECX/EDX/ESI/EDI (restored at 0x185b9..0x185bd);
// EAX is first written at 0x173d6; the function ends with a plain `ret` (no stack args). signatures.json agrees
// (regs 0, stack 0). The "1" in functions.tsv is the caller count (only caller: 0x1aa02, call at 0x1d671).
// Return: none. EAX at RET is a leftover (loads/callee results); the caller 0x1d671 continues with
// `call 0x185bf` (no register args) and never reads it. signatures.json returns=false.
//
// Everything is guarded by [0x46070] == 1 (0x45f00.state). Then, in order:
//   - 0x45f00.threshold_3 is decremented; when it goes < 0: SEQ (below) at 0x4608c.x-12 / 0x4608c.y-22,
//     then 0x45f00.state = 0x4608c.state = 0;
//   - 0x45f00.state / 0x4608c.state = 0 when 0x45f00.x > 0x17c or < -0x3c or 0x45f00.y < -0x14;
//   - 0x4608c.counter_1 countdown (reload 4) toggles 0x4608c.curr_frame between 0 and 1;
//   - 0x4608c.x/y += 0x4608c.counter_2/counter_3;
//   - 0x45f00.counter_1 decremented; if < 0 and 0x4608c.y-10 < 0x45f00.y, 0x45f00.curr_frame is set to
//     4/0/3/1/2 depending on the relative x/y of 0x45f00 and 0x4608c;
//   - three entries of the sprite array 0x46218 (ring index 0x60eec, wraps to 0 at >= 0x3f) get x/y,
//     counter_1 and state = 1;
//   - 0x45f00.x/y changed by a switch on 0x45f00.curr_frame (0..4);
//   - rectangle tests of 0x45f00 against 0x4608c, 0x35b20[i], 0x33f48[j], 0x5fc04, 0x35b20[i] (two tests),
//     0x3d23c[j], 0x3d0b0[k], 0x3d86c[j], 0x4c38c, each followed by the writes/calls shown inline;
//   - if 0x4c38c.threshold_2 <= 0 and 0x4c38c.state != 0: state = 0 and SEQ four times at random offsets.
// SEQ (a label for a sequence the binary repeats inline): [0x60b90] = X, [0x60b94] = Y,
//   [0x60b58 + 4*[0x60b8c]] = 0x33, sub_1352c(), dws_DDiscard(word [0x6128a]), dws_DPlay(0x61280).
//   sub_1352c advances ring index [0x60b8c] and writes x, y, state 0x26, curr_frame 0 of that slot of the sprite array 0x34704 (sprites built from "exp2.pcx", see 1352c_sub_1352c.js).
//
// Sprite evidence: every base used here is passed to Sprite_Init (0x20ce5) in 0x1aa02 (decompiled.c 4303..4553):
//   single sprites 0x45f00, 0x4608c, 0x5fc04, 0x4c38c; arrays (stride 0x18c) 0x33f48, 0x35b20, 0x3d86c,
//   0x46218, 0x3d0b0, 0x3d23c. Field offsets (LIBRARY.md "sprite"): x +0, y +4, width +8, height +0xC,
//   counter_1 +0x10, counter_2 +0x14, counter_3 +0x18, threshold_2 +0x20, threshold_3 +0x24, curr_frame +0x168,
//   state +0x170. Game meaning of these fields/values is not established here.
// dws_DPLAY structs (LIBRARY.md): 0x61260, 0x61280, 0x612a0, 0x612c0, 0x612e0, 0x61320; +0xA = soundnum word,
//   passed zero-extended (xor reg,reg; mov reg16,[..]; push) to dws_DDiscard (cdecl).
// 0x60b58: 13-entry int array (see 135bb_sub_135bb.js), meaning unknown. 0x60a68, 0x60a6c, 0x60ee0, 0x60eec:
//   globals, meaning not established here.
// Locals [ebp-4], [ebp-8], [ebp-0xc] (loop counters) and [ebp-0x10] (switch operand) are never address-taken.
import { F, register } from '../runtime/registry.js';
import { R16, R32, W32 } from '../runtime/mem.js';
import { imod } from '../runtime/cpu.js';

register(0x173a2, 'sub_173a2', async function sub_173a2() {
  let k; // [ebp-4]
  let i; // [ebp-8]
  let j; // [ebp-0xc]
  let sw; // [ebp-0x10]: switch operand
  let r; // EAX after rand
  let d; // EBX / EDX temporaries
  let o; // ECX = index*0x18c, computed before the rand calls

  // 173ba: cmp [0x46070], 1; jne end
  if (R32(0x46070) !== 1) return;

  // 173c7: dec [0x45f24] (0x45f00.threshold_3); cmp 0; jge
  W32(0x45f24, (R32(0x45f24) - 1) | 0);
  if (R32(0x45f24) < 0) {
    W32(0x60b90, (R32(0x4608c) - 0xc) | 0);                               // 173d6
    W32(0x60b94, (R32(0x46090) - 0x16) | 0);                              // 173e3
    W32(0x60b58 + (R32(0x60b8c) << 2), 0x33);                             // 173f0..173f8
    await F.sub_1352c();                                                  // 17402
    await F.dws_DDiscard_1f770(R16(0x6128a));                             // 17407..17415 (cdecl)
    await F.dws_DPlay_1eff8(0x61280);                                     // 17418..17423 (cdecl)
    W32(0x46070, 0);                                                      // 17426
    W32(0x461fc, 0);                                                      // 17430
  }

  // 1743a..1746e: x > 0x17c || x < -0x3c || y < -0x14 (signed)
  if (R32(0x45f00) > 0x17c || R32(0x45f00) < -0x3c || R32(0x45f04) < -0x14) {
    W32(0x46070, 0);                                                      // 1745a
    W32(0x461fc, 0);                                                      // 17464
  }

  // 1746e: dec [0x4609c] (0x4608c.counter_1); cmp 0; jge
  W32(0x4609c, (R32(0x4609c) - 1) | 0);
  if (R32(0x4609c) < 0) {
    W32(0x4609c, 4);                                                      // 1747d
    if (R32(0x461f4) === 0) {                                             // 17487
      W32(0x461f4, 1);                                                    // 17490
    } else {
      W32(0x461f4, 0);                                                    // 1749c
    }
  }

  // 174a6..174b6: 0x4608c.x += counter_2; 0x4608c.y += counter_3
  W32(0x4608c, (R32(0x4608c) + R32(0x460a0)) | 0);
  W32(0x46090, (R32(0x46090) + R32(0x460a4)) | 0);

  // 174bc: dec [0x45f10] (0x45f00.counter_1); jge -> 175b9; 174cb: [0x46090]-10 < [0x45f04] (jl)
  W32(0x45f10, (R32(0x45f10) - 1) | 0);
  if (R32(0x45f10) < 0 && ((R32(0x46090) - 0xa) | 0) < R32(0x45f04)) {
    // 174e0: y <= Y && x < X -> curr_frame 4
    if (R32(0x45f04) <= R32(0x46090) && R32(0x45f00) < R32(0x4608c)) {
      W32(0x46068, 4);                                                    // 174fc
    }
    // 17506: y <= Y && x > X -> 0
    if (R32(0x45f04) <= R32(0x46090) && R32(0x45f00) > R32(0x4608c)) {
      W32(0x46068, 0);                                                    // 17522
    }
    // 1752c: X-5 > x && y > Y -> 3
    if (((R32(0x4608c) - 5) | 0) > R32(0x45f00) && R32(0x45f04) > R32(0x46090)) {
      W32(0x46068, 3);                                                    // 1754b
    }
    // 17555: X+15 < x && y > Y -> 1
    if (((R32(0x4608c) + 0xf) | 0) < R32(0x45f00) && R32(0x45f04) > R32(0x46090)) {
      W32(0x46068, 1);                                                    // 17574
    }
    // 1757e: y > Y && X-5 < x && X+15 > x -> 2
    if (R32(0x45f04) > R32(0x46090) && ((R32(0x4608c) - 5) | 0) < R32(0x45f00) &&
        ((R32(0x4608c) + 0xf) | 0) > R32(0x45f00)) {
      W32(0x46068, 2);                                                    // 175af
    }
  }

  // 175b9: inc [0x60eec]; cmp 0x3f; jl
  W32(0x60eec, (R32(0x60eec) + 1) | 0);
  if (R32(0x60eec) >= 0x3f) {
    W32(0x60eec, 0);                                                      // 175c8
  }
  W32(0x46218 + Math.imul(R32(0x60eec), 0x18c), R32(0x45f00));            // 175d2..175e2 x
  W32(0x4621c + Math.imul(R32(0x60eec), 0x18c), (R32(0x45f04) + 5) | 0);  // 175e8..175fb y
  W32(0x46228 + Math.imul(R32(0x60eec), 0x18c), 0xe);                     // 17601 counter_1
  W32(0x46388 + Math.imul(R32(0x60eec), 0x18c), 1);                       // 17615 state

  // 17629
  W32(0x60eec, (R32(0x60eec) + 1) | 0);
  if (R32(0x60eec) >= 0x3f) {
    W32(0x60eec, 0);                                                      // 17638
  }
  W32(0x46218 + Math.imul(R32(0x60eec), 0x18c), (R32(0x45f00) + 2) | 0);  // 17642..17655
  W32(0x4621c + Math.imul(R32(0x60eec), 0x18c), (R32(0x45f04) + 7) | 0);  // 1765b..1766e
  W32(0x46228 + Math.imul(R32(0x60eec), 0x18c), 7);                       // 17674
  W32(0x46388 + Math.imul(R32(0x60eec), 0x18c), 1);                       // 17688

  // 1769c
  W32(0x60eec, (R32(0x60eec) + 1) | 0);
  if (R32(0x60eec) >= 0x3f) {
    W32(0x60eec, 0);                                                      // 176ab
  }
  W32(0x46218 + Math.imul(R32(0x60eec), 0x18c), (R32(0x45f00) - 2) | 0);  // 176b5..176c8
  W32(0x4621c + Math.imul(R32(0x60eec), 0x18c), (R32(0x45f04) + 7) | 0);  // 176ce..176e1
  W32(0x46228 + Math.imul(R32(0x60eec), 0x18c), 4);                       // 176e7
  W32(0x46388 + Math.imul(R32(0x60eec), 0x18c), 1);                       // 176fb

  // 1770f: switch on [0x46068] (0x45f00.curr_frame); 1776c: cmp 4; ja default (unsigned);
  // jump table at 0x17758: 0x17719, 0x17722, 0x17732, 0x1773b, 0x1774b; default 0x17754 -> 0x1777e
  sw = R32(0x46068);
  switch (sw >>> 0) {
    case 0:
      W32(0x45f00, (R32(0x45f00) - 0xa) | 0);                             // 17719
      break;
    case 1:
      W32(0x45f00, (R32(0x45f00) - 7) | 0);                               // 17722
      W32(0x45f04, (R32(0x45f04) - 5) | 0);                               // 17729
      break;
    case 2:
      W32(0x45f04, (R32(0x45f04) - 8) | 0);                               // 17732
      break;
    case 3:
      W32(0x45f00, (R32(0x45f00) + 7) | 0);                               // 1773b
      W32(0x45f04, (R32(0x45f04) - 5) | 0);                               // 17742
      break;
    case 4:
      W32(0x45f00, (R32(0x45f00) + 0xa) | 0);                             // 1774b
      break;
    default:
      break;                                                              // 17754
  }

  // 1777e..177e5: ((x+w > X && x < X) || (X+W > x && x > X)) && Y+H > y && Y-9 < y
  if (((((R32(0x45f00) + R32(0x45f08)) | 0) > R32(0x4608c) && R32(0x45f00) < R32(0x4608c)) ||
       (((R32(0x4608c) + R32(0x46094)) | 0) > R32(0x45f00) && R32(0x45f00) > R32(0x4608c))) &&
      ((R32(0x46090) + R32(0x46098)) | 0) > R32(0x45f04) &&
      ((R32(0x46090) - 9) | 0) < R32(0x45f04)) {
    W32(0x60b90, (R32(0x4608c) - 0xc) | 0);                               // 177ea
    W32(0x60b94, (R32(0x46090) - 0x16) | 0);                              // 177f7
    W32(0x60b58 + (R32(0x60b8c) << 2), 0x33);                             // 17804..1780c
    await F.sub_1352c();                                                  // 17816
    await F.dws_DDiscard_1f770(R16(0x6128a));                             // 1781b..17829 (cdecl)
    await F.dws_DPlay_1eff8(0x61280);                                     // 1782c..17837 (cdecl)
    W32(0x46070, 0);                                                      // 1783a
    W32(0x461fc, 0);                                                      // 17844

    // 1784e..1799a: sprites 0x35b20 + i*0x18c, i < 0x19
    for (i = 0; i < 0x19; i++) {
      // 17867..178db: Y-22 < s.y && Y+22 > s.y && s.x+s.w > X-17 && X+30 > s.x
      if (((R32(0x46090) - 0x16) | 0) < R32(0x35b24 + i * 0x18c) &&
          ((R32(0x46090) + 0x16) | 0) > R32(0x35b24 + i * 0x18c) &&
          ((R32(0x35b20 + i * 0x18c) + R32(0x35b28 + i * 0x18c)) | 0) > ((R32(0x4608c) - 0x11) | 0) &&
          ((R32(0x4608c) + 0x1e) | 0) > R32(0x35b20 + i * 0x18c)) {
        r = await F.rand_232c7();                                         // 178e0
        if (imod(r, 0xa) === 1) {                                         // 178e5..178f6
          if (R32(0x35b20 + i * 0x18c) > 0xa0) {                          // 178f8
            W32(0x35c90 + i * 0x18c, 2);                                  // 1790b state
          } else {
            W32(0x35c90 + i * 0x18c, 3);                                  // 1791e state
          }
          r = await F.rand_232c7();                                       // 1792f
          W32(0x35c88 + i * 0x18c, (imod(r, 3) + 0x13) | 0);              // 17934..1794c curr_frame
        } else {
          W32(0x35c90 + i * 0x18c, 4);                                    // 17954 state
          W32(0x35c88 + i * 0x18c, 0x15);                                 // 17965 curr_frame
        }
        await F.dws_DDiscard_1f770(R16(0x6132a));                         // 17976..17984 (cdecl)
        await F.dws_DPlay_1eff8(0x61320);                                 // 17987..17992 (cdecl)
      }
    }
  }

  // 1799a..17b31: sprites 0x33f48 + j*0x18c, j < 5
  for (j = 0; j < 5; j++) {
    // 179b3..17a31: s.x+10 < x && s.x+s.w-10 > x && s.y+s.h-5 > y && s.y+5 < y
    if (((R32(0x33f48 + j * 0x18c) + 0xa) | 0) < R32(0x45f00) &&
        ((((R32(0x33f48 + j * 0x18c) + R32(0x33f50 + j * 0x18c)) | 0) - 0xa) | 0) > R32(0x45f00) &&
        ((((R32(0x33f4c + j * 0x18c) + R32(0x33f54 + j * 0x18c)) | 0) - 5) | 0) > R32(0x45f04) &&
        ((R32(0x33f4c + j * 0x18c) + 5) | 0) < R32(0x45f04)) {
      W32(0x33f5c + j * 0x18c, -5);                                       // 17a36 counter_2
      o = Math.imul(j, 0x18c);                                            // 17a47 ecx
      r = await F.rand_232c7();                                           // 17a4e
      d = imod(r, 3);                                                     // 17a53..17a61 ebx
      r = await F.rand_232c7();                                           // 17a63
      d = (d - imod(r, 3)) | 0;                                           // 17a68..17a76 sub ebx, edx
      W32(0x33f48 + o, (R32(0x33f48 + o) + d) | 0);                       // 17a78 x
      o = Math.imul(j, 0x18c);                                            // 17a7e ecx
      r = await F.rand_232c7();                                           // 17a85
      d = imod(r, 3);                                                     // 17a8a..17a98
      r = await F.rand_232c7();                                           // 17a9a
      d = (d - imod(r, 3)) | 0;                                           // 17a9f..17aad
      W32(0x33f4c + o, (R32(0x33f4c + o) + d) | 0);                       // 17aaf y
      W32(0x46070, 0);                                                    // 17ab5
      W32(0x461fc, 0);                                                    // 17abf
      W32(0x60b90, (R32(0x45f00) - 0xc) | 0);                             // 17ac9
      W32(0x60b94, (R32(0x45f04) - 0x16) | 0);                            // 17ad8
      W32(0x60b58 + (R32(0x60b8c) << 2), 0x33);                           // 17ae7..17af0
      await F.sub_1352c();                                                // 17afa
      await F.dws_DDiscard_1f770(R16(0x6128a));                           // 17aff..17b0e (cdecl)
      await F.dws_DPlay_1eff8(0x61280);                                   // 17b11..17b1c (cdecl)
      W32(0x60a68, (R32(0x60a68) + 0x64) | 0);                            // 17b1f
      W32(0x60a6c, (R32(0x60a6c) + 1) | 0);                               // 17b26
    }
  }

  // 17b31..17b86: P = 0x5fc04: P.x-3 < x && P.x+P.w+3 > x && P.y+P.h+3 > y && P.y-3 < y
  if (((R32(0x5fc04) - 3) | 0) < R32(0x45f00) &&
      ((((R32(0x5fc04) + R32(0x5fc0c)) | 0) + 3) | 0) > R32(0x45f00) &&
      ((((R32(0x5fc08) + R32(0x5fc10)) | 0) + 3) | 0) > R32(0x45f04) &&
      ((R32(0x5fc08) - 3) | 0) < R32(0x45f04)) {
    W32(0x46070, 0);                                                      // 17b86
    W32(0x461fc, 0);                                                      // 17b90
    W32(0x5fd74, 0);                                                      // 17b9a 0x5fc04.state
    W32(0x60b90, (R32(0x45f00) - 0xc) | 0);                               // 17ba4
    W32(0x60b94, (R32(0x45f04) - 0x16) | 0);                              // 17bb1
    W32(0x60b58 + (R32(0x60b8c) << 2), 0x33);                             // 17bbe..17bc6
    await F.sub_1352c();                                                  // 17bd0
    await F.dws_DDiscard_1f770(R16(0x6128a));                             // 17bd5..17be3 (cdecl)
    await F.dws_DPlay_1eff8(0x61280);                                     // 17be6..17bf1 (cdecl)
    W32(0x60a6c, (R32(0x60a6c) + 1) | 0);                                 // 17bf4
    W32(0x60a68, (R32(0x60a68) + 0x7d1) | 0);                             // 17bfa
  }

  // 17c04..17ef5: sprites 0x35b20 + i*0x18c, i < 0x19
  for (i = 0; i < 0x19; i++) {
    // 17c1d..17cb0: x+w > s.x && s.x+s.w > x && y > s.y && s.y+17 > y && (s.state == 0x1c || s.state == 0x1b)
    if (((R32(0x45f00) + R32(0x45f08)) | 0) > R32(0x35b20 + i * 0x18c) &&
        ((R32(0x35b20 + i * 0x18c) + R32(0x35b28 + i * 0x18c)) | 0) > R32(0x45f00) &&
        R32(0x45f04) > R32(0x35b24 + i * 0x18c) &&
        ((R32(0x35b24 + i * 0x18c) + 0x11) | 0) > R32(0x45f04) &&
        (R32(0x35c90 + i * 0x18c) === 0x1c || R32(0x35c90 + i * 0x18c) === 0x1b)) {
      W32(0x35c90 + i * 0x18c, 0x21);                                     // 17cb5 state
      W32(0x35b34 + i * 0x18c, 0);                                        // 17cc6 counter_2
      W32(0x35c88 + i * 0x18c, 5);                                        // 17cd7 curr_frame
      r = await F.rand_232c7();                                           // 17ce8
      W32(0x60ee0, imod(r, 3));                                           // 17ced..17cfb
      await F.dws_DDiscard_1f770(R16(0x612aa));                           // 17d01..17d10 (cdecl)
      await F.dws_DDiscard_1f770(R16(0x612ca));                           // 17d13..17d22 (cdecl)
      await F.dws_DDiscard_1f770(R16(0x612ea));                           // 17d25..17d34 (cdecl)
      if (R32(0x60ee0) === 0) {                                           // 17d37
        await F.dws_DPlay_1eff8(0x612a0);                                 // 17d40..17d4b (cdecl)
      }
      if (R32(0x60ee0) === 1) {                                           // 17d4e
        await F.dws_DPlay_1eff8(0x612c0);                                 // 17d57..17d62 (cdecl)
      }
      if (R32(0x60ee0) === 2) {                                           // 17d65
        await F.dws_DPlay_1eff8(0x612e0);                                 // 17d6e..17d79 (cdecl)
      }
      W32(0x60a68, (R32(0x60a68) + 0xf) | 0);                             // 17d7c
      W32(0x60a6c, (R32(0x60a6c) + 1) | 0);                               // 17d83
    }
    // 17d89..17e29: x+w > s.x && s.x+s.w > x && s.y+17 < y && s.y+s.h > y && (s.state == 0x1c || s.state == 0x1b)
    if (((R32(0x45f00) + R32(0x45f08)) | 0) > R32(0x35b20 + i * 0x18c) &&
        ((R32(0x35b20 + i * 0x18c) + R32(0x35b28 + i * 0x18c)) | 0) > R32(0x45f00) &&
        ((R32(0x35b24 + i * 0x18c) + 0x11) | 0) < R32(0x45f04) &&
        ((R32(0x35b24 + i * 0x18c) + R32(0x35b2c + i * 0x18c)) | 0) > R32(0x45f04) &&
        (R32(0x35c90 + i * 0x18c) === 0x1c || R32(0x35c90 + i * 0x18c) === 0x1b)) {
      r = await F.rand_232c7();                                           // 17e2e
      if (imod(r, 0xa) === 1) {                                           // 17e33..17e44
        if (R32(0x35b20 + i * 0x18c) > 0xa0) {                            // 17e46
          W32(0x35c90 + i * 0x18c, 2);                                    // 17e59 state
        } else {
          W32(0x35c90 + i * 0x18c, 3);                                    // 17e6c state
        }
        r = await F.rand_232c7();                                         // 17e7d
        W32(0x35c88 + i * 0x18c, (imod(r, 3) + 0x13) | 0);                // 17e82..17e9a curr_frame
      } else {
        W32(0x35c90 + i * 0x18c, 4);                                      // 17ea2 state
        W32(0x35c88 + i * 0x18c, 0x15);                                   // 17eb3 curr_frame
      }
      await F.dws_DDiscard_1f770(R16(0x6132a));                           // 17ec4..17ed2 (cdecl)
      await F.dws_DPlay_1eff8(0x61320);                                   // 17ed5..17ee0 (cdecl)
      W32(0x60a68, (R32(0x60a68) + 0xb) | 0);                             // 17ee3
      W32(0x60a6c, (R32(0x60a6c) + 1) | 0);                               // 17eea
    }
  }

  // 17ef5..18088: sprites 0x3d23c + j*0x18c, j < 4
  for (j = 0; j < 4; j++) {
    // 17f0e..17f99: x+w > s.x && s.x+s.w > x && y > s.y && s.y+s.h > y && s.state == 1
    if (((R32(0x45f00) + R32(0x45f08)) | 0) > R32(0x3d23c + j * 0x18c) &&
        ((R32(0x3d23c + j * 0x18c) + R32(0x3d244 + j * 0x18c)) | 0) > R32(0x45f00) &&
        R32(0x45f04) > R32(0x3d240 + j * 0x18c) &&
        ((R32(0x3d240 + j * 0x18c) + R32(0x3d248 + j * 0x18c)) | 0) > R32(0x45f04) &&
        R32(0x3d3ac + j * 0x18c) === 1) {
      W32(0x3d3ac + j * 0x18c, 0);                                        // 17f9e state
      W32(0x60b90, (R32(0x3d23c + j * 0x18c) - 0xc) | 0);                 // 17faf
      W32(0x60b94, (R32(0x3d240 + j * 0x18c) - 0x16) | 0);                // 17fc4
      W32(0x60b58 + (R32(0x60b8c) << 2), 0x33);                           // 17fd9..17fe1
      await F.sub_1352c();                                                // 17feb
      await F.dws_DDiscard_1f770(R16(0x6128a));                           // 17ff0..17ffe (cdecl)
      await F.dws_DPlay_1eff8(0x61280);                                   // 18001..1800c (cdecl)
      W32(0x46070, 0);                                                    // 1800f
      W32(0x461fc, 0);                                                    // 18019
      W32(0x60b90, (R32(0x45f00) - 0xc) | 0);                             // 18023
      W32(0x60b94, (R32(0x45f04) - 0x16) | 0);                            // 18030
      W32(0x60b58 + (R32(0x60b8c) << 2), 0x33);                           // 1803d..18045
      await F.sub_1352c();                                                // 1804f
      await F.dws_DDiscard_1f770(R16(0x6128a));                           // 18054..18062 (cdecl)
      await F.dws_DPlay_1eff8(0x61280);                                   // 18065..18070 (cdecl)
      W32(0x60a68, (R32(0x60a68) + 0x1f5) | 0);                           // 18073
      W32(0x60a6c, (R32(0x60a6c) + 1) | 0);                               // 1807d
    }
  }

  // 18088..18275: sprite 0x3d0b0 + k*0x18c, k < 1
  for (k = 0; k < 1; k++) {
    // 180a1..1812c: x+w > s.x && s.x+s.w > x && y > s.y && s.y+s.h > y && s.state != 0
    if (((R32(0x45f00) + R32(0x45f08)) | 0) > R32(0x3d0b0 + k * 0x18c) &&
        ((R32(0x3d0b0 + k * 0x18c) + R32(0x3d0b8 + k * 0x18c)) | 0) > R32(0x45f00) &&
        R32(0x45f04) > R32(0x3d0b4 + k * 0x18c) &&
        ((R32(0x3d0b4 + k * 0x18c) + R32(0x3d0bc + k * 0x18c)) | 0) > R32(0x45f04) &&
        R32(0x3d220 + k * 0x18c) !== 0) {
      W32(0x3d220 + k * 0x18c, 0);                                        // 18131 state
      // 18142..181e8: j < 4
      for (j = 0; j < 4; j++) {
        o = Math.imul(k, 0x18c);                                          // 1815b ecx
        r = await F.rand_232c7();                                         // 18162
        d = imod(r, 0x1e);                                                // 18167..18173 edx
        W32(0x60b90, (d + R32(0x3d0b0 + o)) | 0);                         // 18175..1817d s.x + rand%30
        o = Math.imul(k, 0x18c);                                          // 18183 ecx
        r = await F.rand_232c7();                                         // 1818a
        d = imod(r, 0x14);                                                // 1818f..1819b
        W32(0x60b94, (d + R32(0x3d0b4 + o)) | 0);                         // 1819d..181a5 s.y + rand%20
        W32(0x60b58 + (R32(0x60b8c) << 2), 0x33);                         // 181ab..181b4
        await F.sub_1352c();                                              // 181be
        await F.dws_DDiscard_1f770(R16(0x6128a));                         // 181c3..181d2 (cdecl)
        await F.dws_DPlay_1eff8(0x61280);                                 // 181d5..181e0 (cdecl)
      }
      W32(0x60a68, (R32(0x60a68) + 0x12c) | 0);                           // 181e8
      W32(0x60a6c, (R32(0x60a6c) + 1) | 0);                               // 181f2
      W32(0x46070, 0);                                                    // 181f8
      W32(0x461fc, 0);                                                    // 18202
      W32(0x46070, 0);                                                    // 1820c (repeated store in the binary)
      W32(0x461fc, 0);                                                    // 18216 (repeated store in the binary)
      W32(0x60b90, (R32(0x45f00) - 0xc) | 0);                             // 18220
      W32(0x60b94, (R32(0x45f04) - 0x16) | 0);                            // 1822d
      W32(0x60b58 + (R32(0x60b8c) << 2), 0x33);                           // 1823a..18242
      await F.sub_1352c();                                                // 1824c
      await F.dws_DDiscard_1f770(R16(0x6128a));                           // 18251..1825f (cdecl)
      await F.dws_DPlay_1eff8(0x61280);                                   // 18262..1826d (cdecl)
    }
  }

  // 18275..18405: sprites 0x3d86c + j*0x18c, j < 3
  for (j = 0; j < 3; j++) {
    // 1828e..18319: x+w > s.x && s.x+s.w > x && y > s.y && s.y+s.h > y && s.state != 0
    if (((R32(0x45f00) + R32(0x45f08)) | 0) > R32(0x3d86c + j * 0x18c) &&
        ((R32(0x3d86c + j * 0x18c) + R32(0x3d874 + j * 0x18c)) | 0) > R32(0x45f00) &&
        R32(0x45f04) > R32(0x3d870 + j * 0x18c) &&
        ((R32(0x3d870 + j * 0x18c) + R32(0x3d878 + j * 0x18c)) | 0) > R32(0x45f04) &&
        R32(0x3d9dc + j * 0x18c) !== 0) {
      W32(0x3d9dc + j * 0x18c, 0);                                        // 1831e state
      W32(0x60b90, (R32(0x3d86c + j * 0x18c) - 0xc) | 0);                 // 1832f
      W32(0x60b94, (R32(0x3d870 + j * 0x18c) - 0x16) | 0);                // 18344
      W32(0x60b58 + (R32(0x60b8c) << 2), 0x33);                           // 18359..18361
      await F.sub_1352c();                                                // 1836b
      await F.dws_DDiscard_1f770(R16(0x6128a));                           // 18370..1837e (cdecl)
      await F.dws_DPlay_1eff8(0x61280);                                   // 18381..1838c (cdecl)
      W32(0x60a68, (R32(0x60a68) + 0x64) | 0);                            // 1838f
      W32(0x60a6c, (R32(0x60a6c) + 1) | 0);                               // 18396
      W32(0x46070, 0);                                                    // 1839c
      W32(0x461fc, 0);                                                    // 183a6
      W32(0x60b90, (R32(0x45f00) - 0xc) | 0);                             // 183b0
      W32(0x60b94, (R32(0x45f04) - 0x16) | 0);                            // 183bd
      W32(0x60b58 + (R32(0x60b8c) << 2), 0x33);                           // 183ca..183d2
      await F.sub_1352c();                                                // 183dc
      await F.dws_DDiscard_1f770(R16(0x6128a));                           // 183e1..183ef (cdecl)
      await F.dws_DPlay_1eff8(0x61280);                                   // 183f2..183fd (cdecl)
    }
  }

  // 18405..1845a: B = 0x4c38c: x+w > B.x && B.x+B.w > x && y > B.y && B.y+B.h > y && B.state != 0
  if (((R32(0x45f00) + R32(0x45f08)) | 0) > R32(0x4c38c) &&
      ((R32(0x4c38c) + R32(0x4c394)) | 0) > R32(0x45f00) &&
      R32(0x45f04) > R32(0x4c390) &&
      ((R32(0x4c390) + R32(0x4c398)) | 0) > R32(0x45f04) &&
      R32(0x4c4fc) !== 0) {
    W32(0x4c3ac, (R32(0x4c3ac) - 0xf) | 0);                               // 1845f threshold_2 -= 15
    W32(0x4c3a0, Math.imul(R32(0x4c3a0), -1));                            // 18466..1846d counter_2 *= -1
    await F.dws_DDiscard_1f770(R16(0x6126a));                             // 18472..18480 (cdecl)
    await F.dws_DPlay_1eff8(0x61260);                                     // 18483..1848e (cdecl)
    W32(0x46070, 0);                                                      // 18491
    W32(0x461fc, 0);                                                      // 1849b
    W32(0x60b90, (R32(0x45f00) - 0xc) | 0);                               // 184a5
    W32(0x60b94, (R32(0x45f04) - 0x16) | 0);                              // 184b2
    W32(0x60b58 + (R32(0x60b8c) << 2), 0x33);                             // 184bf..184c7
    await F.sub_1352c();                                                  // 184d1
    await F.dws_DDiscard_1f770(R16(0x6128a));                             // 184d6..184e4 (cdecl)
    await F.dws_DPlay_1eff8(0x61280);                                     // 184e7..184f2 (cdecl)
  }

  // 184f5: [0x4c3ac] > 0 (jg) -> end; [0x4c4fc] == 0 -> end
  if (R32(0x4c3ac) <= 0 && R32(0x4c4fc) !== 0) {
    W32(0x4c4fc, 0);                                                      // 1850c state
    // 18516..185a6: j < 4
    for (j = 0; j < 4; j++) {
      r = await F.rand_232c7();                                           // 1852b
      d = imod(r, 0x1e);                                                  // 18530..1853c edx
      W32(0x60b90, (R32(0x4c38c) + d) | 0);                               // 1853e..18545
      r = await F.rand_232c7();                                           // 1854a
      d = imod(r, 0x14);                                                  // 1854f..1855b
      W32(0x60b94, (d + R32(0x4c390)) | 0);                               // 1855d..18564
      W32(0x60b58 + (R32(0x60b8c) << 2), 0x33);                           // 1856a..18573
      await F.sub_1352c();                                                // 1857d
      await F.dws_DDiscard_1f770(R16(0x6128a));                           // 18582..18590 (cdecl)
      await F.dws_DPlay_1eff8(0x61280);                                   // 18593..1859e (cdecl)
    }
    W32(0x60a68, (R32(0x60a68) + 0x3e8) | 0);                             // 185a6
    W32(0x60a6c, (R32(0x60a6c) + 1) | 0);                                 // 185b0
  }
  // 185b6: epilogue
});
