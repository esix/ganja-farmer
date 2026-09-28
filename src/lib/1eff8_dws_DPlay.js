// 0x1eff8  void dws_DPlay(dp)   [cdecl, 1 stack arg: [ebp+8] = dp (32-bit near pointer to a dws_DPLAY,
//          DS-relative); EBX/ECX/EDX/DS/ES/ESI/EDI saved/restored; no return value used, see below]
// DiamondWare STK client wrapper for STK function 8 (dws_DPlay, LIBRARY.md). Same frame as dwt_Init 0x1ff4f /
// dwt_Kill 0x1ffe0 (DS check at 0x30c61, magic dword 0x31088, re-entry byte 0x31086, error setter 0x1e3ba,
// session open 0x1e8d1 once / close 0x1e971 once). Inside the session:
//   snd = dword [dp] (dws_DPLAY +0 `snd`, LIBRARY.md).
//   0x1e43b(snd) checks the DWD signature ("DiamondWare Digi", 0x1e43e..0x1e475) and on success returns
//     EAX = 1 and EBX = dword [snd+0x26] + dword [snd+0x2e] (0x1e477..0x1e487) = `size`, the byte count copied
//     below; on failure EAX = 0 (EBX leftover, not read here). The port expects {eax, ebx}.
//   0x1e5f6() (no args; preserves EBX/ECX/EDX) must return non-zero.
//   0x1e49e(size + 0x24) allocates a DOS buffer (DPMI) and returns EAX = 1/0, EBX = real-mode segment << 16
//     (farptr, offset 0), CX = its selector, EDX = offset in it (argc_overrides.json "retregs").
//   Block layout in the new buffer (sel:off + n):
//     +0x00 WORD  high 16 bits of farptr+4   } real-mode far pointer to the struct copy at +4
//     +0x02 WORD  low 16 bits of farptr+4    }
//     +0x04 0x20 bytes: copy of *dp (16 movsw), whose dword +0 was first replaced by farptr+0x24
//     +0x24 copy of the sound: (size >> 2) + 1 dwords from snd (rep movsd)
//   then 0x1e37f(n = 4, fn = 8, farptr) (STK fn 8, 4-byte argument = the far pointer at +0); result & 0xffff
//   -> 0x1e3c0 (returns its EAX input) = status. The 0x20 bytes at +4 are copied back to *dp (this brings back
//   +0xA soundnum, LIBRARY.md), and dword [dp] is restored to snd.
//   status != 0 -> 0x1e705(off, sel, farptr, snd, soundnum, size + 0x24) records the copy in the DWD-copy tables
//   status != 1 -> 0x1e52c(DX = sel, size + 0x24) frees the DOS buffer again.
//   (The buffer is kept only when status == 1; for status 0 it is freed and not recorded; for any other
//   non-zero status it is recorded AND freed — see UNCERTAIN at 1f1c4.)
// Return value: 0x1f1d8 `mov eax, [ebp-0x10]` loads the status, and 0x1e971 preserves EAX
// (argc_overrides.json), so EAX at RET is the status on the full path, 0 on the failed-callee paths and the
// error code (0x29a / 0x13, left by 0x1e3ba) on the error paths. The status load at 0x1f1d8 is deliberate, so
// PORTING.md's literal rule would return it; the port returns nothing because no caller reads EAX:
// signatures.json returns=false — all 106 binary call sites are followed by `add esp, 4` and none reads EAX —
// and no JS caller uses a result. Same decision as the verified siblings dws_Init (0x1ebe4) and
// dws_DGetRateFromDWD (0x1f5b3); not observable (re/difftest/cases/1eff8.json returnsValue=false).
// UNCERTAIN: LIBRARY.md documents a WORD result 1/0; by the rule above the port returns nothing.
// Callee keys: 0x1e8d1 / 0x1e43b / 0x1e5f6 / 0x1e49e / 0x1e37f / 0x1e3c0 / 0x1e705 / 0x1e52c / 0x1e971 /
// 0x1e3ba are not named in re/names.tsv -> sub_<addr>.
import { F, register } from '../runtime/registry.js';
import { R8, R16, R32, W8, W16, W32 } from '../runtime/mem.js';
import { selBase, SEL_CODE, SEL_DATA } from '../platform/dpmi.js';

