// 0x1ea27  void dws_DetectHardWare(dov, dr)   [cdecl, 2 stack args: [ebp+8] = dov, [ebp+0xc] = dr (32-bit
//          near pointers, DS-relative); EBX/ECX/EDX/DS/ES/ESI/EDI saved/restored; no return value]
// DiamondWare STK client wrapper for STK function 2 (dws_DetectHardWare, LIBRARY.md). Same frame as
// 1ff4f_dwt_Init.js / 1ffe0_dwt_Kill.js (DS check at 0x30c61, magic 0x31088, re-entry byte 0x31086, session
// open 0x1e8d1 / close 0x1e971). Difference: an argument block is built in the DOS buffer and the driver is
// called through 0x1e37f(8, 2, farptr):
//   0x1e774(0x58) reserves 0x58 bytes of the DOS buffer and returns three registers (0x1e774..0x1e7a3):
//     EAX = real-mode far pointer seg:off (word [0x30c83] << 16 | word [0x30c87]),
//     CX  = selector of the buffer (word [0x30c85]), EDX = offset in that selector (word [0x30c87]);
//     it then adds 0x58 to word [0x30c87]. The port expects {eax, ecx, edx} (argc_overrides "retregs"
//     convention, as 0x1e49e in 1e8d1_sub_1e8d1.js).
//   Block layout (offsets from the start of the reserved area, written via selector:offset):
//     +0  WORD  high word of farptr+8     (1ead7..1eae5; stored at es:[edi], edi = off+0)
//     +2  WORD  low  word of farptr+8     (es:[edi+2])
//     +4  WORD  high word of farptr+0x18  (1eb38..1eb46; edi = off+4)
//     +6  WORD  low  word of farptr+0x18  (es:[edi+2])
//     +8  16 bytes copied from dov        (1eaf3..1eb09: rep movsw, CX = 0x10 >> 1 = 8 words)
//     +0x18 64 bytes: results, copied to dr after the call (1eb94..1ebb0: rep movsw, CX = 0x40 >> 1 = 32 words)
//   then 0x1e37f(n = 8, fn = 2, farptr) (cdecl-style pushes right to left, callee pops 0xc), result & 0xFFFF
//   -> 0x1e3c0 (EAX), then 0x1e7a6(0x58) releases the 0x58 bytes (sub word [0x30c87], 0x58).
// Return: EAX at `ret` is a leftover (1ebc1 `mov eax, [ebp-0xc]` then 0x1e971, which does not preserve EAX in
// all paths; error paths leave 0x1e3ba's EAX). The three callers (0x1aa70, 0x23492, 0x235ba) are each
// followed by `add esp, 8` and never read EAX; signatures.json returns=false. So nothing is returned.
// Callee keys: 0x1e774 / 0x1e37f / 0x1e3c0 / 0x1e7a6 / 0x1e8d1 / 0x1e971 / 0x1e3ba are not named in
// re/names.tsv -> sub_<addr>.
import { F, register } from '../runtime/registry.js';
import { R8, R16, R32, W8, W16 } from '../runtime/mem.js';
import { SEL_CODE, SEL_DATA, selBase } from '../platform/dpmi.js';

