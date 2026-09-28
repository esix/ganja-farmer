// 0x1faa2  void dws_MPlay(mp)   [cdecl, 1 stack arg: [ebp+8] = mp (32-bit near pointer, DS-relative, to a
//          dws_MPLAY, LIBRARY.md); EBX/ECX/EDX/DS/ES/ESI/EDI saved/restored; no return value used, see below]
// DiamondWare STK client wrapper for STK function 0x12 (dws_MPlay, LIBRARY.md). Same frame as
// 1ff4f_dwt_Init.js / 1ffe0_dwt_Kill.js / 1ea27_dws_DetectHardWare.js (DS check at 0x30c61, magic 0x31088,
// re-entry byte 0x31086, error setter 0x1e3ba, session open 0x1e8d1 (once) / close 0x1e971).
// Inside the session:
//   song = mp->track (dword [mp], LIBRARY.md +0 `BYTE *track`).
//   0x1e3d9(song) (stdcall, `ret 4`): checks the 16-byte DWM signature "DiamondWare Musi" (0x1e3e2..0x1e40c);
//     on success EAX = 1 and EBX = dword [song+0x18] + dword [song+0x24] (0x1e415..0x1e422) — used below as the
//     song size; on failure error 0x10 via 0x1e3ba and EAX = 0 (EBX not read then). The port expects
//     {eax, ebx} (retregs convention) (re/difftest/argc_overrides.json entry 0x1e3d9).
//   0x1fd9b() (STK fn 0x14), 0x1e5f6(): each must return non-zero.
//   0x1e597(size + 0x14) (stdcall, `ret 4`) records/allocates the DOS buffer; returns {eax, ebx, ecx, edx}
//     (argc_overrides "retregs"): EBX = real-mode far pointer seg:off of the buffer (kept at [ebp-4]),
//     CX = buffer selector ([ebp-6]), EDX = offset of the buffer in that selector ([ebp-0xc]).
//   Buffer layout (sel:off + n):
//     +0x00 word  high 16 bits of (farptr + 4)  } real-mode far pointer to the struct copy at +4
//     +0x02 word  low 16 bits of (farptr + 4)   }   (seg at +0, off at +2)
//     +0x04 16 bytes copied from mp (8 movsw), whose first dword was temporarily replaced by farptr + 0x14
//           (so the copy's `track` is the real-mode far pointer of the song copy); [mp] is restored to song
//           right after the copy (0x1fbdd..0x1fbe0).
//     +0x14 ((size >>> 2) + 1) dwords copied from song (rep movsd)
//   Then 0x1e37f(4, 0x12, farptr) = STK fn 0x12 with a 4-byte argument (the far pointer at +0), result
//   & 0xffff -> 0x1e3c0. Unlike dws_Init/dws_DetectHardWare the buffer is not released here (no 0x1e7a6).
// Return value: 0x1fc1c `mov eax, [ebp-0x10]` loads the 0x1e3c0 result and 0x1e971 preserves EAX
// (argc_overrides "preserves"); the early exits return 0 (EAX tested zero) or 0x1e3ba's EAX. But all 12 call
// sites (call instructions at 0x100af, 0x100c2, 0x100ec, ..., 0x23520) are followed by `add esp, 4` and never read EAX
// (signatures.json returns=false), so, as in 1ebe4_dws_Init.js, nothing is returned.
// UNCERTAIN: LIBRARY.md documents a WORD result 1/0; by the rule above the port returns nothing.
// Callee keys: 0x1e8d1 / 0x1e3d9 / 0x1fd9b / 0x1e5f6 / 0x1e597 / 0x1e37f / 0x1e3c0 / 0x1e971 / 0x1e3ba are not
// named in re/names.tsv -> sub_<addr>.
import { F, register } from '../runtime/registry.js';
import { R8, R16, R32, W8, W16, W32 } from '../runtime/mem.js';
import { SEL_CODE, SEL_DATA, selBase } from '../platform/dpmi.js';

