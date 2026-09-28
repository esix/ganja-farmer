// 0x1ebe4  void dws_Init(dr, ideal)   [cdecl, 2 stack args: [ebp+8] = dr, [ebp+0xc] = ideal (32-bit flat
//          pointers); EBX/ECX/EDX/DS/ES/ESI/EDI saved/restored; no return value used, see below]
// DiamondWare STK client wrapper for STK function 3 (dws_Init, LIBRARY.md: `dr` = dws_DETECTRESULTS 64 bytes
// in, `ideal` = dws_IDEAL 16 bytes in and out). Same frame as dwt_Init 0x1ff4f / dwt_Kill 0x1ffe0 (DS check
// at 0x30c61, magic dword 0x31088, re-entry byte 0x31086, error setter 0x1e3ba, session open 0x1e8d1 twice
// / close 0x1e971 once). Inside the session it builds an argument block in the DOS buffer:
//   0x1e774(0x60) reserves 0x60 bytes of the DOS buffer and returns EAX = real-mode far pointer seg:off of
//   the block (seg = word 0x30c83, off = word 0x30c87 before the add), CX = buffer selector (word 0x30c85),
//   EDX = off (zero-extended; 0x1e78e xor edx,edx / 0x1e790 mov dx,[0x30c87]).
//   Block layout (sel:off + n), all written through ES = CX:
//     +0x00 word  high 16 bits of (farptr + 0x10)  } real-mode far pointer (off at +2, seg at +0)
//     +0x02 word  low 16 bits of (farptr + 0x10)   }   to the dr copy at +0x10
//     +0x04 word  high 16 bits of (farptr + 0x50)  } far pointer to the ideal copy at +0x50
//     +0x06 word  low 16 bits of (farptr + 0x50)   }
//     +0x10 0x40 bytes copied from dr (DS:dr), 0x20 movsw
//     +0x50 0x10 bytes copied from ideal (DS:ideal), 8 movsw
//   (bytes +0x08..+0x0f are not written)
//   Then 0x1e37f(8, 3, farptr) = STK fn 3 with an 8-byte argument (the two far pointers), result & 0xffff ->
//   0x1e3c0 (error/status helper, returns its EAX input). The 16 bytes at +0x50 are copied back to ideal
//   (DS:ideal), then 0x1e7a6(0x60) releases the 0x60 bytes.
// Return value: 0x1ed83 `mov eax, [ebp-0x10]` loads the 0x1e3c0 result; on the success path the unbalanced second
// 0x1e8d1 keeps the 0x31085 counter above 0, so the following 0x1e971 does not close the session and leaves EAX
// untouched (jne 0x1e9ab) — in effect the 0x1e3c0 result is returned. Error paths leave unrelated values in EAX.
// signatures.json returns=false: the only reachable caller 0x1aab1 discards EAX (`add esp,8; mov eax,2`);
// the other callers 0x234c3/0x235e8 are in the dead STK example 0x233a1 (LIBRARY.md). So nothing is returned.
// UNCERTAIN: LIBRARY.md documents a WORD result 1/0; by the rule above the port returns nothing.
// Callee 0x1e774 returns three registers; the port expects {eax, ecx, edx} (argc_overrides.json "retregs"
// convention, as for 0x1e49e in 1e8d1_sub_1e8d1.js). Only CX of ECX is used (0x1ec6c mov [ebp-6], cx).
// Callee keys: 0x1e8d1 / 0x1e774 / 0x1e37f / 0x1e3c0 / 0x1e7a6 / 0x1e971 / 0x1e3ba are not named in
// re/names.tsv -> sub_<addr>.
import { F, register } from '../runtime/registry.js';
import { R8, R16, R32, W8, W16 } from '../runtime/mem.js';
import { selBase, SEL_CODE, SEL_DATA } from '../platform/dpmi.js';

