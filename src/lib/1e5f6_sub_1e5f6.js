// 0x1e5f6  int sub_1e5f6(eax)   [no stack args, plain `ret`; EBX/ECX/EDX saved/restored; one dword local
//          [ebp-4] whose word [ebp-2] is passed by address to 0x1f1fb; returns EAX]
// DiamondWare STK client, called by dws_DPlay (0x1f08c) and dws_MPlay (0x1fb44) before they allocate a new
// DOS buffer; both test the result (`cmp eax, 0; je`). Walks the 36-entry DWD-copy table filled by 0x1e705
// (0x30c95[i] = sound number, 0x30db5[i] = DOS-buffer selector, 0x30f65[i] = sequence number taken from the
// counter 0x30c91, 0x30ff5[i] = size; see 1e705_sub_1e705.js):
//   pass 1 (i = 0..35): for each used entry, query its sound with 0x1f1fb(sound, &word) (dws_DSoundStatus
//     worker); if that returns 0 -> return 0; if (word & 3) == 0 free the buffer with
//     0x1e52c(EDX = selector, size) and clear 0x30c95[i].
//   pass 2 (i = 0..34, j = i+1..35): for each pair of used entries with the same sound number, query the
//     sound again (0 -> return 0); if (word & 2) == 0 free entry i when seq[j] >= seq[i] (unsigned) and,
//     depending on ZF after that call (see UNCERTAIN at 1e6c3), also / instead free entry j.
//
// Parameter `eax`: the caller's EAX at entry. It is an input because on some paths EAX reaches the RET
// unchanged (see "Return value"). Callers: dws_DPlay passes 0x1e43b's non-zero result, dws_MPlay 0x1fd9b's
// non-zero result (both tested `cmp eax,0; je` right before the call).
//
// Return value (EAX at 0x1e704):
//   - 0 from 0x1f1fb (jumps to 1e700 at 1e620 / 1e68b), or
//   - ORIGINAL BUG: the normal exit (1e6f4 `jae 0x1e700`) jumps PAST `mov eax, 1` at 1e6fb, which is dead
//     code (preceded by `jmp 1e655` at 1e6f6, no jump targets it). EAX is whatever was last put in it:
//       entry EAX (both tables empty / nothing loaded EAX),
//       the last 0x1f1fb result (non-zero; 0x1e52c preserves EAX: push eax 1e52f / pop eax 1e56a),
//       0x30c95[i] loaded at 1e666 (may be 0 after entry i was freed at 1e6b8), or
//       0x30f65[i] loaded at 1e695 (may be 0).
//     So the function can return 0 (-> caller fails with "error") although nothing failed, or a non-zero
//     leftover. The port tracks EAX in `eax` and returns it on every path.
//   The `mov eax, ebp; sub eax, 2` at 1e60b / 1e676 put the local's address in EAX, but 0x1f1fb overwrites
//   it before anything reads it; the port still assigns it (statement kept).
//
// Callee conventions: 0x1f1fb stack-only callee-pop (`ret 8`), returns EAX (1f1fb_sub_1f1fb.js);
// 0x1e52c DX + 1 stack dword, `ret 4`, preserves all registers incl. EAX (1e52c_sub_1e52c.js).
// Callee keys: 0x1f1fb / 0x1e52c are not named in re/names.tsv -> sub_<addr>.
import { F, register } from '../runtime/registry.js';
import { R16, R32, W16, W32 } from '../runtime/mem.js';
import { stackAlloc, stackFree } from '../runtime/stack.js';

