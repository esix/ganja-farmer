// 0x1f1fb  int sub_1f1fb(soundnum, result)   [2 stack args, callee pops (ret 8): [ebp+8] = soundnum (dword; only
//          its low word is used), [ebp+0xc] = result (32-bit near pointer, DS-relative); EBX/ECX/EDX/ES/ESI/EDI
//          saved/restored; returns EAX]
// Worker of dws_DSoundStatus (0x1f348, STK function 9, LIBRARY.md); also called by 0x1e5f6 (at 0x1e618 and
// 0x1e683). Opens the STK session (0x1e8d1); if that returns non-zero, reserves 8 bytes of the DOS buffer
// with 0x1e774(8) (returns EAX = real-mode far pointer seg:off, CX = buffer selector, EDX = offset; see the
// header of 1ea27_dws_DetectHardWare.js) and builds this argument block (offsets from the reserved area,
// written via selector:offset):
//   +0  WORD  soundnum (low word of [ebp+8])            (0x1f237 `mov ax, 0` / `cmp ax, 0` -> equal, 1f241..1f244)
//   +2  WORD  high word of farptr+6                     (1f2ad..1f2bb; edi = off+2, stored at es:[edi])
//   +4  WORD  low  word of farptr+6                     (es:[edi+2])
//   +6  WORD  result area (not copied in: 1f2bf `mov ax, 0` / `cmp ax, 1` -> jne taken)
// then 0x1e37f(n = 6, fn = 9, farptr) (callee pops 0xc); result & 0xFFFF -> 0x1e3c0 (EAX) -> [ebp-0x10];
// copies one word (rep movsw, CX = 2 >> 1 = 1) from selector:[off+6] to DS:[result]; releases the 8 bytes
// with 0x1e7a6(8). Finally closes the session (0x1e971) on both paths.
// Return: the caller 0x1e5f6 reads EAX (`cmp eax, 0` at 0x1e61d / 0x1e688). EAX at RET is set deliberately:
// 0x1f336 `mov eax, [ebp-0x10]` (0x1e3c0 result), or on the failed-open path the 0 just returned by 0x1e8d1
// (tested by `cmp eax, 0; je 1f339`). 0x1e971 does not change EAX: it saves only EDX itself and its callees
// preserve EAX (0x1e52c push eax at 0x1e52f / pop eax at 0x1e56a, 0x1e56f / 0x1e5c1 do not touch EAX outside
// 0x1e52c, 0x1e808 push/pop eax). So the value is returned.
// The two copy sections at 1f237 and 1f298 test constants (`mov ax, 0|1; cmp ax, 0|1`); the branches that
// cannot be taken are kept as dead code, as in 1ea27_dws_DetectHardWare.js.
// Callee keys: 0x1e8d1 / 0x1e774 / 0x1e37f / 0x1e3c0 / 0x1e7a6 / 0x1e971 are not named in re/names.tsv ->
// sub_<addr>.
import { F, register } from '../runtime/registry.js';
import { R16, W16 } from '../runtime/mem.js';
import { SEL_DATA, selBase } from '../platform/dpmi.js';