register(0x1ebe4, 'dws_Init_1ebe4', function dws_Init(dr, ideal) {
  // 1ebe4..1ebf1: push ebp; mov ebp, esp; add esp, -0x10; push ebx/ecx/edx/ds/es/esi/edi; push eax
  // UNCERTAIN: the caller's DS is the extender-chosen data selector; the port uses SEL_DATA from
  // platform/dpmi.js (same approach as dwt_Init / dwt_Kill).
  let ds = SEL_DATA;
  const csBase = selBase(SEL_CODE);
  let skipStore = false;
  if (R16(csBase + 0x30c61) !== 0) {                  // 1ebf2: cmp word cs:[0x30c61], 0; je 1ec14
    if (R16(csBase + 0x30c61) === ds) {               // 1ebfd..1ec08: mov ax, ds; cmp cs:[0x30c61], ax; je 1ec39
      skipStore = true;
    } else {
      ds = R16(csBase + 0x30c61);                     // 1ec0a: mov ds, cs:[0x30c61]
      // 1ec12: je 1ec39 — flags still from the cmp at 1ec00 (not equal), never taken
    }
  }
  // UNCERTAIN: after a real DS reload the callees would run with the reloaded DS; the port cannot pass a
  // segment register to them (only reachable if 0x30c61 holds a selector other than SEL_DATA).
  const dsBase = selBase(ds);
  if (!skipStore) {
    W16(dsBase + 0x30c61, ds);                        // 1ec14: mov word ds:[0x30c61], ds
    // 1ec1b..1ec27: mov eax, cs:[0x31088]; cmp eax, ds:[0x31088]; je 1ec39
    if (R32(csBase + 0x31088) !== R32(dsBase + 0x31088)) {
      // 1ec29: pop eax
      F.sub_1e3ba(0x29a);                             // 1ec2a..1ec2f: mov eax, 0x29a; call 0x1e3ba
      return;                                         // 1ec34: jmp 1ed91 (pop edi..ebx; leave; ret — no dec)
    }
  }
  // 1ec39: pop eax; 1ec3a: xor eax, eax
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) + 1) & 0xff); // 1ec3c: inc byte [0x31086]
  if (R8(dsBase + 0x31086) === 1) {                   // 1ec42: cmp byte [0x31086], 1; jne 1ed9a
    if (F.sub_1e8d1() !== 0) {                        // 1ec4f..1ec57: call 0x1e8d1; cmp eax, 0; je 1ed86
      // 1ec5d: call 0x1e8d1 again (result not read; EAX is overwritten by 0x1e774). As in dwt_Init this
      // leaves the session count 0x31085 one higher than the single 0x1e971 below brings back.
      F.sub_1e8d1();
      const r = F.sub_1e774(0x60);                    // 1ec62..1ec64: push 0x60; call 0x1e774 (callee pops 4)
      const farptr = r.eax >>> 0;                     // 1ec69: mov [ebp-4], eax
      const sel = r.ecx & 0xffff;                     // 1ec6c: mov [ebp-6], cx
      const off = r.edx >>> 0;                        // 1ec70: mov [ebp-0xc], edx
      // 1ec73..1ec79: push eax/ecx/edi/esi/es; pushfd; cld
      let esBase = selBase(sel);                      // 1ec7a: mov es, [ebp-6]
      let edi = (off + 0) >>> 0;                      // 1ec7e..1ec81: mov edi, [ebp-0xc]; add edi, 0
      // 1ec84..1ec8c: mov ax, 1; cmp ax, 0; jne 1ec99 — always taken (the store of 0 at 1ec8e is dead)
      let eax = (farptr + 0x10) >>> 0;                // 1ec99..1ec9c: mov eax, [ebp-4]; add eax, 0x10
      W16(esBase + edi + 2, eax & 0xffff);            // 1ec9f: mov es:[edi+2], ax
      eax = eax >>> 16;                               // 1eca4: shr eax, 0x10
      W16(esBase + edi, eax & 0xffff);                // 1eca7: mov es:[edi], ax
      // 1ecab..1ecb3: mov ax, 1; cmp ax, 1; jne 1ecce — never taken
      {
        let esi = dr >>> 0;                           // 1ecb5: mov esi, [ebp+8]
        esBase = selBase(sel);                        // 1ecb8: mov es, [ebp-6]
        edi = (off + 0x10) >>> 0;                     // 1ecbc..1ecbf: mov edi, [ebp-0xc]; add edi, 0x10
        // 1ecc2..1ecc8: xor ecx, ecx; mov cx, 0x40; shr cx, 1  -> 0x20
        for (let ecx = 0x40 >>> 1; ecx !== 0; ecx--) { // 1eccb: rep movsw es:[edi], ds:[esi] (DF = 0)
          W16(esBase + edi, R16(dsBase + esi));
          esi = (esi + 2) >>> 0;
          edi = (edi + 2) >>> 0;
        }
      }
      // 1ecce..1ecd3: popfd; pop es/esi/edi/ecx/eax
      // 1ecd4..1ecda: push eax/ecx/edi/esi/es; pushfd; cld
      esBase = selBase(sel);                          // 1ecdb: mov es, [ebp-6]
      edi = (off + 4) >>> 0;                          // 1ecdf..1ece2: mov edi, [ebp-0xc]; add edi, 4
      // 1ece5..1eced: mov ax, 1; cmp ax, 0; jne 1ecfa — always taken (the store of 0 at 1ecef is dead)
      eax = (farptr + 0x50) >>> 0;                    // 1ecfa..1ecfd: mov eax, [ebp-4]; add eax, 0x50
      W16(esBase + edi + 2, eax & 0xffff);            // 1ed00: mov es:[edi+2], ax
      eax = eax >>> 16;                               // 1ed05: shr eax, 0x10
      W16(esBase + edi, eax & 0xffff);                // 1ed08: mov es:[edi], ax
      // 1ed0c..1ed14: mov ax, 1; cmp ax, 1; jne 1ed2f — never taken
      {
        let esi = ideal >>> 0;                        // 1ed16: mov esi, [ebp+0xc]
        esBase = selBase(sel);                        // 1ed19: mov es, [ebp-6]
        edi = (off + 0x50) >>> 0;                     // 1ed1d..1ed20: mov edi, [ebp-0xc]; add edi, 0x50
        // 1ed23..1ed29: xor ecx, ecx; mov cx, 0x10; shr cx, 1  -> 8
        for (let ecx = 0x10 >>> 1; ecx !== 0; ecx--) { // 1ed2c: rep movsw es:[edi], ds:[esi]
          W16(esBase + edi, R16(dsBase + esi));
          esi = (esi + 2) >>> 0;
          edi = (edi + 2) >>> 0;
        }
      }
      // 1ed2f..1ed34: popfd; pop es/esi/edi/ecx/eax
      // 1ed35..1ed3c: push [ebp-4]; push 3; push 8; call 0x1e37f (callee pops 0xc)
      const res = F.sub_1e3c0(F.sub_1e37f(8, 3, farptr) & 0xffff); // 1ed41: and eax, 0xffff; 1ed46: call 0x1e3c0
      // 1ed4b: mov [ebp-0x10], eax
      // 1ed4e..1ed55: push eax/ecx/edi/esi/es/ds; pushfd; cld
      {
        let edi2 = ideal >>> 0;                       // 1ed56: mov edi, [ebp+0xc]
        const dstBase = dsBase;                       // 1ed59..1ed5c: mov ax, ds; mov es, ax
        let esi = (off + 0x50) >>> 0;                 // 1ed5f..1ed62: mov esi, [ebp-0xc]; add esi, 0x50
        // 1ed65..1ed6b: xor ecx, ecx; mov cx, 0x10; shr cx, 1  -> 8
        const srcBase = selBase(sel);                 // 1ed6e: mov ds, [ebp-6]
        for (let ecx = 0x10 >>> 1; ecx !== 0; ecx--) { // 1ed72: rep movsw es:[edi], ds:[esi]
          W16(dstBase + edi2, R16(srcBase + esi));
          esi = (esi + 2) >>> 0;
          edi2 = (edi2 + 2) >>> 0;
        }
      }
      // 1ed75..1ed7b: popfd; pop ds/es/esi/edi/ecx/eax
      F.sub_1e7a6(0x60);                              // 1ed7c..1ed7e: push 0x60; call 0x1e7a6 (callee pops 4)
      void res;                                       // 1ed83: mov eax, [ebp-0x10] (see header: not returned)
    }
    F.sub_1e971();                                    // 1ed86: call 0x1e971
  } else {
    F.sub_1e3ba(0x13);                                // 1ed9a..1ed9f: mov eax, 0x13; call 0x1e3ba; jmp 1ed8b
  }
  W8(dsBase + 0x31086, (R8(dsBase + 0x31086) - 1) & 0xff); // 1ed8b: dec byte [0x31086]
  // 1ed91..1ed99: pop edi/esi/es/ds/edx/ecx/ebx; leave; ret
});