register(0x1faa2, 'dws_MPlay_1faa2', function dws_MPlay(mp) {
  // 1faa2..1fab0: push ebp; mov ebp, esp; add esp, -0x18; push ebx/ecx/edx/ds/es/esi/edi; push eax
  // UNCERTAIN: DS at entry is the extender-chosen data selector; the port uses SEL_DATA (platform/dpmi.js),
  // as dwt_Init / dwt_Kill / dws_DetectHardWare do.
  let ds = SEL_DATA;
  check: {
    const csBase = selBase(SEL_CODE);              // cs: overrides below (base 0 under the flat model)
    if (R16(csBase + 0x30c61) !== 0) {                    // 1fab0: cmp word cs:[0x30c61], 0; je 1fad2
      if (R16(csBase + 0x30c61) === ds) break check;      // 1fabb..1fac6: mov ax, ds; cmp cs:[0x30c61], ax; je 1faf7
      ds = R16(csBase + 0x30c61);                         // 1fac8: mov ds, cs:[0x30c61]
      // 1fad0: je 1faf7 — flags still from the cmp at 1fabe (not equal), never taken
    }
    W16(selBase(ds) + 0x30c61, ds);              // 1fad2: mov word [0x30c61], ds   (DS-relative)
    // 1fad9..1fae5: mov eax, cs:[0x31088]; cmp eax, ds:[0x31088]; je 1faf7
    if (R32(csBase + 0x31088) === R32(selBase(ds) + 0x31088)) break check;
    // 1fae7: pop eax
    F.sub_1e3ba(0x29a);                          // 1fae8..1faed: mov eax, 0x29a; call 0x1e3ba
    return;                                      // 1faf2: jmp 1fc2a (pop edi..ebx; leave; ret — no dec)
  }
  // 1faf7: pop eax; 1faf8: xor eax, eax
  // UNCERTAIN: when DS was reloaded from 0x30c61 the callees below also run with that DS; the port cannot
  // pass a segment register to them (only reachable if 0x30c61 holds a selector other than SEL_DATA).
  const dsb = selBase(ds);
  W8(dsb + 0x31086, (R8(dsb + 0x31086) + 1) & 0xff);   // 1fafa: inc byte [0x31086]
  if (R8(dsb + 0x31086) === 1) {                 // 1fb00: cmp byte [0x31086], 1; jne 1fc33
    body: {
      if (F.sub_1e8d1() === 0) break body;       // 1fb0d..1fb15: call 0x1e8d1; cmp eax, 0; je 1fc1f
      // 1fb1b: mov ebx, [ebp+8]
      const song = R32(dsb + mp) >>> 0;          // 1fb1f: mov eax, [ebx]; 1fb21: mov [ebp-0x18], eax
      const sig = F.sub_1e3d9(song);             // 1fb24..1fb25: push eax; call 0x1e3d9 (callee pops 4)
      if (sig.eax === 0) break body;             // 1fb2a: cmp eax, 0; je 1fc1f
      const size = sig.ebx >>> 0;                // 1fb33: mov [ebp-0x14], ebx
      const clr = F.sub_1fd9b();                 // 1fb36: call 0x1fd9b
      if (clr === 0) break body;                 // 1fb3b..1fb3e: cmp eax, 0; je 1fc1f
      // EAX at the call is still 0x1fd9b's result; 0x1e5f6 can return its entry EAX (see its port).
      if (F.sub_1e5f6(clr) === 0) break body;    // 1fb44..1fb4c: call 0x1e5f6; cmp eax, 0; je 1fc1f
      // 1fb52..1fb59: mov ebx, [ebp-0x14]; add ebx, 0x14; push ebx; call 0x1e597 (callee pops 4)
      const r = F.sub_1e597((size + 0x14) >>> 0);
      if (r.eax === 0) break body;               // 1fb5e: cmp eax, 0; je 1fc1f
      const farptr = r.ebx >>> 0;                // 1fb67: mov [ebp-4], ebx
      const sel = r.ecx & 0xffff;                // 1fb6a: mov [ebp-6], cx
      const off = r.edx >>> 0;                   // 1fb6e: mov [ebp-0xc], edx
      let eax = (farptr + 0x14) >>> 0;           // 1fb71..1fb74: mov eax, [ebp-4]; add eax, 0x14
      // 1fb77: mov ebx, [ebp+8]
      W32(dsb + mp, eax);                        // 1fb7a: mov [ebx], eax
      // --- far pointer to +4, then mp (16 bytes) -> +4 ---
      // 1fb7c..1fb82: push eax/ecx/edi/esi/es; pushfd; cld
      let es = selBase(sel);                     // 1fb83: mov es, [ebp-6]
      let edi = (off + 0) >>> 0;                 // 1fb87..1fb8a: mov edi, [ebp-0xc]; add edi, 0
      let ax = 1;                                // 1fb8d: mov ax, 1
      if (ax === 0) {                            // 1fb91: cmp ax, 0; jne 1fba2 (always taken)
        W16(es + edi, 0);                        // 1fb97..1fb9c: mov eax, 0; mov es:[edi], ax  (dead)
      } else {
        eax = (farptr + 4) >>> 0;                // 1fba2..1fba5: mov eax, [ebp-4]; add eax, 4
        W16(es + edi + 2, eax & 0xffff);         // 1fba8: mov es:[edi+2], ax
        eax = eax >>> 16;                        // 1fbad: shr eax, 0x10
        W16(es + edi, eax & 0xffff);             // 1fbb0: mov es:[edi], ax
        ax = 1;                                  // 1fbb4: mov ax, 1
        if (ax === 1) {                          // 1fbb8: cmp ax, 1; jne 1fbd7 (never taken)
          let esi = mp >>> 0;                    // 1fbbe: mov esi, [ebp+8]
          es = selBase(sel);                     // 1fbc1: mov es, [ebp-6]
          edi = (off + 4) >>> 0;                 // 1fbc5..1fbc8: mov edi, [ebp-0xc]; add edi, 4
          let cx = 0x10 >>> 1;                   // 1fbcb..1fbd1: xor ecx, ecx; mov cx, 0x10; shr cx, 1
          for (; cx !== 0; cx--) {               // 1fbd4: rep movsw es:[edi], ds:[esi]  (DF = 0)
            W16(es + edi, R16(dsb + esi));
            esi = (esi + 2) >>> 0;
            edi = (edi + 2) >>> 0;
          }
        }
      }
      // 1fbd7..1fbdc: popfd; pop es/esi/edi/ecx/eax
      W32(dsb + mp, song);                       // 1fbdd..1fbe0: mov eax, [ebp-0x18]; mov [ebx], eax
      // --- song ((size >>> 2) + 1 dwords) -> +0x14 ---
      // 1fbe2..1fbe7: push ecx/edi/esi/es; pushfd; cld
      {
        let esi = song;                          // 1fbe8: mov esi, [ebp-0x18]
        es = selBase(sel);                       // 1fbeb: mov es, [ebp-6]
        edi = (off + 0x14) >>> 0;                // 1fbef..1fbf2: mov edi, [ebp-0xc]; add edi, 0x14
        let ecx = ((size >>> 2) + 1) >>> 0;      // 1fbf5..1fbfb: mov ecx, [ebp-0x14]; shr ecx, 2; inc ecx
        for (; ecx !== 0; ecx--) {               // 1fbfc: rep movsd es:[edi], ds:[esi]  (DF = 0)
          W32(es + edi, R32(dsb + esi));
          esi = (esi + 4) >>> 0;
          edi = (edi + 4) >>> 0;
        }
      }
      // 1fbfe..1fc02: popfd; pop es/esi/edi/ecx
      // 1fc03..1fc0a: push dword [ebp-4]; push 0x12; push 4; call 0x1e37f (callee pops 0xc)
      const res = F.sub_1e37f(4, 0x12, farptr);
      // 1fc0f: and eax, 0xffff; 1fc14: call 0x1e3c0
      const result = F.sub_1e3c0(res & 0xffff);  // 1fc19: mov [ebp-0x10], eax
      void result;                               // 1fc1c: mov eax, [ebp-0x10] (see header: not returned)
    }
    F.sub_1e971();                               // 1fc1f: call 0x1e971
  } else {
    F.sub_1e3ba(0x13);                           // 1fc33..1fc38: mov eax, 0x13; call 0x1e3ba; jmp 1fc24
  }
  W8(dsb + 0x31086, (R8(dsb + 0x31086) - 1) & 0xff);   // 1fc24: dec byte [0x31086]
  // 1fc2a..1fc32: pop edi/esi/es/ds/edx/ecx/ebx; leave; ret
});
