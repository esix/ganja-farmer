// 0x1fc3f  void dws_MSongStatus(result)   [cdecl, 1 stack arg: [ebp+8] = result (32-bit near pointer,
//          DS-relative, to a WORD); EBX/ECX/EDX/DS/ES/ESI/EDI saved/restored; no return value]
// DiamondWare STK client wrapper for STK function 0x13 (dws_MSongStatus, LIBRARY.md). Same frame as
// 1ff4f_dwt_Init.js / 1ffe0_dwt_Kill.js / 1ea27_dws_DetectHardWare.js (DS check at 0x30c61, magic 0x31088,
// re-entry byte 0x31086, session open 0x1e8d1 / close 0x1e971). The status word is written back through the
// pointer as in 0x1f1fb (dws_DSoundStatus worker).
//   0x1e774(6) reserves 6 bytes of the DOS buffer and returns {eax = real-mode far pointer seg:off,
//   ecx = buffer selector (CX), edx = offset} (see 1ea27_dws_DetectHardWare.js header).
//   Block layout (offsets from the start of the reserved area, written via selector:offset):
//     +0  WORD  high word of farptr+4     (1fcef..1fcfd; edi = off+0, stored at es:[edi])
//     +2  WORD  low  word of farptr+4     (es:[edi+2])
//     +4  WORD  result area (not copied in: 1fd01 `mov ax, 0` / `cmp ax, 1` -> jne taken)
//   then 0x1e37f(n = 4, fn = 0x13, farptr) (callee pops 0xc), result & 0xFFFF -> 0x1e3c0 (EAX) -> [ebp-0x10];
//   one word (rep movsw, CX = 2 >> 1 = 1) copied from selector:[off+4] to DS:[result]; 0x1e7a6(6) releases
//   the 6 bytes.
// Return: EAX at `ret` is a leftover (1fd78 `mov eax, [ebp-0x10]` then 0x1e971; error paths leave 0x1e3ba's
// EAX). The three callers (0x1006e, 0x102c0, 0x2354b) are each followed by `add esp, 4` and read the status
// through the pointer, never EAX (0x102c0 is followed by the epilogue of 0x10050, whose callers do not read
// EAX: signatures.json returns=false); signatures.json returns=false for 0x1fc3f. So nothing is returned.
// The copy section at 1fcda tests constants (`mov ax, 1|0; cmp ax, 0|1`); the branches that cannot be taken
// are kept as dead code, as in 1ea27_dws_DetectHardWare.js.
// Callee keys: 0x1e774 / 0x1e37f / 0x1e3c0 / 0x1e7a6 / 0x1e8d1 / 0x1e971 / 0x1e3ba are not named in
// re/names.tsv -> sub_<addr>.
import { F, register } from '../runtime/registry.js';
import { R8, R16, R32, W8, W16 } from '../runtime/mem.js';
import { SEL_CODE, SEL_DATA, selBase } from '../platform/dpmi.js';

