// 0x1e859  int sub_1e859(void)
//          [Watcom, no args (EBX/ECX/EDX/DS are pushed at 0x1e85f..0x1e862 and popped at 0x1e8c7..0x1e8ca as
//          callee saves; signatures.json "regs": 4 counts those pushes); returns EAX = vector number or 0]
// DiamondWare STK client: interrupt-vector discovery (re/HARDWARE.md §5/§6). For v = 0x60..0x66: DPMI
// INT 31h AX=0200h BL=v -> real-mode vector CX:DX; if CX*16+DX != 0: DPMI INT 31h AX=0002h BX=CX -> selector
// in AX (CF=0: DS=AX, offset EDX; CF=1: DS = the caller's DS, offset = CX*16+DX); if the bytes at offset
// +2, +3, +4 are 'S','T','K' returns v. After v = 0x66 returns 0. The only caller is 0x1e8d1 (0x1e8ec),
// which stores a non-zero result as a byte at 0x31087 (0x1e8f1..0x1e8f6).
import { register } from '../runtime/registry.js';
import { R8 } from '../runtime/mem.js';
import { int86 } from '../runtime/io.js';
import { SEL_DATA, selBase } from '../platform/dpmi.js';

register(0x1e859, 'sub_1e859', function sub_1e859() {
  // 1e859..1e862: push ebp; mov ebp, esp; add esp, -0xc; push ebx; push ecx; push edx; push ds
  // UNCERTAIN: DS at entry is the extender-chosen data selector; ported code runs with the program's flat
  // data selector, emulated as SEL_DATA (platform/dpmi.js), as in dwt_Init 0x1ff4f / dwt_Kill 0x1ffe0.
  const savedDs = SEL_DATA;                          // 1e863: mov word [ebp-8], ds
  let ds = SEL_DATA;
  let v = 0x60;                                      // 1e867: mov dword [ebp-4], 0x60
  do {
    // 1e86e..1e87a: mov eax, 0x200; mov ebx, [ebp-4]; xor ecx, ecx; xor edx, edx; int 0x31
    const r1 = int86(0x31, { eax: 0x200, ebx: v, ecx: 0, edx: 0 });
    const ecx = r1.ecx >>> 0;
    let edx = r1.edx >>> 0;
    // 1e87c..1e883: mov eax, ecx; shl eax, 4; add eax, edx; mov [ebp-0xc], eax
    const linear = ((ecx << 4) + edx) | 0;
    if (linear !== 0) {                              // 1e886: cmp eax, 0; je 1e8b9
      // 1e88b..1e893: mov eax, 2; mov bx, cx; int 0x31
      // EDX is not loaded for this INT but is read after it (1e8a5); it is passed so that the value the
      // host leaves in EDX (DPMI 0002h does not change it) is what the port reads back.
      const r2 = int86(0x31, { eax: 2, bx: ecx & 0xffff, edx: edx });
      if (!(r2.cflag ?? r2.cf)) {                    // 1e895: jb 1e89c
        ds = r2.eax & 0xffff;                        // 1e897: mov ds, ax
        edx = r2.edx >>> 0;                          //        (EDX as left by the INT)
      } else {
        ds = savedDs;                                // 1e89c: mov ds, word [ebp-8]
        edx = linear >>> 0;                          // 1e8a0: mov edx, [ebp-0xc]
      }
      // 1e8a5..1e8b5: cmp byte ds:[edx+2], 'S'; cmp byte ds:[edx+3], 'T'; cmp byte ds:[edx+4], 'K'
      const base = selBase(ds);
      if (R8((base + ((edx + 2) >>> 0)) >>> 0) === 0x53 &&
          R8((base + ((edx + 3) >>> 0)) >>> 0) === 0x54 &&
          R8((base + ((edx + 4) >>> 0)) >>> 0) === 0x4b) {
        return v;                                    // 1e8b7 -> 1e8c4: mov eax, [ebp-4]; pop ds..; leave; ret
      }
    }
    v = (v + 1) >>> 0;                               // 1e8b9: inc dword [ebp-4]
  } while (v <= 0x66);                               // 1e8bc: cmp dword [ebp-4], 0x66; jbe 1e86e (unsigned)
  return 0;                                          // 1e8c2 -> 1e8cd: xor eax, eax; jmp 1e8c7 (pop ds..; ret)
});