register(0x1f1fb, 'sub_1f1fb', function sub_1f1fb(soundnum, result) {
  // 1f1fb..1f206: push ebp; mov ebp, esp; add esp, -0x10; push ebx/ecx/edx/es/esi/edi
  // UNCERTAIN: DS is the caller's data selector (not changed by this function); the port uses SEL_DATA
  // (platform/dpmi.js), as dwt_Init / dws_DetectHardWare do.
  const dsb = selBase(SEL_DATA);
  let eax = F.sub_1e8d1();                       // 1f207: call 0x1e8d1
  if (eax !== 0) {                               // 1f20c: cmp eax, 0; je 1f339
    const r = F.sub_1e774(8);                    // 1f215..1f217: push 8; call 0x1e774 (callee pops 4)
    const farptr = r.eax >>> 0;                  // 1f21c: mov [ebp-4], eax
    const sel = r.ecx & 0xffff;                  // 1f21f: mov [ebp-6], cx
    const off = r.edx >>> 0;                     // 1f223: mov [ebp-0xc], edx
    // --- block 1: soundnum -> +0 ---
    // 1f226..1f22c: push eax/ecx/edi/esi/es; pushfd; cld
    let es = selBase(sel);                       // 1f22d: mov es, [ebp-6]
    let edi = (off + 0) >>> 0;                   // 1f231..1f234: mov edi, [ebp-0xc]; add edi, 0
    let ax = 0;                                  // 1f237: mov ax, 0
    if (ax === 0) {                              // 1f23b: cmp ax, 0; jne 1f24a (never taken)
      W16(es + edi, soundnum & 0xffff);          // 1f241..1f244: mov eax, [ebp+8]; mov es:[edi], ax
      // 1f248: jmp 1f281
    } else {
      let e = (farptr + 0) >>> 0;                // 1f24a..1f24d: mov eax, [ebp-4]; add eax, 0  (dead)
      W16(es + edi + 2, e & 0xffff);             // 1f250: mov es:[edi+2], ax
      e = e >>> 16;                              // 1f255: shr eax, 0x10
      W16(es + edi, e & 0xffff);                 // 1f258: mov es:[edi], ax
      ax = 1;                                    // 1f25c: mov ax, 1
      if (ax === 1) {                            // 1f260: cmp ax, 1; jne 1f281
        let esi = 0;                             // 1f266: mov esi, 0
        es = selBase(sel);                       // 1f26b: mov es, [ebp-6]
        edi = (off + 0) >>> 0;                   // 1f26f..1f272: mov edi, [ebp-0xc]; add edi, 0
        let cx = 2 >>> 1;                        // 1f275..1f27b: xor ecx, ecx; mov cx, 2; shr cx, 1
        for (; cx !== 0; cx--) {                 // 1f27e: rep movsw es:[edi], ds:[esi]  (DF = 0)
          W16(es + edi, R16(dsb + esi));
          esi = (esi + 2) >>> 0;
          edi = (edi + 2) >>> 0;
        }
      }
    }
    // 1f281..1f286: popfd; pop es/esi/edi/ecx/eax
    // --- block 2: far pointer to +6 (result area) at +2 ---
    // 1f287..1f28d: push eax/ecx/edi/esi/es; pushfd; cld
    es = selBase(sel);                           // 1f28e: mov es, [ebp-6]
    edi = (off + 2) >>> 0;                       // 1f292..1f295: mov edi, [ebp-0xc]; add edi, 2
    ax = 1;                                      // 1f298: mov ax, 1
    if (ax === 0) {                              // 1f29c: cmp ax, 0; jne 1f2ad (always taken)
      W16(es + edi, 0);                          // 1f2a2..1f2a7: mov eax, 0; mov es:[edi], ax  (dead)
    } else {
      let e = (farptr + 6) >>> 0;                // 1f2ad..1f2b0: mov eax, [ebp-4]; add eax, 6
      W16(es + edi + 2, e & 0xffff);             // 1f2b3: mov es:[edi+2], ax
      e = e >>> 16;                              // 1f2b8: shr eax, 0x10
      W16(es + edi, e & 0xffff);                 // 1f2bb: mov es:[edi], ax
      ax = 0;                                    // 1f2bf: mov ax, 0
      if (ax === 1) {                            // 1f2c3: cmp ax, 1; jne 1f2e2 (always taken: result not copied in)
        let esi = result >>> 0;                  // 1f2c9: mov esi, [ebp+0xc]  (dead)
        es = selBase(sel);                       // 1f2cc: mov es, [ebp-6]
        edi = (off + 6) >>> 0;                   // 1f2d0..1f2d3: mov edi, [ebp-0xc]; add edi, 6
        let cx = 2 >>> 1;                        // 1f2d6..1f2dc: xor ecx, ecx; mov cx, 2; shr cx, 1
        for (; cx !== 0; cx--) {                 // 1f2df: rep movsw es:[edi], ds:[esi]
          W16(es + edi, R16(dsb + esi));
          esi = (esi + 2) >>> 0;
          edi = (edi + 2) >>> 0;
        }
      }
    }
    // 1f2e2..1f2e7: popfd; pop es/esi/edi/ecx/eax
    // 1f2e8..1f2ef: push dword [ebp-4]; push 9; push 6; call 0x1e37f (callee pops 0xc)
    const res = F.sub_1e37f(6, 9, farptr);
    // 1f2f4: and eax, 0xffff; 1f2f9: call 0x1e3c0 (EAX in, EAX out)
    const status = F.sub_1e3c0(res & 0xffff);    // 1f2fe: mov [ebp-0x10], eax
    // --- result area (+6, 1 word) -> result ---
    // 1f301..1f308: push eax/ecx/edi/esi/es/ds; pushfd; cld
    {
      let edi2 = result >>> 0;                   // 1f309: mov edi, [ebp+0xc]
      const es2 = dsb;                           // 1f30c..1f30f: mov ax, ds; mov es, ax
      let esi = (off + 6) >>> 0;                 // 1f312..1f315: mov esi, [ebp-0xc]; add esi, 6
      let cx = 2 >>> 1;                          // 1f318..1f31e: xor ecx, ecx; mov cx, 2; shr cx, 1
      const ds2 = selBase(sel);                  // 1f321: mov ds, [ebp-6]
      for (; cx !== 0; cx--) {                   // 1f325: rep movsw es:[edi], ds:[esi]
        W16(es2 + edi2, R16(ds2 + esi));
        esi = (esi + 2) >>> 0;
        edi2 = (edi2 + 2) >>> 0;
      }
    }
    // 1f328..1f32e: popfd; pop ds/es/esi/edi/ecx/eax
    F.sub_1e7a6(8);                              // 1f32f..1f331: push 8; call 0x1e7a6 (callee pops 4)
    eax = status;                                // 1f336: mov eax, [ebp-0x10]
  }
  F.sub_1e971();                                 // 1f339: call 0x1e971 (preserves EAX, see header)
  // 1f33e..1f345: pop edi/esi/es/edx/ecx/ebx; leave; ret 8
  return eax;
});
