// 0x1098f  void sub_1098f(void)   [Watcom, no args, no return value]
// Args: none (signatures.json regs 0 / stack 0; EAX/EDX/EBX/ECX are loaded before any read; EBX/ECX/EDX/ESI/EDI
// are saved/restored).
// Return: none — EAX at the RET (0x10b7c) is a leftover; the only caller (0x1e002) does `xor eax,eax` next.
// Calls sub_10767 (reads "scores.dat" into the 9-entry table at 0x60a70, stride 0x18 — see 10767_sub_10767.js),
// then finds the first i in 0..8 with dword [0x60a68] > dword [0x60a70 + i*0x18] (signed, jle at 0x109dc).
// If there is one: Time_Delay(1); entry+0 = [0x60a68], entry+4 = [0x30bec]; prints " !!!New Top Score!!! "
// (0x30033) and "Please type your name then press enter" (0x30049) with Print_String_DB, Show_Double_Buffer(
// [0x64e7c], 0), Time_Delay(1), Keyboard_Remove_Driver, fills entry+8..entry+22 (15 bytes; no terminator written, +23 untouched) with 0x20, then
// reads keys with kbhit/getch until 15 characters were counted or getch returns 0x0d:
//   - while !kbhit(): Time_Delay(1), sub_14fba(), sub_10050();
//   - 0x08 with pos >= 1: entry+7+pos = 0x20, pos -= 2;  any other non-0x08 key: entry+8+pos = key,
//     dws_DPlay(0x61160) (dws_DPLAY, LIBRARY.md);
//   - then Show_Double_Buffer([0x64e7c], 0), Print_String(0x6c, 100, 0xfc, entry+8, 0), pos++, Time_Delay(1),
//     sub_14fba().
// Afterwards Keyboard_Install_Driver, sub_10676 (writes the table to "scores.dat", see 10676_sub_10676.js) and
// dws_DPlay(0x611c0) (dws_DPLAY per LIBRARY.md stride-0x20 array).
// 0x60a68 / 0x30bec: copied to entry+0 / entry+4 here, and loaded from entry+0 / entry+4 in sub_107ce (0x10833/
// 0x10842). The table layout (dword, dword, name at +8) is that written by sub_10676.
// Frame (sub esp,0x10): [ebp-0x10] i, [ebp-0xc] pos, [ebp-8] j, [ebp-4] key byte (al of getch, 0x10ab7).
// [ebp-4] is READ before it is ever written: 0x10a88 `cmp byte [ebp-4],0xd` on the first pass of the input
// loop sees whatever the stack held. The frame is therefore one emulated block laid out like the original
// (107ce_sub_107ce.js pattern), so that byte is read from the port's fresh frame, which stackAlloc fills with 0xcc (never 0x0d); the original's value depends on earlier stack contents.
// UNCERTAIN: the actual uninitialized value in the original depends on earlier stack contents (caller
// 0x1e002's history); if it happened to be 0x0d, the input loop would be skipped entirely.
// Busy-wait note: the kbhit loop (0x10a93..0x10ab0) exits on DOS console input (INT 21h AH=0Bh inside kbhit,
// crt.js), not on a memory location read here; its body awaits Time_Delay(1), which yields while waiting for
// the BIOS tick (20404_Time_Delay.js), so no extra yieldCpu is added.
import { F, register } from '../runtime/registry.js';
import { R8, R32, W8, W32 } from '../runtime/mem.js';
import { stackAlloc, stackFree } from '../runtime/stack.js';

