// 0x22b04  void Keyboard_Driver(void)   [INT 9 interrupt service routine; no args; ends in IRETD, no return value]
// Installed as the PM INT 9 vector by Keyboard_Install_Driver (0x22bd7, _dos_setvect(9, CS:0x22b04)) and
// invoked by the platform (platform/kbd.js, via callPtr(0x22b04)) once per IRQ1.
// Reads the scan code byte from port 0x60 via inp (0x23da3) into raw_key 0x64f00 (dword), does the
// port 0x61 acknowledge (inp(0x61); outp(0x61, v|0x82); outp(0x61, (v|0x82)&0x7f)), sends EOI outp(0x20,0x20),
// then: raw_key < 0x80 (signed) -> make: if keyboard_state[raw_key] (0x64f04, int32) == 0, keys_active
// 0x65104 += 1 and keyboard_state[raw_key] = 1; else -> break: if dword [raw_key*4 + 0x64d04]
// (= keyboard_state[raw_key - 0x80]) == 1, keys_active -= 1 and that entry = 0.
// (keyboard_state / raw_key / keys_active names: LIBRARY.md, re/HARDWARE.md §3.)
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';

register(0x22b04, 'Keyboard_Driver_22b04', function Keyboard_Driver() {
  let v;       // [ebp-4] (byte; address not taken)
  // 22b04..22b09: pushad; push ds/es/fs/gs — register preservation for the interrupted code; no JS
  //   counterpart (JS has no interrupted register state). Restored at 22bcd..22bd5 (pop gs/fs/es/ds; popad).
  // 22b0b..22b13: frame (mov ebp,esp; sub esp,4); cld — direction flag, no string instruction follows here.
  // 22b14: call 0x23a74 omitted — its whole body is `mov ds, word ptr cs:[0x23a7d]; ret` (0x23a74..0x23a7c):
  //   reloads DS with the program's data selector stored in the code segment. Segment registers are not
  //   modelled (flat memory), so it has no effect on emulated state.
  // 22b19: call 0x24cc9 omitted — its whole body is `sti; ret` (0x24cc9..0x24cca): re-enables CPU
  //   interrupts inside the ISR. The platform delivers IRQs synchronously (no nesting), so it has no effect
  //   on emulated state.
  // 22b1e..22b28: raw_key = inp(0x60)   (dword store of EAX)
  W32(0x64f00, F.inp_23da3(0x60));
  // 22b2d..22b39: v = (byte) (inp(0x61) | 0x82)   (or al, 0x82; mov [ebp-4], al)
  v = (F.inp_23da3(0x61) | 0x82) & 0xff;
  // 22b3c..22b46: outp(0x61, v)   (xor edx,edx; mov dl,[ebp-4] -> zero-extended)
  F.outp_23d99(0x61, v);
  // 22b4b..22b59: outp(0x61, v & 0x7f)   (and al,0x7f; xor edx,edx; mov dl,al)
  F.outp_23d99(0x61, v & 0x7f);
  // 22b5e..22b68: outp(0x20, 0x20)   (non-specific EOI to the master PIC)
  F.outp_23d99(0x20, 0x20);
  // 22b6d/22b77: cmp dword [0x64f00], 0x80; jge (signed)
  if (R32(0x64f00) < 0x80) {
    // 22b79..22b88: cmp dword [raw_key*4 + 0x64f04], 0; jne 22ba2
    if (R32(((R32(0x64f00) << 2) + 0x64f04) >>> 0) === 0) {
      // 22b8a: inc dword [0x65104]
      W32(0x65104, (R32(0x65104) + 1) | 0);
      // 22b90..22b98: mov dword [raw_key*4 + 0x64f04], 1
      W32(((R32(0x64f00) << 2) + 0x64f04) >>> 0, 1);
    }
    // 22ba2: jmp 22bcd
  } else {
    // 22ba4..22bb3: cmp dword [raw_key*4 + 0x64d04], 1; jne 22bcd   (0x64d04 = 0x64f04 - 0x80*4)
    if (R32(((R32(0x64f00) << 2) + 0x64d04) >>> 0) === 1) {
      // 22bb5: dec dword [0x65104]
      W32(0x65104, (R32(0x65104) - 1) | 0);
      // 22bbb..22bc3: mov dword [raw_key*4 + 0x64d04], 0
      W32(((R32(0x64f00) << 2) + 0x64d04) >>> 0, 0);
    }
  }
  // 22bcd..22bd5: mov esp,ebp; pop gs/fs/es/ds; popad — see above.
  // 22bd6: iretd — returns from the interrupt (pops EIP, CS, EFLAGS); in JS a plain return to the platform.
});
