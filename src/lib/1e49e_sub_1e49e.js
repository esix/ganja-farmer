// 0x1e49e  {eax, ebx, ecx, edx} sub_1e49e(DWORD size)
//          [1 stack arg, callee pops (`ret 4`); returns registers (argc_overrides.json "retregs" eax/ebx/ecx/edx; "retregsIf" eax==0 → eax only)]
// DiamondWare STK client: DOS buffer allocation through DPMI INT 31h (re/HARDWARE.md §5/§6).
//  1. AX=0100h BX=0x11F8 paragraphs (probe block); CF=1 -> error.
//  2. AX=0100h EBX=(size >> 4) + 1 paragraphs (the real buffer); CF=1 -> frees the probe block (0101h), error.
//  3. pushal; AX=0006h BX=selector -> CX:DX linear base; AX=0600h lock BX:CX = base, SI:DI =
//     ((size >> 4) + 1) << 4 bytes; popal.
//  4. Frees the probe block (AX=0101h DX=probe selector, inside pushal/popal).
// Success: EAX = 1, EBX = real-mode segment << 16, ECX = selector (zero-extended), EDX = 0 (0x1e4c6..0x1e4d3,
// all kept across both pushal/popal pairs). Failure: F.sub_1e3ba(0x65) (stores 0x65 at 0x30c7f; see src/lib/1e3ba_sub_1e3ba.js),
// EAX = 0.
// The CF of the 0006h / 0600h / 0101h calls is not tested by the original.
// Callers: 0x1e5a2 (0x1e597: reads EAX, CX), 0x1e918 (0x1e8d1: EAX, EBX, CX), 0x1f0a6 (dws_DPlay: EAX, EBX, CX,
// and EDX at 0x1f0bb). All three test EAX first (`cmp eax,0; je`) and read no other register when it is 0.
// EDX is returned as well because dws_DPlay reads it (0x1f0bb `mov [ebp-0xc], edx`); argc_overrides.json lists
// only eax/ebx/ecx.
// Failure return: EBX/ECX/EDX are leftovers (INT results / caller values, then whatever 0x1e3ba leaves; 0x1e3ba
// is only `mov [0x30c7f], eax; ret`) and no caller reads them -> only {eax: 0} is returned.
// Callee key: 0x1e3ba is not named in re/names.tsv -> sub_1e3ba.
import { F, register } from '../runtime/registry.js';
import { int86 } from '../runtime/io.js';

register(0x1e49e, 'sub_1e49e', function sub_1e49e(size) {
  // 1e49e..1e4a1: push ebp; mov ebp, esp; add esp, -4   ([ebp-2]: word, probe selector)
  fail: {
    // 1e4a4..1e4af: xor ax, ax; mov ax, 0x100; mov bx, 0x11f8; int 0x31
    const r1 = int86(0x31, { ax: 0x100, bx: 0x11f8 });
    if (r1.cflag ?? r1.cf) break fail;                       // 1e4b1: jb 1e51e
    const probeSel = r1.edx & 0xffff;                        // 1e4b3: mov word [ebp-2], dx
    // 1e4b7..1e4c2: mov ax, 0x100; mov ebx, [ebp+8]; shr ebx, 4; inc ebx; int 0x31
    const r2 = int86(0x31, { ax: 0x100, ebx: (((size >>> 4) + 1) >>> 0) });
    if (r2.cflag ?? r2.cf) {                                 // 1e4c4: jb 1e514
      // 1e514..1e51c: mov dx, word [ebp-2]; mov ax, 0x101; int 0x31   (CF not tested)
      int86(0x31, { dx: probeSel, ax: 0x101 });
      break fail;                                            // falls into 1e51e
    }
    const ebx = ((r2.eax & 0xffff) << 16) >>> 0;             // 1e4c6..1e4cc: shl eax, 16; xor ax, ax; mov ebx, eax
    const ecx = r2.edx & 0xffff;                             // 1e4ce, 1e4d0: xor ecx, ecx; mov cx, dx
    const edx = 0;                                           // 1e4d3: xor edx, edx
    // 1e4d5: pushal
    // 1e4d6..1e4dd: mov bx, cx; mov ax, 6; int 0x31
    // ECX (= selector, 1e4d0) and EDX (= 0, 1e4d3) are not loaded for this INT but CX and DX are read after it
    // (1e4e6/1e4e3); they are passed so that what the host leaves in them is what the port reads back.
    const r3 = int86(0x31, { bx: ecx, ax: 6, ecx: ecx, edx: edx });
    // 1e4df..1e4fc: mov ax, 0x600; mov bx, cx; mov cx, dx; mov edx, [ebp+8]; shr edx, 4; inc edx; shl edx, 4;
    //               mov di, dx; shr edx, 0x10; mov si, dx; int 0x31   (CF not tested)
    const len = ((((size >>> 4) + 1) << 4) >>> 0);
    int86(0x31, {
      ax: 0x600, bx: r3.ecx & 0xffff, cx: r3.edx & 0xffff,
      edx: len >>> 16, di: len & 0xffff, si: len >>> 16,
    });
    // 1e4fe: popal (EBX = segment << 16, ECX = selector, EDX = 0 again)
    const eax = 1;                                           // 1e4ff: mov eax, 1
    // 1e504: pushal
    // 1e505..1e50d: mov dx, word [ebp-2]; mov ax, 0x101; int 0x31   (CF not tested)
    int86(0x31, { dx: probeSel, ax: 0x101 });
    // 1e50f: popal
    return { eax, ebx, ecx, edx };                           // 1e510, 1e511: leave; ret 4
  }
  F.sub_1e3ba(0x65);                                         // 1e51e, 1e523: mov eax, 0x65; call 0x1e3ba
  return { eax: 0 };                                         // 1e528: xor eax, eax; jmp 1e510 (leave; ret 4)
});