register(0x1098f, 'sub_1098f', async function sub_1098f() {
  const frame = stackAlloc(0x10);              // 0x109a1 sub esp, 0x10
  const L = (off) => frame + 0x10 - off;       // address of [ebp - off]
  const I = L(0x10);                           // [ebp-0x10]: table index
  const POS = L(0xc);                          // [ebp-0xc]: character position
  const J = L(8);                              // [ebp-8]: fill counter
  const KEY = L(4);                            // [ebp-4]: byte, getch result (uninitialized at first test)

  W32(POS, 0);                                                            // 0x109a7
  F.sub_10767();                                                     // 0x109ae
  // 0x109b3..0x109c6: for (i = 0; i < 9; i++) (jge: signed); 0x109bc mov eax,[ebp-0x10] is a dead load
  for (W32(I, 0); (R32(I) | 0) < 9; W32(I, R32(I) + 1)) {
    // 0x109cc..0x109dc: cmp [0x60a68], [i*0x18 + 0x60a70]; jle 0x10b6f (next i)
    if ((R32(0x60a68) | 0) <= (R32((Math.imul(R32(I), 0x18) + 0x60a70) | 0) | 0)) continue;

    await F.Time_Delay_20404(1);                                          // 0x109e2
    W32((Math.imul(R32(I), 0x18) + 0x60a70) | 0, R32(0x60a68));            // 0x109ec..0x109f6
    W32((Math.imul(R32(I), 0x18) + 0x60a74) | 0, R32(0x30bec));            // 0x109fc..0x10a06
    F.Print_String_DB_221aa(0x55, 0x50, 0xfa, 0x30033 /* " !!!New Top Score!!! " */, 0);  // 0x10a0c..0x10a22
    F.Print_String_DB_221aa(5, 0x5a, 0xfb,
      0x30049 /* "Please type your name then press enter" */, 0);                             // 0x10a27..0x10a3d
    F.Show_Double_Buffer_21531(R32(0x64e7c) /* double_buffer, LIBRARY.md */, 0);        // 0x10a42..0x10a49
    await F.Time_Delay_20404(1);                                          // 0x10a4e
    F.Keyboard_Remove_Driver_22c58();                               // 0x10a58
    // 0x10a5d..0x10a80: for (j = 0; j < 15; j++) byte [i*0x18 + j + 0x60a78] = 0x20 (jge: signed);
    // 0x10a66 mov eax,[ebp-8] is a dead load
    for (W32(J, 0); (R32(J) | 0) < 0xf; W32(J, R32(J) + 1)) {
      W8((Math.imul(R32(I), 0x18) + R32(J) + 0x60a78) | 0, 0x20);
    }

    // 0x10a82..0x10a8c: loop while pos < 15 (signed) and key byte != 0x0d
    while ((R32(POS) | 0) < 0xf && R8(KEY) !== 0x0d) {
      // 0x10a93..0x10ab0: while (kbhit() == 0) { Time_Delay(1); sub_14fba(); sub_10050(); }
      while ((F.kbhit_2328d()) === 0) {
        await F.Time_Delay_20404(1);
        F.sub_14fba();
        F.sub_10050();
      }
      W8(KEY, (await F.getch_232a4()) & 0xff);                            // 0x10ab2..0x10ab7 mov [ebp-4], al
      if (R8(KEY) === 0x0d) break;                                         // 0x10aba..0x10ac0 jmp 0x10b55

      if (R8(KEY) === 0x08 && (R32(POS) | 0) >= 1) {                       // 0x10ac5..0x10acf (jge: signed)
        W8((Math.imul(R32(I), 0x18) + R32(POS) + 0x60a77) | 0, 0x20);     // 0x10ad3..0x10ada
        W32(POS, R32(POS) - 2);                                            // 0x10ae1 add [ebp-0xc], -2
      } else if (R8(KEY) !== 0x08) {                                       // 0x10ae7..0x10aeb
        W8((Math.imul(R32(I), 0x18) + R32(POS) + 0x60a78) | 0, R8(KEY));  // 0x10aed..0x10af7
        F.dws_DPlay_1eff8(0x61160);                                  // 0x10afd..0x10b08 (cdecl, add esp,4)
      }
      F.Show_Double_Buffer_21531(R32(0x64e7c), 0);                   // 0x10b0b..0x10b12
      // 0x10b17..0x10b36: push 0; ecx = i*0x18 + 0x60a70 + 8; ebx = 0xfc; edx = 0x64; eax = 0x6c
      F.Print_String_202cd(0x6c, 0x64, 0xfc, (Math.imul(R32(I), 0x18) + 0x60a70 + 8) | 0, 0);
      W32(POS, R32(POS) + 1);                                              // 0x10b3b..0x10b3e (eax load is dead)
      await F.Time_Delay_20404(1);                                         // 0x10b41
      F.sub_14fba();                                                 // 0x10b4b
    }
    // 0x10b55
    F.Keyboard_Install_Driver_22bd7();                               // 0x10b55
    F.sub_10676();                                                   // 0x10b5a
    F.dws_DPlay_1eff8(0x611c0);                                      // 0x10b5f..0x10b6a (cdecl, add esp,4)
    break;                                                                 // 0x10b6d jmp 0x10b74
  }
  stackFree(0x10);                                                         // 0x10b74 epilogue
});
