// 0x1fd9b  int sub_1fd9b(void)   [Watcom, no register or stack args (first instruction is a CALL, no
// argument register is read before being written); plain RET (no stack cleanup); returns EAX]
// Internal STK client helper with two callers: dws_MPlay (call at 0x1fb36, while it already holds the session
// from 0x1e8d1 at 0x1fb0d and the re-entry byte 0x31086) and a wrapper at 0x1fdc6 (call at 0x1fe1e,
// after that wrapper's DS/magic check and 0x31086 increment; it returns this function's EAX). That wrapper is
// unreachable: no call/jump/pointer to 0x1fdc6 exists in the image (audit), so dws_MPlay is the only live caller. Unlike the public dws_/dwt_ wrappers (1ff4f_dwt_Init.js)
// it has NO DS/selector check, magic check or 0x31086 counter: it opens a nested session (0x1e8d1), issues
// STK function 0x14 without an argument block (0x1e309(0x14)), passes the low 16 bits of the driver result
// through the status check 0x1e3c0, and if that is non-zero frees the client-side DOS buffer recorded at
// word 0x30c8b / dword 0x30c8d (0x1e56f, the buffer dws_MPlay allocates for the song via 0x1e597); then
// closes the session (0x1e971) in every path.
// Return value: dws_MPlay reads it (0x1fb3e: cmp eax, 0; je 1fc1f). EAX at RET is the EAX left before the
// final call 0x1e971, because 0x1e971 never modifies EAX (argc_overrides.json 0x1e971 "preserves": eax), and
// 0x1e56f does not modify EAX either (1e56f..1e596: only push edx / pop edx; its callee 0x1e52c saves and
// restores EAX at 0x1e52f / 0x1e56a). So the result is 0 if 0x1e8d1 returned 0, else the 0x1e3c0 result
// (= the 16-bit masked driver result, 1e3c0_sub_1e3c0.js).
// Callee keys: 0x1e8d1 / 0x1e309 / 0x1e3c0 / 0x1e56f / 0x1e971 are not named in re/names.tsv -> sub_<addr>.
import { F, register } from '../runtime/registry.js';

register(0x1fd9b, 'sub_1fd9b', function sub_1fd9b() {
  let eax = F.sub_1e8d1();                       // 1fd9b: call 0x1e8d1
  if (eax !== 0) {                               // 1fda0: cmp eax, 0; je 1fdc0
    eax = F.sub_1e309(0x14);                     // 1fda5..1fda7: push 0x14; call 0x1e309 (callee pops 4)
    eax = eax & 0xffff;                          // 1fdac: and eax, 0xffff
    eax = F.sub_1e3c0(eax);                      // 1fdb1: call 0x1e3c0 (arg in EAX)
    if (eax !== 0) {                             // 1fdb6: cmp eax, 0; je 1fdc0
      F.sub_1e56f();                             // 1fdbb: call 0x1e56f (EAX unchanged, see header)
    }
  }
  F.sub_1e971();                                 // 1fdc0: call 0x1e971 (EAX unchanged, see header)
  return eax;                                    // 1fdc5: ret
});
