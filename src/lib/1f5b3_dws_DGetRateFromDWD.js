// 0x1f5b3  void dws_DGetRateFromDWD(snd, rate)   [cdecl, 2 stack args: [ebp+8] = snd, [ebp+0xc] = rate (32-bit
//          near pointers, DS-relative); EBX/ECX/EDX/DS/ES/ESI/EDI saved/restored; no return value used, see below]
// DiamondWare STK client wrapper for STK function 0xc (dws_DGetRateFromDWD, LIBRARY.md: `snd` = DWD data, whose
// first 64 bytes are sent; `rate` = WORD result). Same frame as dwt_Init 0x1ff4f / dwt_Kill 0x1ffe0 (DS check at
// 0x30c61, magic dword 0x31088, re-entry byte 0x31086, error setter 0x1e3ba, session open 0x1e8d1 once / close
// 0x1e971 once). Inside the session it builds an argument block in the DOS buffer:
//   0x1e774(0x4a) reserves 0x4a bytes of the DOS buffer and returns EAX = real-mode far pointer seg:off,
//   CX = buffer selector, EDX = offset (see 1ea27_dws_DetectHardWare.js; port expects {eax, ecx, edx}).
//   Block layout (sel:off + n), all written through ES = CX:
//     +0x00 word  high 16 bits of (farptr + 0xa)  } real-mode far pointer (off at +2, seg at +0)
//     +0x02 word  low 16 bits of (farptr + 0xa)   }   to the snd copy at +0xa        (1f663..1f671)
//     +0x04 word  high 16 bits of (farptr + 8)    } far pointer to the result word at +8
//     +0x06 word  low 16 bits of (farptr + 8)     }                                  (1f6c4..1f6d2)
//     +0x08 word  result area (not copied in: 1f6d6 `mov ax, 0` / `cmp ax, 1` -> jne taken)
//     +0x0a 0x40 bytes copied from snd (DS:snd), 0x20 movsw                          (1f67f..1f695)
//   Then 0x1e37f(8, 0xc, farptr) = STK fn 0xc with an 8-byte argument (the two far pointers), result & 0xffff ->
//   0x1e3c0 (EAX in, EAX out) -> [ebp-0x10]. One word at +8 is copied back to DS:rate (1f720..1f73c), then
//   0x1e7a6(0x4a) releases the 0x4a bytes.
// Return value: 0x1f74d `mov eax, [ebp-0x10]` loads the 0x1e3c0 result before 0x1e971; error paths leave
// 0x1e3ba's EAX. None of the 42 call sites (0x11549, 0x1c086..0x1cb8f, 0x23505) reads EAX: each is followed by
// `add esp, 8` and then `xor eax, eax` / `mov edx, ...; mov eax, ...` / `mov eax, 0xfe`. signatures.json
// returns=false. So nothing is returned.
// UNCERTAIN: LIBRARY.md documents a WORD result 1/0; by the rule above the port returns nothing.
// The copy sections test constants (`mov ax, 0|1; cmp ax, 0|1`); the branches that cannot be taken are kept as
// dead code, as in 1ea27_dws_DetectHardWare.js.
// Callee keys: 0x1e8d1 / 0x1e774 / 0x1e37f / 0x1e3c0 / 0x1e7a6 / 0x1e971 / 0x1e3ba are not named in
// re/names.tsv -> sub_<addr>.
import { F, register } from '../runtime/registry.js';
import { R8, R16, R32, W8, W16 } from '../runtime/mem.js';
import { SEL_CODE, SEL_DATA, selBase } from '../platform/dpmi.js';

