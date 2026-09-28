// 0x10050  void sub_10050(void)   [Watcom, no args, no return value]
// Calls dws_MSongStatus(0x60f16). If bit 0 of the status byte at 0x60f16 is clear, advances the index at
// 0x30c1c (wraps to 0 when it becomes > 11, signed compare), and dispatches through the 12-entry jump table at
// 0x10278 (index compared UNSIGNED against 11: a negative index takes the default, which does nothing):
//   index 0..10 -> dws_MPlay(0x610a0 / 0x61070 / 0x61080 / 0x61090 / 0x610b0 / 0x610c0 / 0x610d0 / 0x610e0 /
//                  0x610f0 / 0x61100 / 0x61110);
//   index 1..11 -> additionally (after the MPlay, if any) dws_DPlay(0x614c0 + (index-1)*0x20) when
//                  dword [0x30c20] != 0 (index 0 has no DPlay; index 11 has no MPlay);
// then calls dws_MSongStatus(0x60f16) again. Nothing when bit 0 is set.
// Jump table 0x10278 (dwords): 0x100a9, 0x100bc, 0x100e6, 0x10110, 0x1013a, 0x10164, 0x1018e, 0x101b8,
// 0x101e2, 0x1020c, 0x10236, 0x1025d; out of range (ja at 0x102ac) -> 0x10276 `jmp 0x102ba`.
// 0x60f16: WORD written by dws_MSongStatus through its pointer (1fc3f_dws_MSongStatus.js); only its low byte
// is tested here (0x10076 `test byte ptr [0x60f16], 1`).
// 0x60f16 / 0x30c1c / 0x30c20 / 0x610a0.. (dws_MPLAY structs, per the callee) / 0x614c0.. (dws_DPLAY structs,
// per the callee): pointers passed as-is (see LIBRARY.md for the MPLAY/DPLAY layouts).
// Return: EAX at RET is a leftover (callee result / constant); signatures.json returns=false -> nothing returned.
import { F, register } from '../runtime/registry.js';
import { R8, R32, W32 } from '../runtime/mem.js';

register(0x10050, 'sub_10050', function sub_10050() {
  let idx; // [ebp-4]

  F.dws_MSongStatus_1fc3f(0x60f16); // 1006e
  if ((R8(0x60f16) & 1) !== 0) return; // 10076 test byte; jne 0x102c8 (epilogue)
  W32(0x30c1c, (R32(0x30c1c) + 1) | 0); // 10083 inc dword
  if (!((R32(0x30c1c) | 0) <= 0xb)) { // 10089 cmp 0xb; jle (signed)
    W32(0x30c1c, 0); // 10092
  }
  idx = R32(0x30c1c) | 0; // 1009c..100a1
  // 102a8: cmp [ebp-4], 0xb; ja 0x10276 (unsigned) -> default; else jmp [idx*4 + 0x10278]
  switch ((idx >>> 0) > 0xb ? -1 : idx) {
    case 0: // 100a9
      F.dws_MPlay_1faa2(0x610a0);
      break;
    case 1: // 100bc
      F.dws_MPlay_1faa2(0x61070);
      if (R32(0x30c20) !== 0) {
        F.dws_DPlay_1eff8(0x614c0);
      }
      break;
    case 2: // 100e6
      F.dws_MPlay_1faa2(0x61080);
      if (R32(0x30c20) !== 0) {
        F.dws_DPlay_1eff8(0x614e0);
      }
      break;
    case 3: // 10110
      F.dws_MPlay_1faa2(0x61090);
      if (R32(0x30c20) !== 0) {
        F.dws_DPlay_1eff8(0x61500);
      }
      break;
    case 4: // 1013a
      F.dws_MPlay_1faa2(0x610b0);
      if (R32(0x30c20) !== 0) {
        F.dws_DPlay_1eff8(0x61520);
      }
      break;
    case 5: // 10164
      F.dws_MPlay_1faa2(0x610c0);
      if (R32(0x30c20) !== 0) {
        F.dws_DPlay_1eff8(0x61540);
      }
      break;
    case 6: // 1018e
      F.dws_MPlay_1faa2(0x610d0);
      if (R32(0x30c20) !== 0) {
        F.dws_DPlay_1eff8(0x61560);
      }
      break;
    case 7: // 101b8
      F.dws_MPlay_1faa2(0x610e0);
      if (R32(0x30c20) !== 0) {
        F.dws_DPlay_1eff8(0x61580);
      }
      break;
    case 8: // 101e2
      F.dws_MPlay_1faa2(0x610f0);
      if (R32(0x30c20) !== 0) {
        F.dws_DPlay_1eff8(0x615a0);
      }
      break;
    case 9: // 1020c
      F.dws_MPlay_1faa2(0x61100);
      if (R32(0x30c20) !== 0) {
        F.dws_DPlay_1eff8(0x615c0);
      }
      break;
    case 10: // 10236
      F.dws_MPlay_1faa2(0x61110);
      if (R32(0x30c20) !== 0) {
        F.dws_DPlay_1eff8(0x615e0);
      }
      break;
    case 11: // 1025d (no MPlay)
      if (R32(0x30c20) !== 0) {
        F.dws_DPlay_1eff8(0x61600);
      }
      break;
    default: // 10276: jmp 0x102ba
      break;
  }
  F.dws_MSongStatus_1fc3f(0x60f16); // 102ba..102c0
});
