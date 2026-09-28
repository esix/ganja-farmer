// 0x1ff4f  void dwt_Init(int rate)   [cdecl, 1 stack arg (full dword passed on); EAX saved/restored, no result]
// DiamondWare STK client stub for STK function 0x17 (dwt_Init, LIBRARY.md): the game passes rate = 2 (0x1aab9).
// Structure (0x1ff52..0x1ffa9, same frame in every dws_/dwt_ wrapper):
//   push eax; push ds; push eax.
//   DS check: word cs:[0x30c61] holds the data selector. If 0 -> store DS there, then the magic check.
//   If it equals DS -> skip both store and magic check (0x1ff99). Otherwise reload DS from it, store it back,
//   then the magic check: dword cs:[0x31088] must equal ds:[0x31088] (data image bytes 69 66 69 66), else
//   error 0x29a via 0x1e3ba and return (without touching the counter).
//   inc byte [0x31086]; if it is not 1 -> error 0x13 (0x1e3ba). Else: 0x1e8d1 (session open); if EAX != 0:
//   0x1e8d1 again (result ignored; keeps the session open while the timer runs), then 0x1e342(rate, 0x17)
//   = STK fn 0x17 with one word argument; then 0x1e971 (session close) always. dec byte [0x31086].
// The driver-call mechanism (vector discovery, session open/close, INT thunks) is documented in the ports of
// the callees: 1e859 (discovery), 1e8d1/1e971 (session), 1e309/1e342/1e37f (driver call), and re/HARDWARE.md §6.
// Callee keys: 0x1e8d1 / 0x1e971 / 0x1e342 / 0x1e3ba are not named in re/names.tsv -> sub_<addr>.
import { F, register } from '../runtime/registry.js';
import { R8, R16, R32, W8, W16 } from '../runtime/mem.js';
import { SEL_DATA, selBase } from '../platform/dpmi.js';

register(0x1ff4f, 'dwt_Init_1ff4f', function dwt_Init(rate) {
  // 1ff4f..1ff54: push ebp; mov ebp, esp; push eax; push ds; push eax (all restored on return)
  // UNCERTAIN: DS at entry is the extender-chosen data selector; ported code always runs with the program's
  // flat data selector, emulated as SEL_DATA (platform/dpmi.js), as Keyboard_Install_Driver does for CS.
  let ds = SEL_DATA;
  check: {
    if (R16(0x30c61) !== 0) {                    // 1ff55: cmp word cs:[0x30c61], 0; je 1ff77
      if (R16(0x30c61) === ds) break check;      // 1ff60..1ff6b: mov ax, ds; cmp cs:[0x30c61], ax; je 1ff99
      ds = R16(0x30c61);                         // 1ff6d: mov ds, cs:[0x30c61]
      // 1ff75: je 1ff99 — flags still from the cmp at 1ff63 (not equal), never taken
    }
    W16(selBase(ds) + 0x30c61, ds);              // 1ff77: mov word [0x30c61], ds   (DS-relative)
    // 1ff7e..1ff8a: mov eax, cs:[0x31088]; cmp eax, ds:[0x31088]; je 1ff99
    if (R32(0x31088) === R32(selBase(ds) + 0x31088)) break check;
    // 1ff8c: pop eax
    F.sub_1e3ba(0x29a);                          // 1ff8d..1ff92: mov eax, 0x29a; call 0x1e3ba
    return;                                      // 1ff97: jmp 1ffd0 (pop ds; pop eax; leave; ret)
  }
  // 1ff99: pop eax; 1ff9a: xor eax, eax
  // UNCERTAIN: when DS was reloaded from 0x30c61 the callees below also run with that DS; the port cannot
  // pass a segment register to them (only reachable if 0x30c61 holds a selector other than SEL_DATA).
  const dsb = selBase(ds);
  W8(dsb + 0x31086, (R8(dsb + 0x31086) + 1) & 0xff);   // 1ff9c: inc byte [0x31086]
  if (R8(dsb + 0x31086) === 1) {                 // 1ffa2: cmp byte [0x31086], 1; jne 1ffd4
    if (F.sub_1e8d1() !== 0) {                   // 1ffab..1ffb3: call 0x1e8d1; cmp eax, 0; je 1ffc5
      // 1ffb5: call 0x1e8d1 again (result not read). This raises the session count 0x31085 to 2, and the
      // single 0x1e971 below only brings it back to 1, so the session (DOS buffer) stays open while the
      // timer runs; dwt_Kill (0x1ffe0: 0x2004a and 0x2004f) calls 0x1e971 twice to close it.
      F.sub_1e8d1();
      // 1ffba..1ffc0: push 0x17; mov eax, [ebp+8]; push eax; call 0x1e342 (callee pops 8; result not read)
      F.sub_1e342(rate, 0x17);
    }
    F.sub_1e971();                               // 1ffc5: call 0x1e971
  } else {
    F.sub_1e3ba(0x13);                           // 1ffd4..1ffd9: mov eax, 0x13; call 0x1e3ba; jmp 1ffca
  }
  W8(dsb + 0x31086, (R8(dsb + 0x31086) - 1) & 0xff);   // 1ffca: dec byte [0x31086]
  // 1ffd0..1ffd3: pop ds; pop eax; leave; ret
});