register(0x1f5b3, 'dws_DGetRateFromDWD_1f5b3', function dws_DGetRateFromDWD(snd, rate) {
  // 1f5b3..1f5c0: push ebp; mov ebp, esp; add esp, -0x10; push ebx/ecx/edx/ds/es/esi/edi; push eax
  // UNCERTAIN: DS at entry is the extender-chosen data selector; the port uses SEL_DATA (platform/dpmi.js),
  // as dwt_Init / dwt_Kill do.
  let ds = SEL_DATA;
  check: {
    const csBase = selBase(SEL_CODE);              // cs: overrides below (base 0 under PMODE/W flat model)
    if (R16(csBase + 0x30c61) !== 0) {                    // 1f5c1: cmp word cs:[0x30c61], 0; je 1f5e3
      if (R16(csBase + 0x30c61) === ds) break check;      // 1f5cc..1f5d7: mov ax, ds; cmp cs:[0x30c61], ax; je 1f608
      ds = R16(csBase + 0x30c61);                         // 1f5d9: mov ds, cs:[0x30c61]
      // 1f5e1: je 1f608 — flags still from the cmp at 1f5cf (not equal), never taken
    }
    W16(selBase(ds) + 0x30c61, ds);              // 1f5e3: mov word [0x30c61], ds   (DS-relative)
    // 1f5ea..1f5f6: mov eax, cs:[0x31088]; cmp eax, ds:[0x31088]; je 1f608
    if (R32(csBase + 0x31088) === R32(selBase(ds) + 0x31088)) break check;
    // 1f5f8: pop eax
    F.sub_1e3ba(0x29a);                          // 1f5f9..1f5fe: mov eax, 0x29a; call 0x1e3ba
    return;                                      // 1f603: jmp 1f75b (pop edi..ebx; leave; ret — no dec)
  }
  // 1f608: pop eax; 1f609: xor eax, eax
  // UNCERTAIN: when DS was reloaded from 0x30c61 the callees below also run with that DS; the port cannot
  // pass a segment register to them (only reachable if 0x30c61 holds a selector other than SEL_DATA).
  const dsb = selBase(ds);
  W8(dsb + 0x31086, (R8(dsb + 0x31086) + 1) & 0xff);   // 1f60b: inc byte [0x31086]
  if (R8(dsb + 0x31086) === 1) {                 // 1f611: cmp byte [0x31086], 1; jne 1f764
    if (F.sub_1e8d1() !== 0) {                   // 1f61e..1f626: call 0x1e8d1; cmp eax, 0; je 1f750
      const r = F.sub_1e774(0x4a);               // 1f62c..1f62e: push 0x4a; call 0x1e774 (callee pops 4)
      const farptr = r.eax >>> 0;                // 1f633: mov [ebp-4], eax
      const sel = r.ecx & 0xffff;                // 1f636: mov [ebp-6], cx
      const off = r.edx >>> 0;                   // 1f63a: mov [ebp-0xc], edx
      // --- block 1: far pointer to +0xa at +0, then snd -> +0xa ---
      // 1f63d..1f643: push eax/ecx/edi/esi/es; pushfd; cld
      let es = selBase(sel);                     // 1f644: mov es, [ebp-6]
      let edi = (off + 0) >>> 0;                 // 1f648..1f64b: mov edi, [ebp-0xc]; add edi, 0
      let ax = 1;                                // 1f64e: mov ax, 1
      if (ax === 0) {                            // 1f652: cmp ax, 0; jne 1f663 (always taken)
        W16(es + edi, 0);                        // 1f658..1f65d: mov eax, 0; mov es:[edi], ax  (dead)
      } else {
        let eax = (farptr + 0xa) >>> 0;          // 1f663..1f666: mov eax, [ebp-4]; add eax, 0xa
        W16(es + edi + 2, eax & 0xffff);         // 1f669: mov es:[edi+2], ax
        eax = eax >>> 16;                        // 1f66e: shr eax, 0x10
        W16(es + edi, eax & 0xffff);             // 1f671: mov es:[edi], ax
        ax = 1;                                  // 1f675: mov ax, 1
        if (ax === 1) {                          // 1f679: cmp ax, 1; jne 1f698 (never taken)
          let esi = snd >>> 0;                   // 1f67f: mov esi, [ebp+8]
          es = selBase(sel);                     // 1f682: mov es, [ebp-6]
          edi = (off + 0xa) >>> 0;               // 1f686..1f689: mov edi, [ebp-0xc]; add edi, 0xa
          let cx = 0x40 >>> 1;                   // 1f68c..1f692: xor ecx, ecx; mov cx, 0x40; shr cx, 1
          for (; cx !== 0; cx--) {               // 1f695: rep movsw es:[edi], ds:[esi]  (DF = 0)
            W16(es + edi, R16(dsb + esi));
            esi = (esi + 2) >>> 0;
            edi = (edi + 2) >>> 0;
          }
        }
      }
      // 1f698..1f69d: popfd; pop es/esi/edi/ecx/eax
      // --- block 2: far pointer to +8 (result area) at +4 ---
      // 1f69e..1f6a4: push eax/ecx/edi/esi/es; pushfd; cld
      es = selBase(sel);                         // 1f6a5: mov es, [ebp-6]
      edi = (off + 4) >>> 0;                     // 1f6a9..1f6ac: mov edi, [ebp-0xc]; add edi, 4
      ax = 1;                                    // 1f6af: mov ax, 1
      if (ax === 0) {                            // 1f6b3: cmp ax, 0; jne 1f6c4 (always taken)
        W16(es + edi, 0);                        // 1f6b9..1f6be: mov eax, 0; mov es:[edi], ax  (dead)
      } else {
        let eax = (farptr + 8) >>> 0;            // 1f6c4..1f6c7: mov eax, [ebp-4]; add eax, 8
        W16(es + edi + 2, eax & 0xffff);         // 1f6ca: mov es:[edi+2], ax
        eax = eax >>> 16;                        // 1f6cf: shr eax, 0x10
        W16(es + edi, eax & 0xffff);             // 1f6d2: mov es:[edi], ax
        ax = 0;                                  // 1f6d6: mov ax, 0
        if (ax === 1) {                          // 1f6da: cmp ax, 1; jne 1f6f9 (always taken: rate not copied in)
          let esi = rate >>> 0;                  // 1f6e0: mov esi, [ebp+0xc]  (dead)
          es = selBase(sel);                     // 1f6e3: mov es, [ebp-6]
          edi = (off + 8) >>> 0;                 // 1f6e7..1f6ea: mov edi, [ebp-0xc]; add edi, 8
          let cx = 2 >>> 1;                      // 1f6ed..1f6f3: xor ecx, ecx; mov cx, 2; shr cx, 1
          for (; cx !== 0; cx--) {               // 1f6f6: rep movsw es:[edi], ds:[esi]
            W16(es + edi, R16(dsb + esi));
            esi = (esi + 2) >>> 0;
            edi = (edi + 2) >>> 0;
          }
        }
      }
      // 1f6f9..1f6fe: popfd; pop es/esi/edi/ecx/eax
      // 1f6ff..1f706: push dword [ebp-4]; push 0xc; push 8; call 0x1e37f (callee pops 0xc)
      const res = F.sub_1e37f(8, 0xc, farptr);
      // 1f70b: and eax, 0xffff; 1f710: call 0x1e3c0 (EAX in, EAX out)
      const result = F.sub_1e3c0(res & 0xffff);  // 1f715: mov [ebp-0x10], eax
      // --- result area (+8, 1 word) -> rate ---
      // 1f718..1f71f: push eax/ecx/edi/esi/es/ds; pushfd; cld
      {
        let edi2 = rate >>> 0;                   // 1f720: mov edi, [ebp+0xc]
        const es2 = dsb;                         // 1f723..1f726: mov ax, ds; mov es, ax
        let esi = (off + 8) >>> 0;               // 1f729..1f72c: mov esi, [ebp-0xc]; add esi, 8
        let cx = 2 >>> 1;                        // 1f72f..1f735: xor ecx, ecx; mov cx, 2; shr cx, 1
        const ds2 = selBase(sel);                // 1f738: mov ds, [ebp-6]
        for (; cx !== 0; cx--) {                 // 1f73c: rep movsw es:[edi], ds:[esi]
          W16(es2 + edi2, R16(ds2 + esi));
          esi = (esi + 2) >>> 0;
          edi2 = (edi2 + 2) >>> 0;
        }
      }
      // 1f73f..1f745: popfd; pop ds/es/esi/edi/ecx/eax
      F.sub_1e7a6(0x4a);                         // 1f746..1f748: push 0x4a; call 0x1e7a6 (callee pops 4)
      void result;                               // 1f74d: mov eax, [ebp-0x10] (see header: not returned)
    }
    F.sub_1e971();                               // 1f750: call 0x1e971
  } else {
    F.sub_1e3ba(0x13);                           // 1f764..1f769: mov eax, 0x13; call 0x1e3ba; jmp 1f755
  }
  W8(dsb + 0x31086, (R8(dsb + 0x31086) - 1) & 0xff);   // 1f755: dec byte [0x31086]
  // 1f75b..1f763: pop edi/esi/es/ds/edx/ecx/ebx; leave; ret
});