register(0x1ea27, 'dws_DetectHardWare_1ea27', function dws_DetectHardWare(dov, dr) {
  // 1ea27..1ea34: push ebp; mov ebp, esp; add esp, -0x10; push ebx/ecx/edx/ds/es/esi/edi; push eax
  // UNCERTAIN: DS at entry is the extender-chosen data selector; the port uses SEL_DATA (platform/dpmi.js),
  // as dwt_Init / dwt_Kill do.
  let ds = SEL_DATA;
  check: {
    const csBase = selBase(SEL_CODE);              // cs: overrides below (base 0 under PMODE/W flat model)
    if (R16(csBase + 0x30c61) !== 0) {                    // 1ea35: cmp word cs:[0x30c61], 0; je 1ea57
      if (R16(csBase + 0x30c61) === ds) break check;      // 1ea40..1ea4b: mov ax, ds; cmp cs:[0x30c61], ax; je 1ea7c
      ds = R16(csBase + 0x30c61);                         // 1ea4d: mov ds, cs:[0x30c61]
      // 1ea55: je 1ea7c — flags still from the cmp at 1ea43 (not equal), never taken
    }
    W16(selBase(ds) + 0x30c61, ds);              // 1ea57: mov word [0x30c61], ds   (DS-relative)
    // 1ea5e..1ea6a: mov eax, cs:[0x31088]; cmp eax, ds:[0x31088]; je 1ea7c
    if (R32(csBase + 0x31088) === R32(selBase(ds) + 0x31088)) break check;
    // 1ea6c: pop eax
    F.sub_1e3ba(0x29a);                          // 1ea6d..1ea72: mov eax, 0x29a; call 0x1e3ba
    return;                                      // 1ea77: jmp 1ebcf (pop edi..ebx; leave; ret)
  }
  // 1ea7c: pop eax; 1ea7d: xor eax, eax
  // UNCERTAIN: when DS was reloaded from 0x30c61 the callees below also run with that DS; the port cannot
  // pass a segment register to them (only reachable if 0x30c61 holds a selector other than SEL_DATA).
  const dsb = selBase(ds);
  W8(dsb + 0x31086, (R8(dsb + 0x31086) + 1) & 0xff);   // 1ea7f: inc byte [0x31086]
  if (R8(dsb + 0x31086) === 1) {                 // 1ea85: cmp byte [0x31086], 1; jne 1ebd8
    if (F.sub_1e8d1() !== 0) {                   // 1ea92..1ea9a: call 0x1e8d1; cmp eax, 0; je 1ebc4
      const r = F.sub_1e774(0x58);               // 1eaa0..1eaa2: push 0x58; call 0x1e774 (callee pops 4)
      const farptr = r.eax >>> 0;                // 1eaa7: mov [ebp-4], eax
      const sel = r.ecx & 0xffff;                // 1eaaa: mov [ebp-0xe], cx
      const off = r.edx >>> 0;                   // 1eaae: mov [ebp-8], edx
      // --- block 1: far pointer to +8, then dov -> +8 ---
      // 1eab1..1eab7: push eax/ecx/edi/esi/es; pushfd; cld
      let es = selBase(sel);                     // 1eab8: mov es, [ebp-0xe]
      let edi = (off + 0) >>> 0;                 // 1eabc..1eabf: mov edi, [ebp-8]; add edi, 0
      let ax = 1;                                // 1eac2: mov ax, 1
      if (ax === 0) {                            // 1eac6: cmp ax, 0; jne 1ead7 (always taken)
        W16(es + edi, 0);                        // 1eacc..1ead1: mov eax, 0; mov es:[edi], ax  (dead)
      } else {
        let eax = (farptr + 8) >>> 0;            // 1ead7..1eada: mov eax, [ebp-4]; add eax, 8
        W16(es + edi + 2, eax & 0xffff);         // 1eadd: mov es:[edi+2], ax
        eax = eax >>> 16;                        // 1eae2: shr eax, 0x10
        W16(es + edi, eax & 0xffff);             // 1eae5: mov es:[edi], ax
        ax = 1;                                  // 1eae9: mov ax, 1
        if (ax === 1) {                          // 1eaed: cmp ax, 1; jne 1eb0c (never taken)
          let esi = dov >>> 0;                   // 1eaf3: mov esi, [ebp+8]
          es = selBase(sel);                     // 1eaf6: mov es, [ebp-0xe]
          edi = (off + 8) >>> 0;                 // 1eafa..1eafd: mov edi, [ebp-8]; add edi, 8
          let cx = 0x10 >>> 1;                   // 1eb00..1eb06: xor ecx, ecx; mov cx, 0x10; shr cx, 1
          for (; cx !== 0; cx--) {               // 1eb09: rep movsw es:[edi], ds:[esi]  (DF = 0)
            W16(es + edi, R16(dsb + esi));
            esi = (esi + 2) >>> 0;
            edi = (edi + 2) >>> 0;
          }
        }
      }
      // 1eb0c..1eb11: popfd; pop es/esi/edi/ecx/eax
      // --- block 2: far pointer to +0x18 (results area) ---
      // 1eb12..1eb18: push eax/ecx/edi/esi/es; pushfd; cld
      es = selBase(sel);                         // 1eb19: mov es, [ebp-0xe]
      edi = (off + 4) >>> 0;                     // 1eb1d..1eb20: mov edi, [ebp-8]; add edi, 4
      ax = 1;                                    // 1eb23: mov ax, 1
      if (ax === 0) {                            // 1eb27: cmp ax, 0; jne 1eb38 (always taken)
        W16(es + edi, 0);                        // 1eb2d..1eb32: mov eax, 0; mov es:[edi], ax  (dead)
      } else {
        let eax = (farptr + 0x18) >>> 0;         // 1eb38..1eb3b: mov eax, [ebp-4]; add eax, 0x18
        W16(es + edi + 2, eax & 0xffff);         // 1eb3e: mov es:[edi+2], ax
        eax = eax >>> 16;                        // 1eb43: shr eax, 0x10
        W16(es + edi, eax & 0xffff);             // 1eb46: mov es:[edi], ax
        ax = 0;                                  // 1eb4a: mov ax, 0
        if (ax === 1) {                          // 1eb4e: cmp ax, 1; jne 1eb6d (always taken: dr is not copied in)
          let esi = dr >>> 0;                    // 1eb54: mov esi, [ebp+0xc]  (dead)
          es = selBase(sel);                     // 1eb57: mov es, [ebp-0xe]
          edi = (off + 0x18) >>> 0;              // 1eb5b..1eb5e: mov edi, [ebp-8]; add edi, 0x18
          let cx = 0x40 >>> 1;                   // 1eb61..1eb67: xor ecx, ecx; mov cx, 0x40; shr cx, 1
          for (; cx !== 0; cx--) {               // 1eb6a: rep movsw es:[edi], ds:[esi]
            W16(es + edi, R16(dsb + esi));
            esi = (esi + 2) >>> 0;
            edi = (edi + 2) >>> 0;
          }
        }
      }
      // 1eb6d..1eb72: popfd; pop es/esi/edi/ecx/eax
      // 1eb73..1eb7a: push dword [ebp-4]; push 2; push 8; call 0x1e37f (callee pops 0xc)
      const res = F.sub_1e37f(8, 2, farptr);
      // 1eb7f: and eax, 0xffff; 1eb84: call 0x1e3c0 (EAX in, EAX out)
      const result = F.sub_1e3c0(res & 0xffff);  // 1eb89: mov [ebp-0xc], eax
      // --- results area (+0x18, 64 bytes) -> dr ---
      // 1eb8c..1eb93: push eax/ecx/edi/esi/es/ds; pushfd; cld
      {
        let edi2 = dr >>> 0;                     // 1eb94: mov edi, [ebp+0xc]
        const es2 = dsb;                         // 1eb97..1eb9a: mov ax, ds; mov es, ax
        let esi = (off + 0x18) >>> 0;            // 1eb9d..1eba0: mov esi, [ebp-8]; add esi, 0x18
        let cx = 0x40 >>> 1;                     // 1eba3..1eba9: xor ecx, ecx; mov cx, 0x40; shr cx, 1
        const ds2 = selBase(sel);                // 1ebac: mov ds, [ebp-0xe]
        for (; cx !== 0; cx--) {                 // 1ebb0: rep movsw es:[edi], ds:[esi]
          W16(es2 + edi2, R16(ds2 + esi));
          esi = (esi + 2) >>> 0;
          edi2 = (edi2 + 2) >>> 0;
        }
      }
      // 1ebb3..1ebb9: popfd; pop ds/es/esi/edi/ecx/eax
      F.sub_1e7a6(0x58);                         // 1ebba..1ebbc: push 0x58; call 0x1e7a6 (callee pops 4)
      void result;                               // 1ebc1: mov eax, [ebp-0xc] (leftover EAX; no caller reads it)
    }
    F.sub_1e971();                               // 1ebc4: call 0x1e971
  } else {
    F.sub_1e3ba(0x13);                           // 1ebd8..1ebdd: mov eax, 0x13; call 0x1e3ba; jmp 1ebc9
  }
  W8(dsb + 0x31086, (R8(dsb + 0x31086) - 1) & 0xff);   // 1ebc9: dec byte [0x31086]
  // 1ebcf..1ebd7: pop edi/esi/es/ds/edx/ecx/ebx; leave; ret
});
