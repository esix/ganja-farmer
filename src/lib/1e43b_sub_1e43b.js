// 0x1e43b  {eax, ebx} sub_1e43b(BYTE *snd)
//          [1 stack arg, callee pops (`ret 4`); returns registers (argc_overrides.json 0x1e43b: retregs eax/ebx,
//           retregsIf eax==0 -> eax only)]
// DiamondWare STK client: checks a DWD sound header. Compares the first four dwords of `snd` with
// 'Diam' 'ondW' 'are ' 'Digi' (0x6d616944, 0x57646e6f, 0x20657261, 0x69676944 — the first 16 bytes of every
// .DWD file, e.g. assets/game/F1.DWD "DiamondWare Digitized\n\0\x1a"). Nothing else in the header is checked
// (no version compare).
// Success: EAX = 1, EBX = dword [snd+0x26] + dword [snd+0x2e] (0x1e477..0x1e485).
// Failure (first mismatching dword): F.sub_1e3ba(0xa) (stores 0xa at 0x30c7f, the STK client last-error code;
// see src/lib/1e3ba_sub_1e3ba.js), EAX = 0.
// Only caller: dws_DPlay 0x1f07b — `cmp eax,0; je` then reads EBX at 0x1f089 (`mov [ebp-0x18], ebx`).
// On failure EBX is a leftover (snd + offset of the failing dword) that the caller does not read -> {eax: 0}.
// Callee key: 0x1e3ba is not named in re/names.tsv -> sub_1e3ba.
import { F, register } from '../runtime/registry.js';
import { R32 } from '../runtime/mem.js';

register(0x1e43b, 'sub_1e43b', function sub_1e43b(snd) {
  // 1e43b, 1e43c: push ebp; mov ebp, esp
  fail: {
    let ebx = snd;                                            // 1e43e: mov ebx, dword ptr ds:[ebp + 8]
    if (R32(ebx) !== 0x6d616944) break fail;                  // 1e442..1e44b: mov eax,[ebx]; cmp eax,'Diam'; je/jmp 1e490
    ebx = (ebx + 4) | 0;                                      // 1e44d: add ebx, 4
    if (R32(ebx) !== 0x57646e6f) break fail;                  // 1e450..1e459: cmp eax,'ondW'
    ebx = (ebx + 4) | 0;                                      // 1e45b: add ebx, 4
    if (R32(ebx) !== 0x20657261) break fail;                  // 1e45e..1e467: cmp eax,'are '
    ebx = (ebx + 4) | 0;                                      // 1e469: add ebx, 4
    if (R32(ebx) !== 0x69676944) break fail;                  // 1e46c..1e475: cmp eax,'Digi'
    ebx = snd;                                                // 1e477: mov ebx, dword ptr ds:[ebp + 8]
    ebx = (ebx + 0x26) | 0;                                   // 1e47b: add ebx, 0x26  (snd + 0x26)
    let eax = R32(ebx);                                       // 1e47e: mov eax, dword ptr [ebx]
    ebx = (ebx + 8) | 0;                                      // 1e480: add ebx, 8     (snd + 0x2e)
    eax = (eax + R32(ebx)) | 0;                               // 1e483: add eax, dword ptr [ebx]
    ebx = eax;                                                // 1e485: mov ebx, eax
    eax = 1;                                                  // 1e487: mov eax, 1
    return { eax, ebx };                                      // 1e48c, 1e48d: leave; ret 4
  }
  F.sub_1e3ba(0xa);                                           // 1e490, 1e495: mov eax, 0xa; call 0x1e3ba
  return { eax: 0 };                                          // 1e49a, 1e49c: xor eax, eax; jmp 1e48c (leave; ret 4)
});