register(0x1eff8, 'dws_DPlay_1eff8', function dws_DPlay(dp) {
  // 1eff8..1f005: push ebp; mov ebp, esp; add esp, -0x1c; push ebx/ecx/edx/ds/es/esi/edi; push eax
  // UNCERTAIN: the caller's DS is the extender-chosen data selector; the port uses SEL_DATA from
  // platform/dpmi.js (same approach as dwt_Init / dwt_Kill).
  let ds = SEL_DATA;
  const csBase = selBase(SEL_CODE);
  let skipStore = false;
  if (R16(csBase + 0x30c61) !== 0) {                  // 1f006: cmp word cs:[0x30c61], 0; je 1f028
    if (R16(csBase + 0x30c61) === ds) {               // 1f011..1f01c: mov ax, ds; cmp cs:[0x30c61], ax; je 1f04d
      skipStore = true;
    } else {
      ds = R16(csBase + 0x30c61);                     // 1f01e: mov ds, cs:[0x30c61]
      // 1f026: je 1f04d — flags still from the cmp at 1f014 (not equal), never taken
    }
  }
  // UNCERTAIN: after a real DS reload the callees would run with the reloaded DS; the port cannot pass a
  // segment register to them (only reachable if 0x30c61 holds a selector other than SEL_DATA).
  const dsBase = selBase(ds);
  if (!skipStore) {
    W16(dsBase + 0x30c61, ds);                        // 1f028: mov word ds:[0x30c61], ds
    // 1f02f..1f03b: mov eax, cs:[0x31088]; cmp eax, ds:[0x31088]; je 1f04d
    if (R32(csBase + 0x31088) !== R32(dsBase + 0x31088)) {
      // 1f03d: pop eax
      F.sub_1e3ba(0x29a);                             // 1f03e..1f043: mov eax, 0x29a; call 0x1e3ba
      return;                                         // 1f048: jmp 1f1e6 (pop edi..ebx; leave; ret — no dec)
    }
  }
  // 1f04d: pop eax; 1f04e: xor eax, eax
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) + 1) & 0xff); // 1f050: inc byte [0x31086]
  if (R8(dsBase + 0x31086) === 1) {                   // 1f056: cmp byte [0x31086], 1; jne 1f1ef
    body: {
      if (F.sub_1e8d1() === 0) break body;            // 1f063..1f06b: call 0x1e8d1; cmp eax, 0; je 1f1db
      // 1f071: mov ebx, ds:[ebp+8]
      const snd = R32(dsBase + dp) >>> 0;             // 1f075..1f077: mov eax, [ebx]; mov [ebp-0x14], eax
      const r1 = F.sub_1e43b(snd);                    // 1f07a..1f07b: push eax; call 0x1e43b (callee pops 4)
      if (r1.eax === 0) break body;                   // 1f080: cmp eax, 0; je 1f1db
      const size = r1.ebx >>> 0;                      // 1f089: mov [ebp-0x18], ebx
      // EAX at the call is still 0x1e43b's result (1); 0x1e5f6 can return its entry EAX (see its port).
      if (F.sub_1e5f6(r1.eax) === 0) break body;      // 1f08c..1f094: call 0x1e5f6; cmp eax, 0; je 1f1db
      const allocSize = (0x24 + size) >>> 0;          // 1f09a..1f0a2: mov eax, 0x24; add eax, [ebp-0x18]; mov [ebp-0x1c], eax
      const r2 = F.sub_1e49e(allocSize);              // 1f0a5..1f0a6: push eax; call 0x1e49e (callee pops 4)
      if (r2.eax === 0) break body;                   // 1f0ab: cmp eax, 0; je 1f1db
      const farptr = r2.ebx >>> 0;                    // 1f0b4: mov [ebp-4], ebx
      const sel = r2.ecx & 0xffff;                    // 1f0b7: mov [ebp-6], cx
      const off = r2.edx >>> 0;                       // 1f0bb: mov [ebp-0xc], edx
      let eax = (farptr + 0x24) >>> 0;                // 1f0be..1f0c1: mov eax, [ebp-4]; add eax, 0x24
      W32(dsBase + dp, eax);                          // 1f0c4..1f0c7: mov ebx, [ebp+8]; mov [ebx], eax
      // --- block: far pointer to +4 at +0, then *dp -> +4 ---
      // 1f0c9..1f0cf: push eax/ecx/edi/esi/es; pushfd; cld
      let esBase = selBase(sel);                      // 1f0d0: mov es, [ebp-6]
      let edi = (off + 0) >>> 0;                      // 1f0d4..1f0d7: mov edi, [ebp-0xc]; add edi, 0
      let ax = 1;                                     // 1f0da: mov ax, 1
      if (ax === 0) {                                 // 1f0de: cmp ax, 0; jne 1f0ef (always taken)
        W16(esBase + edi, 0);                         // 1f0e4..1f0e9: mov eax, 0; mov es:[edi], ax  (dead)
        // 1f0ed: jmp 1f124
      } else {
        let e = (farptr + 4) >>> 0;                   // 1f0ef..1f0f2: mov eax, [ebp-4]; add eax, 4
        W16(esBase + edi + 2, e & 0xffff);            // 1f0f5: mov es:[edi+2], ax
        e = e >>> 16;                                 // 1f0fa: shr eax, 0x10
        W16(esBase + edi, e & 0xffff);                // 1f0fd: mov es:[edi], ax
        ax = 1;                                       // 1f101: mov ax, 1
        if (ax === 1) {                               // 1f105: cmp ax, 1; jne 1f124 (never taken)
          let esi = dp >>> 0;                         // 1f10b: mov esi, [ebp+8]
          esBase = selBase(sel);                      // 1f10e: mov es, [ebp-6]
          edi = (off + 4) >>> 0;                      // 1f112..1f115: mov edi, [ebp-0xc]; add edi, 4
          // 1f118..1f11e: xor ecx, ecx; mov cx, 0x20; shr cx, 1  -> 0x10
          for (let ecx = 0x20 >>> 1; ecx !== 0; ecx--) { // 1f121: rep movsw es:[edi], ds:[esi] (DF = 0)
            W16(esBase + edi, R16(dsBase + esi));
            esi = (esi + 2) >>> 0;
            edi = (edi + 2) >>> 0;
          }
        }
      }
      // 1f124..1f129: popfd; pop es/esi/edi/ecx/eax
      // --- sound data snd -> +0x24 ---
      // 1f12a..1f12f: push ecx/edi/esi/es; pushfd; cld
      {
        let esi = snd;                                // 1f130: mov esi, [ebp-0x14]
        const dstBase = selBase(sel);                 // 1f133: mov es, [ebp-6]
        let edi2 = (off + 0x24) >>> 0;                // 1f137..1f13a: mov edi, [ebp-0xc]; add edi, 0x24
        let ecx = size >>> 2;                         // 1f13d..1f140: mov ecx, [ebp-0x18]; shr ecx, 2
        ecx = (ecx + 1) >>> 0;                        // 1f143: inc ecx
        // ORIGINAL BUG: (size >> 2) + 1 dwords = 4 * floor(size / 4) + 4 bytes, i.e. 1..4 bytes more than
        // `size`: it reads 1..4 bytes past the sound data, and writes past the size + 0x24 bytes requested from
        // 0x1e49e — but never past the actual DOS block, which 0x1e49e rounds up to ((N>>4)+1) paragraphs
        // (1e4bb..1e4c1; 4*floor(N/4)+4 <= 16*floor(N/16)+16), so only the over-READ is observable.
        for (; ecx !== 0; ecx = (ecx - 1) >>> 0) {    // 1f144: rep movsd es:[edi], ds:[esi] (DF = 0)
          W32(dstBase + edi2, R32(dsBase + esi));
          esi = (esi + 4) >>> 0;
          edi2 = (edi2 + 4) >>> 0;
        }
      }
      // 1f146..1f14a: popfd; pop es/esi/edi/ecx
      // 1f14b..1f152: push dword [ebp-4]; push 8; push 4; call 0x1e37f (callee pops 0xc)
      const res = F.sub_1e37f(4, 8, farptr);
      // 1f157: and eax, 0xffff; 1f15c: call 0x1e3c0 (EAX in, EAX out)
      const status = F.sub_1e3c0(res & 0xffff);       // 1f161: mov [ebp-0x10], eax
      // --- +4 (0x20 bytes) -> *dp ---
      // 1f164..1f16b: push eax/ecx/edi/esi/es/ds; pushfd; cld
      {
        let edi2 = dp >>> 0;                          // 1f16c: mov edi, [ebp+8]
        const dstBase = dsBase;                       // 1f16f..1f172: mov ax, ds; mov es, ax
        let esi = (off + 4) >>> 0;                    // 1f175..1f178: mov esi, [ebp-0xc]; add esi, 4
        // 1f17b..1f181: xor ecx, ecx; mov cx, 0x20; shr cx, 1  -> 0x10
        const srcBase = selBase(sel);                 // 1f184: mov ds, [ebp-6]
        for (let ecx = 0x20 >>> 1; ecx !== 0; ecx--) { // 1f188: rep movsw es:[edi], ds:[esi]
          W16(dstBase + edi2, R16(srcBase + esi));
          esi = (esi + 2) >>> 0;
          edi2 = (edi2 + 2) >>> 0;
        }
      }
      // 1f18b..1f191: popfd; pop ds/es/esi/edi/ecx/eax
      W32(dsBase + dp, snd);                          // 1f192..1f198: mov ebx, [ebp+8]; mov eax, [ebp-0x14]; mov [ebx], eax
      if (status !== 0) {                             // 1f19a..1f1a0: mov eax, [ebp-0x10]; cmp eax, 0; je 1f1c4
        // 1f1a2..1f1bf: push [ebp-0x1c]; push zx word [dp+0xa]; push [ebp-0x14]; push [ebp-4];
        //               push zx word [ebp-6]; push [ebp-0xc]; call 0x1e705 (callee pops 0x18)
        F.sub_1e705(off, sel, farptr, snd, R16(dsBase + dp + 0xa), allocSize);
      }
      // UNCERTAIN: a status other than 0 and 1 (0x1e3c0 passes the driver's 16-bit result through) makes the
      // buffer both recorded (above) and freed (below); whether the driver can return such a value is unknown.
      if (status !== 1) {                             // 1f1c4..1f1ca: mov eax, [ebp-0x10]; cmp eax, 1; je 1f1d8
        // 1f1cc..1f1d3: push [ebp-0x1c]; mov dx, [ebp-6]; call 0x1e52c (callee pops 4)
        F.sub_1e52c(sel, allocSize);
      }
      eax = status;                                   // 1f1d8: mov eax, [ebp-0x10] (see header: not returned)
      void eax;
    }
    F.sub_1e971();                                    // 1f1db: call 0x1e971
  } else {
    F.sub_1e3ba(0x13);                                // 1f1ef..1f1f4: mov eax, 0x13; call 0x1e3ba; jmp 1f1e0
  }
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) - 1) & 0xff); // 1f1e0: dec byte [0x31086]
  // 1f1e6..1f1ee: pop edi/esi/es/ds/edx/ecx/ebx; leave; ret
});