register(0x1fc3f, 'dws_MSongStatus_1fc3f', function dws_MSongStatus(result) {
  // 1fc3f..1fc4c: push ebp; mov ebp, esp; add esp, -0x10; push ebx/ecx/edx/ds/es/esi/edi; push eax
  // UNCERTAIN: DS at entry is the extender-chosen data selector; the port uses SEL_DATA (platform/dpmi.js),
  // as dwt_Init / dwt_Kill / dws_DetectHardWare do.
  let ds = SEL_DATA;
  check: {
    const csBase = selBase(SEL_CODE);              // cs: overrides below (base 0 under PMODE/W flat model)
    if (R16(csBase + 0x30c61) !== 0) {                    // 1fc4d: cmp word cs:[0x30c61], 0; je 1fc6f
      if (R16(csBase + 0x30c61) === ds) break check;      // 1fc58..1fc63: mov ax, ds; cmp cs:[0x30c61], ax; je 1fc94
      ds = R16(csBase + 0x30c61);                         // 1fc65: mov ds, cs:[0x30c61]
      // 1fc6d: je 1fc94 — flags still from the cmp at 1fc5b (not equal), never taken
    }
    W16(selBase(ds) + 0x30c61, ds);              // 1fc6f: mov word [0x30c61], ds   (DS-relative)
    // 1fc76..1fc82: mov eax, cs:[0x31088]; cmp eax, ds:[0x31088]; je 1fc94
    if (R32(csBase + 0x31088) === R32(selBase(ds) + 0x31088)) break check;
    // 1fc84: pop eax
    F.sub_1e3ba(0x29a);                          // 1fc85..1fc8a: mov eax, 0x29a; call 0x1e3ba
    return;                                      // 1fc8f: jmp 1fd86 (pop edi..ebx; leave; ret)
  }
  // 1fc94: pop eax; 1fc95: xor eax, eax
  // UNCERTAIN: when DS was reloaded from 0x30c61 the callees below also run with that DS; the port cannot
  // pass a segment register to them (only reachable if 0x30c61 holds a selector other than SEL_DATA).
  const dsb = selBase(ds);
  W8(dsb + 0x31086, (R8(dsb + 0x31086) + 1) & 0xff);   // 1fc97: inc byte [0x31086]
  if (R8(dsb + 0x31086) === 1) {                 // 1fc9d: cmp byte [0x31086], 1; jne 1fd8f
    if (F.sub_1e8d1() !== 0) {                   // 1fcaa..1fcb2: call 0x1e8d1; cmp eax, 0; je 1fd7b
      const r = F.sub_1e774(6);                  // 1fcb8..1fcba: push 6; call 0x1e774 (callee pops 4)
      const farptr = r.eax >>> 0;                // 1fcbf: mov [ebp-4], eax
      const sel = r.ecx & 0xffff;                // 1fcc2: mov [ebp-6], cx
      const off = r.edx >>> 0;                   // 1fcc6: mov [ebp-0xc], edx
      // --- far pointer to +4 (result area) at +0 ---
      // 1fcc9..1fccf: push eax/ecx/edi/esi/es; pushfd; cld
      let es = selBase(sel);                     // 1fcd0: mov es, [ebp-6]
      let edi = (off + 0) >>> 0;                 // 1fcd4..1fcd7: mov edi, [ebp-0xc]; add edi, 0
      let ax = 1;                                // 1fcda: mov ax, 1
      if (ax === 0) {                            // 1fcde: cmp ax, 0; jne 1fcef (always taken)
        W16(es + edi, 0);                        // 1fce4..1fce9: mov eax, 0; mov es:[edi], ax  (dead)
      } else {
        let eax = (farptr + 4) >>> 0;            // 1fcef..1fcf2: mov eax, [ebp-4]; add eax, 4
        W16(es + edi + 2, eax & 0xffff);         // 1fcf5: mov es:[edi+2], ax
        eax = eax >>> 16;                        // 1fcfa: shr eax, 0x10
        W16(es + edi, eax & 0xffff);             // 1fcfd: mov es:[edi], ax
        ax = 0;                                  // 1fd01: mov ax, 0
        if (ax === 1) {                          // 1fd05: cmp ax, 1; jne 1fd24 (always taken: result not copied in)
          let esi = result >>> 0;                // 1fd0b: mov esi, [ebp+8]  (dead)
          es = selBase(sel);                     // 1fd0e: mov es, [ebp-6]
          edi = (off + 4) >>> 0;                 // 1fd12..1fd15: mov edi, [ebp-0xc]; add edi, 4
          let cx = 2 >>> 1;                      // 1fd18..1fd1e: xor ecx, ecx; mov cx, 2; shr cx, 1
          for (; cx !== 0; cx--) {               // 1fd21: rep movsw es:[edi], ds:[esi]  (DF = 0)
            W16(es + edi, R16(dsb + esi));
            esi = (esi + 2) >>> 0;
            edi = (edi + 2) >>> 0;
          }
        }
      }
      // 1fd24..1fd29: popfd; pop es/esi/edi/ecx/eax
      // 1fd2a..1fd31: push dword [ebp-4]; push 0x13; push 4; call 0x1e37f (callee pops 0xc)
      const res = F.sub_1e37f(4, 0x13, farptr);
      // 1fd36: and eax, 0xffff; 1fd3b: call 0x1e3c0 (EAX in, EAX out)
      const status = F.sub_1e3c0(res & 0xffff);  // 1fd40: mov [ebp-0x10], eax
      // --- result area (+4, 1 word) -> result ---
      // 1fd43..1fd4a: push eax/ecx/edi/esi/es/ds; pushfd; cld
      {
        let edi2 = result >>> 0;                 // 1fd4b: mov edi, [ebp+8]
        const es2 = dsb;                         // 1fd4e..1fd51: mov ax, ds; mov es, ax
        let esi = (off + 4) >>> 0;               // 1fd54..1fd57: mov esi, [ebp-0xc]; add esi, 4
        let cx = 2 >>> 1;                        // 1fd5a..1fd60: xor ecx, ecx; mov cx, 2; shr cx, 1
        const ds2 = selBase(sel);                // 1fd63: mov ds, [ebp-6]
        for (; cx !== 0; cx--) {                 // 1fd67: rep movsw es:[edi], ds:[esi]
          W16(es2 + edi2, R16(ds2 + esi));
          esi = (esi + 2) >>> 0;
          edi2 = (edi2 + 2) >>> 0;
        }
      }
      // 1fd6a..1fd70: popfd; pop ds/es/esi/edi/ecx/eax
      F.sub_1e7a6(6);                            // 1fd71..1fd73: push 6; call 0x1e7a6 (callee pops 4)
      void status;                               // 1fd78: mov eax, [ebp-0x10] (leftover EAX; no caller reads it)
    }
    F.sub_1e971();                               // 1fd7b: call 0x1e971
  } else {
    F.sub_1e3ba(0x13);                           // 1fd8f..1fd94: mov eax, 0x13; call 0x1e3ba; jmp 1fd80
  }
  W8(dsb + 0x31086, (R8(dsb + 0x31086) - 1) & 0xff);   // 1fd80: dec byte [0x31086]
  // 1fd86..1fd8e: pop edi/esi/es/ds/edx/ecx/ebx; leave; ret
});