register(0x1e5f6, 'sub_1e5f6', function sub_1e5f6(eax) {
  // 1e5f6..1e5f9: push ebp; mov ebp, esp; add esp, -4   (dword local [ebp-4]; the word [ebp-2] is used)
  const frame = stackAlloc(4);                   // [ebp-4]
  const local = frame + 2;                       // ebp-2
  // 1e5fc..1e5fe: push ebx; push ecx; push edx
  let ebx = 0;                                   // 1e5ff: xor ebx, ebx
  let ecx;
  for (;;) {
    if (R32(0x30c95 + ebx * 4) !== 0) {          // 1e601: cmp dword ptr [ebx*4+0x30c95], 0; je 1e64b
      eax = local;                               // 1e60b: mov eax, ebp; 1e60d: sub eax, 2
      // 1e610: push eax; 1e611: push dword ptr [ebx*4+0x30c95]; 1e618: call 0x1f1fb (callee pops 8)
      eax = F.sub_1f1fb(R32(0x30c95 + ebx * 4), local);
      if (eax === 0) {                           // 1e61d: cmp eax, 0; je 1e700
        stackFree(4);
        return eax;                              // 1e700..1e704: pop edx; pop ecx; pop ebx; leave; ret
      }
      W16(local, R16(local) & 3);                // 1e626: and word ptr [ebp-2], 3
      if (R16(local) === 0) {                    // 1e62b: jne 1e64b (ZF from the AND)
        // 1e62d: push dword ptr [ebx*4+0x30ff5]; 1e634: mov edx, dword ptr [ebx*4+0x30db5];
        // 1e63b: call 0x1e52c (callee pops 4; EAX preserved)
        F.sub_1e52c(R32(0x30db5 + ebx * 4), R32(0x30ff5 + ebx * 4));
        W32(0x30c95 + ebx * 4, 0);               // 1e640: mov dword ptr [ebx*4+0x30c95], 0
      }
    }
    ebx++;                                       // 1e64b: inc ebx
    if (ebx >= 0x24) break;                      // 1e64c: cmp ebx, 0x24; jae 1e653
    // 1e651: jmp 1e601
  }
  ebx = 0;                                       // 1e653: xor ebx, ebx
  for (;;) {
    inner: if (R32(0x30c95 + ebx * 4) !== 0) {   // 1e655: cmp dword ptr [ebx*4+0x30c95], 0; je 1e6f0
      ecx = ebx;                                 // 1e663: mov ecx, ebx
      ecx++;                                     // 1e665: inc ecx
      for (;;) {
        eax = R32(0x30c95 + ebx * 4);            // 1e666: mov eax, dword ptr [ebx*4+0x30c95]
        if (R32(0x30c95 + ecx * 4) === eax) {    // 1e66d: cmp dword ptr [ecx*4+0x30c95], eax; jne 1e6e5
          eax = local;                           // 1e676: mov eax, ebp; 1e678: sub eax, 2
          // 1e67b: push eax; 1e67c: push dword ptr [ebx*4+0x30c95]; 1e683: call 0x1f1fb (callee pops 8)
          eax = F.sub_1f1fb(R32(0x30c95 + ebx * 4), local);
          if (eax === 0) {                       // 1e688: cmp eax, 0; je 1e700
            stackFree(4);
            return eax;                          // 1e700..1e704: pop edx; pop ecx; pop ebx; leave; ret
          }
          if ((R16(local) & 2) === 0) {          // 1e68d: test word ptr [ebp-2], 2; jne 1e6e5
            eax = R32(0x30f65 + ebx * 4);        // 1e695: mov eax, dword ptr [ebx*4+0x30f65]
            // 1e69c: cmp dword ptr [ecx*4+0x30f65], eax; 1e6a3: jb 1e6c5 (unsigned)
            if (!((R32(0x30f65 + ecx * 4) >>> 0) < (eax >>> 0))) {
              const size = R32(0x30ff5 + ebx * 4);
              // 1e6a5: push dword ptr [ebx*4+0x30ff5]; 1e6ac: mov edx, dword ptr [ebx*4+0x30db5];
              // 1e6b3: call 0x1e52c (callee pops 4; EAX preserved)
              F.sub_1e52c(R32(0x30db5 + ebx * 4), size);
              W32(0x30c95 + ebx * 4, 0);         // 1e6b8: mov dword ptr [ebx*4+0x30c95], 0
              // 1e6c3: jne 1e6f0 — MOV does not set flags, so ZF is the one left by the call to 0x1e52c.
              // 0x1e52c's last flag-setting instruction is `shr edx, 0x10` at 1e556
              // (edx = ((size >> 4) + 1) << 4); after it come INT 31h/0601h (1e55c), INT 31h/0101h (1e563)
              // and only pop/leave/ret. So ZF = (that shifted value == 0), i.e. ZF = 1 for sizes below
              // 0xFFF0 and also for sizes >= 0xFFFFFFF0 (32-bit wrap), provided INT 31h returns the caller's
              // flags unchanged except CF.
              // Confirmed by running the callee for real: audit round1 F-risky F5
              // (re/audit/round1/F-risky/t10050_1e5f6/zf_x86.py: unicorn executes 0x1e52c natively with
              // INT 31h changing only CF; 342 scenarios, branch reached 185 times (50 ZF=1 / 135 ZF=0),
              // 0 mismatches with this port; an always-jump mutant gives 45).
              // UNCERTAIN (remaining assumption: INT 31h preserves ZF): established from the PMODE/W v1.33
              // source (pmodewk.asm: every INT 31h exit only sets/clears CF in the saved EFLAGS image before
              // iretd), not from a trace of the v1.31 kernel in GANJAFRM.EXE. The v1.31 kernel decoded by the
              // startup audit (re/audit/round1/D-data/stub_decode.py -> D-data/stub_mem.bin) does contain the
              // same exits — 16-bit code at stub_mem 0x115e0 `popad; pop gs/fs/es/ds; or byte [esp+8],1;
              // iretd` and 0x11607 `...; and byte [esp+8],0xfe; iretd` (CF only) — but the dispatch of
              // 0601h/0101h to them was not traced. Under an external DPMI host (not PMODE/W) only CF is
              // defined.
              // After entry i is freed and the code falls through, EAX = 0x30c95[i] = 0, so later EMPTY
              // entries j "match" and 0x1f1fb(0, &local) is called for them (reproduced by re-reading memory).
              // With ZF = 1 the code falls through and also frees entry j (below). Ghidra (and the difftest
              // stub, which keeps flags across a stubbed call) instead use ZF of the cmp at 1e69c, i.e.
              // seq[j] == seq[i]; seq numbers are unique (0x30c91 counter), so under that reading the
              // fall-through would practically never happen.
              const zf = ((((((size >>> 4) + 1) >>> 0) << 4) >>> 0) >>> 16) === 0;
              if (!zf) break inner;              // jne 1e6f0
            }
            // 1e6c5: push dword ptr [ebx*4+0x30ff5]; 1e6cc: mov edx, dword ptr [ecx*4+0x30db5];
            // 1e6d3: call 0x1e52c (callee pops 4; EAX preserved)
            // ORIGINAL BUG (probably): the size pushed is entry i's (ebx), the selector is entry j's (ecx).
            F.sub_1e52c(R32(0x30db5 + ecx * 4), R32(0x30ff5 + ebx * 4));
            W32(0x30c95 + ecx * 4, 0);           // 1e6d8: mov dword ptr [ecx*4+0x30c95], 0
            // 1e6e3: jne 1e6e5 — both outcomes continue at 1e6e5
          }
        }
        ecx++;                                   // 1e6e5: inc ecx
        if (ecx >= 0x24) break;                  // 1e6e6: cmp ecx, 0x24; jae 1e6f0
        // 1e6eb: jmp 1e666
      }
    }
    ebx++;                                       // 1e6f0: inc ebx
    if (ebx >= 0x23) break;                      // 1e6f1: cmp ebx, 0x23; jae 1e700
    // 1e6f6: jmp 1e655
  }
  // 1e6fb: mov eax, 1 — dead code (see header, ORIGINAL BUG)
  stackFree(4);
  return eax;                                    // 1e700..1e704: pop edx; pop ecx; pop ebx; leave; ret
});
