// 0x1e3d9  {eax, ebx} sub_1e3d9(BYTE *song)
//          [1 stack arg, callee pops (`ret 4`); returns registers (argc_overrides.json 0x1e3d9: retregs eax/ebx,
//           retregsIf eax==0 -> eax only)]
// DiamondWare STK client: checks a DWM song header. Compares the first four dwords of `song` with
// 'Diam' 'ondW' 'are ' 'Musi' (0x6d616944, 0x57646e6f, 0x20657261, 0x6973754d — the first 16 bytes of every
// .DWM file, e.g. assets/game/F1.DWM "DiamondWare Musi"). Nothing else in the header is checked (no version
// compare: the bytes at song+0x10..0x17 are skipped by `add ebx,8; add ebx,4`).
// Success: EAX = 1, EBX = dword [song+0x18] + dword [song+0x24] (0x1e41b..0x1e422).
// Failure (first mismatching dword): F.sub_1e3ba(0x10) (stores 0x10 at 0x30c7f, the STK client last-error code;
// see src/lib/1e3ba_sub_1e3ba.js), EAX = 0.
// Only caller: dws_MPlay 0x1fb25 — `cmp eax,0; je` then reads EBX at 0x1fb33 (`mov [ebp-0x14], ebx`).
// On failure EBX is a leftover (song + offset of the failing dword) that the caller does not read -> {eax: 0}.
// Callee key: 0x1e3ba is not named in re/names.tsv -> sub_1e3ba.
import { F, register } from '../runtime/registry.js';
import { R32 } from '../runtime/mem.js';

register(0x1e3d9, 'sub_1e3d9', function sub_1e3d9(song) {
  // 1e3d9, 1e3da: push ebp; mov ebp, esp
  fail: {
    let ebx = song;                                           // 1e3dc: mov ebx, dword ptr ds:[ebp + 8]
    if (R32(ebx) !== 0x6d616944) break fail;                  // 1e3e0..1e3e9: mov eax,[ebx]; cmp eax,'Diam'; je/jmp 1e42d
    ebx = (ebx + 4) | 0;                                      // 1e3eb: add ebx, 4
    if (R32(ebx) !== 0x57646e6f) break fail;                  // 1e3ee..1e3f7: cmp eax,'ondW'
    ebx = (ebx + 4) | 0;                                      // 1e3f9: add ebx, 4
    if (R32(ebx) !== 0x20657261) break fail;                  // 1e3fc..1e405: cmp eax,'are '
    ebx = (ebx + 4) | 0;                                      // 1e407: add ebx, 4
    if (R32(ebx) !== 0x6973754d) break fail;                  // 1e40a..1e413: cmp eax,'Musi'
    ebx = (ebx + 8) | 0;                                      // 1e415: add ebx, 8
    ebx = (ebx + 4) | 0;                                      // 1e418: add ebx, 4   (song + 0x18)
    let eax = R32(ebx);                                       // 1e41b: mov eax, dword ptr [ebx]
    ebx = (ebx + 0xc) | 0;                                    // 1e41d: add ebx, 0xc  (song + 0x24)
    eax = (eax + R32(ebx)) | 0;                               // 1e420: add eax, dword ptr [ebx]
    ebx = eax;                                                // 1e422: mov ebx, eax
    eax = 1;                                                  // 1e424: mov eax, 1
    return { eax, ebx };                                      // 1e429, 1e42a: leave; ret 4
  }
  F.sub_1e3ba(0x10);                                          // 1e42d, 1e432: mov eax, 0x10; call 0x1e3ba
  return { eax: 0 };                                          // 1e437, 1e439: xor eax, eax; jmp 1e429 (leave; ret 4)
});
