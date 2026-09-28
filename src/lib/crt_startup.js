// Watcom cstart (entry 0x237a8) around main: cstart's own stores and the command line, the XI initializer
// table (all 16 entries: reproduced or documented as skipped, runInitializers), 0x24f3b before the call to
// main at 0x24f89, and exit() 0x28bdc after it. Implemented to the behaviour of THIS binary (addresses
// cited); not registered in F (no ported code calls these; the boot code, machine.js, does).
//
// How the original reaches main (disassembly, re/disasm.py):
//   0x23a26 mov eax,0xff; call 0x24fa4        run the XI initializer table 0x31b9a..0x31bfa (6-byte
//                                              entries {type, priority, fn}) up to priority 0xff, lowest
//                                              priority first (runInitializers below).
//   0x23a32 call 0x24f3b                      0x24f3b: alloca of [0x31124] bytes if the stack allows
//                                              (0x28b77), [0x31128] = that address + [0x31124];
//                                              0x28b80 (extender set-up: [0x31794]=0x8000, 0x2df55 ([0x31828]=1) +
//                                              DPMI 0600h lock of 0x23a74..0x23a7f); then
//   0x24f7e mov edx,[0x65218]                 EDX = argv
//   0x24f84 mov eax,[0x65214]                 EAX = argc
//   0x24f89 call 0x1aa02                      main(argc, argv)
//   0x24f8e call 0x28bdc                      exit(EAX)  (main's return value, 0 from 0x1e0be)
// main stores EAX/EDX to [ebp-0x14]/[ebp-0x10] and never reads them (re/agents/MAIN_PLAN.md §1.1), so
// argc/argv have no effect on the game; they are still built here, byte for byte, because cstart leaves
// them in the memory image.
import { F } from '../runtime/registry.js';
import { u8, R8, R16, R32, R32u, W8, W16, W32 } from '../runtime/mem.js';
import { int86 } from '../runtime/io.js';
import { SEL_DATA, SEL_PSP, SEL_ENV } from '../platform/dpmi.js';
import { stackAlloc, stackFree } from '../runtime/stack.js';
import { crtInit, crtExit } from './crt.js';

const CMDLINE = 0x657d0; // 0x2395f mov edx,0x657d0; add edx,0xf; and dl,0xf0 -> 0x657d0 (already aligned)

// ---------------------------------------------------------------- cstart 0x23820..0x23a20
// Entry state (PMODE/W, pmodewe.asm startup + v1.31 descriptor order, platform/dpmi.js): ESP = 0x667d0
// (PMW1 stack object 2 offset 0x367D0), DS = SS = GS = SEL_DATA, ES = PSP selector SEL_PSP; PSP[2Ch] holds the
// environment selector SEL_ENV (PMODE/W vxr_init).
//   0x23820 and esp,-4 (no change); 0x23824..0x2382c [0x31120] = [0x3110c] = ESP
//   0x23832..0x23836 word [0x31118] = 0x24
//   0x23841..0x2384c INT 21h AH=30h (passed to DOS by PMODE/W): [0x31143] = AL (major), [0x31144] = AH (minor)
//   0x2385b..0x238a6 EAX >> 16 is neither 'DX' (4458h) nor 'CB' (4342h): DOS leaves the high word 0
//   0x238dc..0x238e8 INT 21h AX=FF00h DX=78h: PMODE/W answers AL=FFh (DOS/4G-compatible path)
//   0x238ea..0x238f3 GS != 0 -> word [0x310fc] = GS
//   0x238f9..0x2390b DPMI 0006h BX=DS: AL = 1, AH = 1 only if the DS base is not 0
//   0x2390d word [0x31118] = ES (PSP selector); 0x23914 CX = word ES:[2Ch] (environment selector)
//   0x23935..0x2393a [0x3113a] = AL, [0x3113b] = AH
//   0x23940..0x23942 ES = BX (= DS, loaded for the 0006h call); word ES:[0x23a7d] = DS — a store into the
//             code object (the saved DS of the CRT's interrupt handlers), which the port's memory does not
//             hold (mem.js: data object only) — not reproduced
//   0x2394a [0x3113d] = ESI = 0 (0x23854), 0x23950 word [0x31141] = CX
// Command line (DOS/4G path, EDI = 0x81 from 0x23856, ES = PSP):
//   0x2396b sub ecx,ecx (ZF=1); 0x2396d cl = PSP[0x80] (tail length); 0x23974 `repe scasb` (AL=0x20)
//   skips leading blanks of PSP[0x81..]; if a non-blank was found (ZF=0) `inc ecx; rep movsb` copies it and
//   the rest of the `len` bytes to 0x657d0 (0x23976..0x23988; the CR after the tail is not copied); then two
//   NUL bytes are stored (0x2398c, 0x2398d) and EDI is decremented (0x2398f): the program name starts at
//   the second NUL.
//   0x23992..0x239ba: scan the environment (DS = [0x31141], ESI = [0x3113d]) to its double NUL; EBP counts
//   the strings that start with "no87=" (case-insensitive: or eax,20202020h; cmp eax,'no87'; [esi+4]=='=').
//   0x239bc..0x239c3: skip the NUL and the string-count word; copy the program path that DOS stores after
//   the environment, NUL included, to the address pushed at 0x23990.
//   0x239c5 pop ds; 0x239c6 pop esi (= program name); one dword (ESI pushed at 0x23957) is left on the stack.
//   0x239c7..0x239d6 word [0x31138] = BP, [0x3111c] = EDI (one past the copied NUL: the lowest address
//   the stack may reach, 0x28b77), [0x31108] = ESP = 0x667cc
//   0x239dc..0x23a0e BSS clear: ECX = 0x657d0 - 0x31ee0; with [0x3113a] == 1 at most 0x1000 bytes
//   (0x239ea..0x239fb): 0x31ee0..0x32ee0 are zeroed (rep stosd / rep stosb)
//   0x23a10..0x23a1b [0x31110] = (0x657d0 + 0xf) & ~0xf = 0x657d0 (command line), 0x23a20 [0x31114] = name
// The PSP tail, the environment and the DOS version are not in the port's memory; they are passed in:
//   tail        = the bytes DOS put in PSP[0x81..0x81+len) (without the CR)
//   env         = the environment strings, in order
//   programPath = the path DOS appended to the environment for this program
//   dosVersion  = [major, minor] from INT 21h AH=30h
export const CSTART_ESP = 0x667d0;
export function cstart({ tail, env, programPath, dosVersion }) {
  W32(0x31120, CSTART_ESP);                         // 0x23826
  W32(0x3110c, CSTART_ESP);                         // 0x2382c
  W16(0x31118, 0x24);                               // 0x23836
  W8(0x31143, dosVersion[0]);                       // 0x23847
  W8(0x31144, dosVersion[1]);                       // 0x2384c
  const r = int86(0x21, { ax: 0xff00, dx: 0x78 });  // 0x238dc..0x238e4
  let al, ah, cx;
  if ((r.eax & 0xff) !== 0) {                       // 0x238e6 cmp al,0; je 0x2391e (plain-DOS path: not taken)
    if ((r.gs & 0xffff) !== 0) W16(0x310fc, r.gs);  // 0x238ea..0x238f3
    const b = int86(0x31, { ax: 6, bx: SEL_DATA }); // 0x238f9..0x23900
    al = 1; ah = 0;                                 // 0x23902, 0x23904
    if (((b.dx | b.cx) & 0xffff) !== 0) ah = 1;     // 0x23906..0x2390b
    W16(0x31118, SEL_PSP);                          // 0x2390d mov [0x31118], es
    cx = SEL_ENV;                                   // 0x23914 mov cx, es:[0x2c]
  } else {
    throw new Error('cstart: INT 21h AX=FF00h not answered (plain DOS path 0x2391e is not modelled)');
  }
  W8(0x3113a, al);                                  // 0x23935
  W8(0x3113b, ah);                                  // 0x2393a
  W32(0x3113d, 0);                                  // 0x2394a (ESI = 0 from 0x23854)
  W16(0x31141, cx);                                 // 0x23950

  // repe scasb over ECX = len bytes, AL = ' '
  let i = 0;
  while (i < tail.length && tail.charCodeAt(i) === 0x20) i++;
  let edi = CMDLINE;
  if (i < tail.length) {           // 0x23985 je not taken: ZF=0 -> a non-blank byte was found
    // lea esi,[edi-1] points at that byte; inc ecx; rep movsb copies it and the rest of the tail
    for (let k = i; k < tail.length; k++) u8[edi++] = tail.charCodeAt(k) & 0xff;
  }
  W8(edi++, 0);                    // 0x2398c stosb
  W8(edi++, 0);                    // 0x2398d stosb
  edi--;                           // 0x2398f dec edi
  const name = edi;
  let bp = 0;                      // 0x2399a sub ebp,ebp
  for (const e of env) {           // 0x2399c..0x239ba
    // mov eax,[esi]; or eax,20202020h; cmp eax,'no87'; cmp byte [esi+4],'='. A string shorter than 4 has its
    // NUL among the 4 bytes (NUL|20h = 20h matches none of them), so the dword never spans two strings.
    if (e.length >= 5 && [0x6e, 0x6f, 0x38, 0x37].every((t, k) => (e.charCodeAt(k) | 0x20) === t) &&
        e.charCodeAt(4) === 0x3d) bp++;
  }
  for (let k = 0; k < programPath.length; k++) u8[edi++] = programPath.charCodeAt(k) & 0xff;
  W8(edi++, 0);                    // the copy loop 0x239bf..0x239c3 copies the NUL too
  W16(0x31138, bp);                // 0x239c9
  W32(0x3111c, edi);               // 0x239d0
  W32(0x31108, CSTART_ESP - 4);    // 0x239d6 (ESP with the dword pushed at 0x23957 still on the stack)
  let n = 0x657d0 - 0x31ee0;       // 0x239dc..0x239e8
  if (R8(0x3113a) === 1 && n > 0x1000) n = 0x1000; // 0x239ea..0x239fb
  u8.fill(0, 0x31ee0, 0x31ee0 + n); // 0x23a00..0x23a0e
  W32(0x31110, CMDLINE);           // 0x23a10..0x23a1b
  W32(0x31114, name);              // 0x23a20
}
// ---------------------------------------------------------------- 0x25fab: split the command line
// eax = string, edx = argv output (0 = count only), ebx = where to store the end pointer.
// ecx = [0x6529c] (0x25fb2), a mode flag stored back unchanged at 0x2609a. Returns the argument count.
function splitArgs(p, argvOut, endSlot) {
  const ecx = R32(0x6529c);
  let edi = 0;
  let dl, start, ebx, dh;
  outer: for (;;) {
    for (;;) {                                               // 0x25fbf
      dl = R8(p);
      if (dl === 0x20 || dl === 0x09) { p++; continue; }     // 0x25fc1..0x25fcc
      break;
    }
    if (dl === 0) break outer;                               // 0x25fce -> 0x26093
    dl = 0;                                                  // 0x25fd8
    if (R8(p) === 0x22) { dl = 1; p++; }                     // 0x25fda..0x25fe1
    start = p;                                               // 0x25fe2 [esp+4]
    ebx = p;                                                 // 0x25fe6
    for (;;) {                                               // 0x25fe8
      if (R8(p) === 0x22) {
        if (ecx === 0) {                                     // 0x25fed
          p++;                                               // 0x25ff1
          dl = dl === 0 ? 2 : 0;                             // 0x25ff2..0x25ffe
          continue;
        }
        if (dl === 1) break;                                 // 0x26000 -> 0x26067
      }
      dh = R8(p);                                            // 0x26009
      if ((dh === 0x20 || dh === 0x09) && dl === 0) break;   // 0x2600b..0x26017
      dh = R8(p);                                            // 0x2601d
      if (dh === 0) break;                                   // 0x2601f
      if (dh === 0x5c) {                                     // 0x26023
        if (ecx === 0) {                                     // 0x26028
          if (R8(p + 1) === 0x22) {                          // 0x2602c
            dh = R8(p - 1);                                  // 0x26032
            p++;                                             // 0x26035
            if (dh === 0x5c) continue;                       // 0x26036..0x26039 -> 0x25fe8
          }
          // -> 0x26058
        } else if (dl === 1) {                               // 0x2603d
          dh = R8(p + 1);                                    // 0x26042
          if (dh === 0x22 || dh === 0x5c) p++;               // 0x26045..0x2604f -> 0x26057
        } else if (R8(p + 1) === 0x22) {                     // 0x26051
          p++;                                               // 0x26057
        }
      }
      if (argvOut !== 0) { u8[ebx++] = R8(p); p++; }         // 0x26058..0x26062
      else p++;                                              // 0x26064
    }
    // 0x26067
    if (argvOut !== 0) {
      W32(argvOut + edi * 4, start);                         // 0x2606b..0x26071
      dl = R8(p);                                            // 0x26074
      edi++;                                                 // 0x26076
      if (dl === 0) { W8(ebx, dl); break outer; }            // 0x26077..0x2607d
      p++;                                                   // 0x2607f
      W8(ebx, 0);                                            // 0x26080
      continue outer;                                        // 0x26083 -> 0x25fbf
    }
    const bl = R8(p);                                        // 0x26088
    edi++;                                                   // 0x2608a
    if (bl === 0) break outer;                               // 0x2608b
    p++;                                                     // -> 0x25fcb inc eax; jmp 0x25fbf
  }
  W32(endSlot, p);                                           // 0x26093..0x26096
  W32(0x6529c, ecx);                                         // 0x2609a
  return edi;
}

// ---------------------------------------------------------------- 0x25ec9 __Init_Argv (XI priority 10)
// The frame (sub esp,0xc at 0x25ecf) is emulated with stackAlloc: [esp] end-pointer slot (its address is
// passed to 0x25fab as EBX), [esp+4] argc, [esp+8] argc*4 (the last two are plain locals here).
export function initArgv() {
  const frame = stackAlloc(0xc);
  const slot = frame;
  const cmd = R32u(0x31110);
  const argc = (splitArgs(cmd, 0, slot) + 1) | 0;                 // 0x25ed4..0x25ee7
  const len0 = (R32u(slot) - R32u(0x31110)) | 0;                   // 0x25eeb..0x25eee
  const ecx = len0 + 1;                                            // 0x25ef0
  const edx = (len0 + 4) & ~3;                                     // 0x25ef3..0x25ef8
  const argvBytes = argc << 2;                                     // 0x25efe..0x25f01 [esp+8]
  const size = (argvBytes + 4 + edx + 3) & ~3;                     // 0x25f05..0x25f0d
  const block = F.malloc_23dab(size);                              // 0x25f0f
  let ret;
  if (block === 0) {                                               // 0x25f18 -> 0x25f6f
    W32(0x65144, 0);
    ret = 0;
  } else {
    const argv = block + edx;                                      // 0x25f20
    W32(0x65144, argv);                                            // 0x25f24
    u8.copyWithin(block, cmd, cmd + ecx);                          // 0x25f2f..0x25f3b rep movsd/movsb
    W32(argv, R32(0x31114));                                       // 0x25f3f..0x25f4a argv[0]
    splitArgs(block, argv + 4, slot);                              // 0x25f4c..0x25f57
    W32(R32u(0x65144) + argvBytes, 0);                             // 0x25f5c..0x25f63 argv[argc] = NULL
    ret = argc;                                                    // 0x25f69
  }
  stackFree(0xc);
  W32(0x65140, ret);                                               // 0x25f74
  W32(0x65214, R32(0x65140));                                      // 0x25f79..0x25f7e
  W32(0x65218, R32(0x65144));                                      // 0x25f83..0x25f88
  W32(0x65148, R32(0x65214));                                      // 0x25f8d..0x25f92
  W32(0x6514c, R32(0x65218));                                      // 0x25f97..0x25f9c
}

// ---------------------------------------------------------------- 0x2ce81 (XI priority 10)
// [0x3113a] = 1 (not 3; not 2..8; not 0) and [0x3113b] = 0 -> 0x2ced0..0x2ced7 je 0x2cee2: word [0x652b0] = DS
// (0x2cee2 mov ax,ds; 0x2ce9c). The DPMI 0000h allocation at 0x2cefc is on the [0x3113b] == 1 path only (a
// data segment with a non-zero base), so it is not executed.
function init_2ce81() {
  const t = R8(0x3113a), b = R8(0x3113b);
  if (t === 3 && R8(0x3113c) !== 0) { W16(0x652b0, R16(0x310fe)); return; }        // 0x2ce84..0x2ce9c
  if ((t >= 2 && t <= 8) || t === 0) { W16(0x652b0, (SEL_DATA & 3) | 0x34); return; } // 0x2cea6..0x2cec9
  if ((t === 1 && b === 0) || t === 9) { W16(0x652b0, SEL_DATA); return; }         // 0x2cecb..0x2cee5
  throw new Error('0x2ce81: extender type ' + t + '/' + b + ' path not modelled');
}

// ---------------------------------------------------------------- 0x2de33 _setmbcp(0) (XI priority 32)
// 0x2de33 xor eax,eax; jmp 0x2e9e3. EAX = 0 -> 0x2ea94: call 0x2eb2a (DBCS lead-byte table), then
// 0x2eaae..0x2eb0d: memset(0x652b8, 0, 0x101); [0x652b4] = 0, = 1 if the table's first word is not 0;
// for each range word (lo, hi) until a 0 word: byte [0x652b8 + c] = 1 for c = lo+1 .. hi+1;
// 0x2eb0f..0x2eb19: [0x3182c] = 0x2ec2c() & 0xffff (code page). Returns 0 (not read: XI entries are void).
// The DOS calls go through DPMI 0300h (platform/dpmi.js; assumed DOS: see there).
function dbcsTable_2eb2a() {
  // [0x3113a] = 1 -> 0x2ebca (the Phar Lap path 0x2eb49.. needs 2..8)
  if (R8(0x3113a) !== 1) throw new Error('0x2eb2a: extender type path not modelled');
  const sp = stackAlloc(0x70);                                 // 0x2eb2e sub esp,0x70
  F.memset_23d81(sp, 0, 0x32);                                 // 0x2ebd3..0x2ebde
  W32(sp + 0x1c, 0x6300);                                      // 0x2ebe7..0x2ebee real-mode EAX
  // 0x2ebe3 xor ecx,ecx; 0x2ebe5 xor bh,bh; 0x2ebec mov bl,0x21; 0x2ebf2..0x2ebfb es = ds; ax = 0x300
  int86(0x31, { ax: 0x300, bl: 0x21, bh: 0, ecx: 0, edx: SEL_DATA, es: SEL_DATA, edi: sp });
  let eax = 0, dx = 0;
  if ((R8(sp + 0x20) & 1) === 0) {                             // 0x2ec00 test byte [esp+0x20],1; jne
    eax = ((R16(sp + 0x24) << 4) + R32u(sp + 4)) >>> 0;        // 0x2ec07..0x2ec1c DS*16 + ESI
    dx = R16(0x652b0);                                         // 0x2ec15
  }
  stackFree(0x70);
  return { eax, dx };
}
function codePage_2ec2c() {
  const sp = stackAlloc(0x78);                                 // 0x2ec33 sub esp,0x78
  const r = int86(0x31, { ax: 0x100, ebx: 1 });                // 0x2ec36..0x2ec3f
  let ax = r.ax, dx = r.dx;
  if (r.cflag) dx = 0;                                         // 0x2ec41 jae; 0x2ec43 sub dx,dx
  [ax, dx] = [dx, ax];                                         // 0x2ec46 xchg dx,ax
  let eax = (((r.eax & 0xffff0000) | ax) << 16 | dx) >>> 0;    // 0x2ec48 shl eax,16; 0x2ec4b mov ax,dx
  W32(sp + 0x74, eax);                                         // 0x2ec50
  W32(sp + 0x70, eax >> 16);                                   // 0x2ec54..0x2ec57 sar eax,16
  let esi = 0;                                                 // 0x2ec61
  if (R8(0x3113a) !== 1) throw new Error('0x2ec2c: extender type path not modelled'); // 0x2ec5b..0x2ed09
  F.memset_23d81(sp, 0, 0x32);                                 // 0x2ed0b..0x2ed1b (ECX = 7 is preserved)
  W32(sp + 0x18, 7);                                           // 0x2ed30 CX = buffer size
  W32(sp + 0x00, 0);                                           // 0x2ed34 EDI = 0
  W32(sp + 0x1c, 0x6501);                                      // 0x2ed37 EAX
  W32(sp + 0x10, 0xffff);                                      // 0x2ed3b EBX = code page: current
  W32(sp + 0x14, 0xffff);                                      // 0x2ed3f EDX = country: current
  W16(sp + 0x22, R32u(sp + 0x74));                             // 0x2ed2c, 0x2ed4b ES = segment
  // 0x2ed43 xor ecx,ecx; 0x2ed45 xor bh,bh; 0x2ed47 mov edx,ds; 0x2ed49 mov bl,0x21; es = ds
  int86(0x31, { ax: 0x300, bl: 0x21, bh: 0, ecx: 0, edx: SEL_DATA, es: SEL_DATA, edi: sp });
  if ((R8(sp + 0x20) & 1) === 0) {                             // 0x2ed5c
    const lin = ((R16(sp + 0x74) << 4) + 5) >>> 0;             // 0x2ed63..0x2ed73 (es = [0x652b0], base 0)
    esi = ((lin & 0xffff0000) | R16(lin)) >>> 0;               // 0x2ed76 mov si, es:[esi]
  }
  // 0x2ed7a..0x2ed82: EBX = [esp+0x70]; AX = 0101h; INT 31h. ORIGINAL BUG: DPMI 0101h takes the selector in
  // DX, but DX still holds DS (0x2ed47 mov edx,ds; 0300h preserves it): PMODE/W frees the DOS block at
  // DS base >> 4 = segment 0, which DOS rejects, and does not free the descriptor (int31failax before 0001h).
  // So this 1-paragraph DOS block and its selector stay allocated for the whole run (CF not tested: sbb).
  int86(0x31, { ax: 0x101, ebx: R32u(sp + 0x70), edx: SEL_DATA });
  stackFree(0x78);
  return esi;                                                  // 0x2ed86 mov eax,esi
}
function setmbcp_2de33() {
  const t = dbcsTable_2eb2a();                                 // 0x2ea94
  let ecx = t.eax, dx = t.dx;
  if (ecx === 0 && (dx & 0xffff) === 0) return;                // 0x2eaa1..0x2eaa8 -> 0x2eb1e
  F.memset_23d81(0x652b8, 0, 0x101);                           // 0x2eaae..0x2eabc
  W32(0x652b4, 0);                                             // 0x2eac1
  // FS = ES = DX = [0x652b0] (DS, base 0): table reads are plain linear reads
  if (R16(ecx) !== 0) W32(0x652b4, 1);                         // 0x2eac9..0x2ead0
  for (let si = R16(ecx); si !== 0; ecx += 2, si = R16(ecx)) { // 0x2eb06..0x2eb0d, 0x2eb03
    const hi = (si >> 8) & 0xff;                               // 0x2eae0..0x2eaeb
    for (let c = R8(ecx); c <= hi;) { c++; W8(0x652b8 + c, 1); } // 0x2eae8..0x2eb01
  }
  W32(0x3182c, codePage_2ec2c() & 0xffff);                     // 0x2eb0f..0x2eb19
}

// ---------------------------------------------------------------- 0x2e6c4 environ (XI priority 32)
// Builds the environment table from FS:[ESI] = [0x31141]:[0x3113d] (the environment strings), unless
// [0x652a8] is already set:
//   0x2e6df..0x2e705 count the strings (ECX) up to the empty one; EAX - EDI = their total size, NULs
//             included (at least 1, 0x2e709..0x2e70b)
//   0x2e710 malloc(size) -> strings copy (EDX = EBX); NULL -> return
//   0x2e721..0x2e72b malloc(count*4 + 4 + count) -> [0x652a8] (pointer table + one flag byte per string);
//             NULL -> free the first block (0x2e788..0x2e78a) and return
//   0x2e739..0x2e761 copy every string (NUL included) into the first block, table[i] = its address
//   0x2e763..0x2e769 table[count] = 0
//   0x2e770..0x2e781 [0x652a4] = table + (count+1)*4; memset([0x652a4], 0, count)
// env = the environment strings (as passed to cstart).
function environ_2e6c4(env) {
  if (R32(0x652a8) !== 0) return;                              // 0x2e6cc
  const count = env.length;
  let size = 0;
  for (const e of env) size += e.length + 1;
  if (size === 0) size = 1;                                    // 0x2e709..0x2e70b
  const buf = F.malloc_23dab(size);                            // 0x2e710
  if (buf === 0) return;                                       // 0x2e719..0x2e71b
  const tbl = F.malloc_23dab(count * 4 + 4 + count);           // 0x2e721..0x2e72b
  if (tbl === 0) { F.free_23ff0(buf); return; }                // 0x2e730..0x2e732, 0x2e788..0x2e78a
  W32(0x652a8, tbl);                                           // 0x2e734
  let ebx = buf, ecx = 0;
  for (const e of env) {                                       // 0x2e743..0x2e761
    W32(R32u(0x652a8) + ecx, ebx);                             // 0x2e749..0x2e74f
    for (let k = 0; k < e.length; k++) W8(ebx++, e.charCodeAt(k) & 0xff); // 0x2e752..0x2e75b
    W8(ebx++, 0);
    ecx += 4;
  }
  W32(R32u(0x652a8) + ecx, 0);                                 // 0x2e763..0x2e769
  ecx += 4;                                                    // 0x2e770
  const flags = (R32u(0x652a8) + ecx) >>> 0;                   // 0x2e773
  W32(0x652a4, flags);                                         // 0x2e777
  F.memset_23d81(flags, 0, count);                             // 0x2e77d..0x2e781
}

// ---------------------------------------------------------------- the XI (initializer) table
// 0x23a26..0x23a2b: 0x24fa4(0xff) runs the entries of 0x31b9a..0x31bfa (6 bytes: type, priority, fn) with
// priority <= 0xff: each pass (0x24fb0..0x24fd3) picks the entry with the LOWEST priority whose type is not
// 2 — on equal priority the LATER entry wins (0x24fc8 cmp dl,ch; jb skip: taken when ch <= dl) — calls it
// (0x24fe0 -> 0x24f98) and sets its type byte to 2 (0x24fe5). The table (all type 0 in the image) and the
// resulting order:
//   prio  1  0x31bb2 0x23aa8 -> jmp 0x25be6: fninit; fnstcw; CW high byte = 3 so EBP (the no87 count, 0)
//                    stays 0 and 0x25c16 (emulator hook) is not called; fninit; fldcw [0x31784]; 4x fldz.
//                    x87 register state only — not modelled (the port's FPU rules are in PORTING.md).
//   prio  2  0x31bb8 0x25e85 FPU detection: [0x31104] == 0 -> [0x31105] = 0 (0x25e90); fninit; fnstcw ->
//                    AH = 3 -> 0x25e4a -> 0x2c640 (1/0 vs -(1/0): unequal on a 387 or later -> AL = 3);
//                    [0x31138] == 0 -> [0x31104] = [0x31105] = 3 (0x25ebb/0x25ec1). Assumed: an FPU of the
//                    387 generation or later (486DX/Pentium) is present.
//   prio  3  0x31bdc 0x27c67 [0x31105] >= 3: the Pentium FDIV check (4195835/3145727 through 0x2cf8e,
//                    0x2d351, 0x2d194, 0x2d4ee); only a flawed FDIV sets [0x31584] |= 1 (0x27cd7). Assumed
//                    a correct FPU: no store.
//   prio 10  0x31be8 0x2ce81 (the later of the two priority-10 entries) word [0x652b0] = DS.
//   prio 10  0x31bbe 0x25ec9 __Init_Argv (initArgv above).
//   prio 11  0x31bc4 0x23ab2 byte [0x651e8] |= 2.
//   prio 20  0x31bca 0x24284 cout/cerr/clog: stdiobuf/ostream_withassign constructors on __iob[1]/[2]
//                    (0x241f2(1) = 0x312de...) building objects at 0x65160, 0x65198 and 0x651d0; each object
//                    also gets a destructor record linked into the list [0x3168c] by 0x24221 (jmp 0x26fd0:
//                    [rec] = [0x3168c]; [0x3168c] = rec) — records 0x31174, 0x31184, 0x31194. The list
//                    links ARE reproduced (initializer24284Links); the constructors' stores are not: the game
//                    never uses cout/cerr/clog (it prints with printf on __iob), cout is referenced only as
//                    cin's tie (crt_stdio.js), whose flush has nothing to write.
//   prio 21  0x31ba0 0x222c1 cin: stdiobuf at 0x64e80 on __iob[0], istream at 0x64eb8 (0x24226), tie to
//                    cout and skipws (0x22308). Destructor records 0x310a8, 0x310b8 are linked (reproduced
//                    here); of the constructor stores only three are made, by crtInit (crt_stdio.js initFiles:
//                    cin's vbtable pointer, tie, skipws) — the rest of the stdiobuf/ios state is not modelled.
//   prio 32  0x31bee 0x2de33 _setmbcp(0) (setmbcp_2de33 above).
//   prio 32  0x31be2 0x2e6c4 environ table (environ_2e6c4 above).
//   prio 32  0x31bd6 0x277ee [0x316ec] = 0x277a1(): [0x652b0] != 0 -> counts the digits and '/' among the
//                    8 bytes at F000:FFF5 (the BIOS date "MM/DD/YY"): fewer than 4 -> 1 (NEC PC-98), else 0.
//                    Assumed an IBM-compatible BIOS date: [0x316ec] = 0.
//   prio 32  0x31bd0 0x271ba __InitFiles (crtInit, crt_stdio.js initFiles).
//   prio 32  0x31bac 0x23a7f [0x31588] = 0x2506f, [0x3158c] = 0x2507d, [0x31590] = 0x25229, [0x31594] = 0x25be0.
//   prio 32  0x31ba6 0x25042 [0x316f8] = 0x28c16, [0x316fc] = 0x2506f.
//   prio 32  0x31b9a 0x1e0c8 word [0x30c4c] = SS (SEL_DATA).
//   prio 64  0x31bf4 0x2f7ea [0x316ec] == 0 -> bytes [0x31a90..0x31a94] = 02h, 0Dh, 75h, 20h, A0h (the IRQ13
//                    vector 75h and the PIC ports used by the x87 exception handler 0x2f257).
// Each executed entry's type byte is set to 2.
// env = the environment strings (as passed to cstart).
const XI_BEGIN = 0x31b9a, XI_END = 0x31bfa;
function linkDtor_26fd0(rec) { W32(rec, R32(0x3168c)); W32(0x3168c, rec); }
export function runInitializers(env) {
  const done = (fn) => {
    for (let e = XI_BEGIN; e < XI_END; e += 6) if (R32u(e + 2) === fn) { W8(e, 2); return; } // 0x24fe5
    throw new Error('XI entry for 0x' + fn.toString(16) + ' not found');
  };
  done(0x23aa8);                                               // FPU init: register state only
  if (R8(0x31104) === 0) {                                     // 0x25e85
    W8(0x31105, 0);                                            // 0x25e90
    const fpu = 3;                                             // 0x2c640 on a 387+
    if (R8(0x31138) === 0) { W8(0x31104, fpu); W8(0x31105, fpu); } // 0x25eb2..0x25ec1
  }
  done(0x25e85);
  done(0x27c67);                                               // FDIV check: no store on a correct FPU
  init_2ce81(); done(0x2ce81);
  initArgv(); done(0x25ec9);
  W8(0x651e8, R8(0x651e8) | 2); done(0x23ab2);                 // 0x23ab2
  linkDtor_26fd0(0x31174); linkDtor_26fd0(0x31184); linkDtor_26fd0(0x31194); done(0x24284); // 0x2429c/0x242b7/0x242cb
  linkDtor_26fd0(0x310a8); linkDtor_26fd0(0x310b8); done(0x222c1); // 0x222d6/0x222f1
  setmbcp_2de33(); done(0x2de33);
  environ_2e6c4(env); done(0x2e6c4);
  W32(0x316ec, 0); done(0x277ee);                              // 0x277f3 (IBM BIOS date assumed)
  crtInit(); done(0x271ba);                                    // + the three cin fields of 0x222c1
  W32(0x31588, 0x2506f); W32(0x3158c, 0x2507d); W32(0x31590, 0x25229); W32(0x31594, 0x25be0); done(0x23a7f);
  W32(0x316f8, 0x28c16); W32(0x316fc, 0x2506f); done(0x25042);
  W16(0x30c4c, SEL_DATA); done(0x1e0c8);                       // 0x1e0c8 mov [0x30c4c], ss
  if (R32(0x316ec) === 0) {                                    // 0x2f7ed
    W8(0x31a90, 0x02); W8(0x31a92, 0x75); W8(0x31a94, 0xa0); W8(0x31a91, 0x0d); W8(0x31a93, 0x20); // 0x2f7fc..0x2f817
  }
  done(0x2f7ea);
}

// ---------------------------------------------------------------- 0x24f3b (before main)
//   0x24f3f..0x24f48 EDX = ([0x31124] + 3) & ~3 = 0 ([0x31124] is 0 in the image and nothing writes it)
//   0x24f4b 0x28b77: EAX = ESP - [0x3111c] (> 0) -> 0x24f54..0x24f66: alloca(0): push edx; call 0x1e0e0
//             (`ret 4`); sub esp,0; EAX = ESP = 0x667c0 (cstart's ESP 0x667cc - return address - EDX - EBP)
//   0x24f6c..0x24f74 [0x31128] = EAX + [0x31124]
//   0x24f79 0x28b80: [0x31794] = 0x8000 (0x28b90); [0x3113a] = 1 (not 2..8, 0x28b96..0x28b9e) -> call 0x2df55:
//             0x2df5c [0x31828] == 0 (image and BSS value) -> 0x2df65 [0x3113a] == 1: `je 0x2df79` SKIPS the
//             INT 2Fh AX=1686h test; 0x2df94 DPMI 0400h (get version: AH = major, AL = minor);
//             0x2dfad..0x2dfbb AH + AL > 0 -> 0x2dfbd [0x31828] = 1 (else 0x2dfc9 [0x31828] = -1);
//             returns EAX = [0x31828] (0x2dfd3). 0x2df55 installs no interrupt hooks: the INT 23h /
//             Ctrl-Break / critical-error hook code at 0x2dfe0..0x2e4b0 (the only writers of [0x316f0]) is
//             unreachable (no reference from live code; re/audit/round1/A-coverage/deadcode.txt).
//             0x28ba5 EAX == 1 -> 0x28baa..0x28bd2 DPMI 0600h lock of 0x23a74..0x23a7f: no paging in the port,
//             no effect on program state (the result is discarded by 0x24f79).
//   DPMI 0400h is not issued through int86 (platform/dpmi.js has no 0400h service): every DPMI host reports
//   version >= 0.90 (DPMI 0.9 spec: AH = 0, AL = 5Ah), so AH + AL > 0 and 0x2dfbd is the path taken.
//   [0x31828] has no reader outside 0x2df55 (A-coverage relocation sweep); it is stored for exactness.
export function beforeMain() {
  const edx = (R32(0x31124) + 3) & ~3;
  if (edx !== 0) throw new Error('0x24f3b: [0x31124] != 0 is not modelled');
  const esp = CSTART_ESP - 4 - 12;                             // 0x667cc - call 0x24f3b - push edx - push ebp
  W32(0x31128, (esp + R32(0x31124)) | 0);                      // 0x24f74
  W32(0x31794, 0x8000);                                        // 0x28b90
  const t = R8(0x3113a);                                       // 0x28b8a
  if (t < 2 || t > 8) {                                        // 0x28b96..0x28b9e
    if (R32(0x31828) === 0) {                                  // 0x2df5c
      if (t !== 1) throw new Error('0x2df6c: INT 2Fh AX=1686h path ([0x3113a] != 1) is not modelled');
      W32(0x31828, 1);                                         // 0x2dfbd (DPMI 0400h: AH + AL > 0)
    }
  }
}

// ---------------------------------------------------------------- 0x28bdc exit(status)
//   0x28be0 call [0x316f0]            = 0x28bdb (`ret`), no effect
//   0x28bf0 call 0x24ff0(0x10, 0xff)  YI (fini) table 0x31bfa..0x31c12, highest priority first:
//             0x26fa9 (prio 40): pops the destructor records linked at [0x3168c] by 0x24221 (jmp 0x26fd0)
//                    during the iostream initializers (runInitializers: 0x310b8, 0x310a8, 0x31194, 0x31184,
//                    0x31174, last linked first) and calls each one's destructor [[rec+4]+4] on [[rec+4]+8]:
//                    0x2416d(cin 0x64eb8), 0x24110(stdiobuf 0x64e80), 0x242e0(0x651d0: flush cout),
//                    0x27036(cout 0x65198), 0x24110(stdiobuf 0x65160). Not modelled: those objects are not
//                    modelled (see 0x24284/0x222c1 above) and cout's buffer never holds output (the game
//                    prints with printf on __iob);
//             0x2724c (prio 32): close/flush all streams = crtExit() (crt.js / crt_stdio.js closeAllAtExit)
//   0x28bf7 call 0x28bff              [0x316f0](), [0x316f4]() (both 0x28bdb `ret`), then jmp 0x23a37 ->
//             0x23a5c: 0x24ff0(0, 0xf): 0x2cf65 (prio 10: DPMI 0001h free of selector [0x652b0]) and 0x23aad
//             (prio 1: 0x25d6b, extender/FPU restore) — extender internals, not modelled —
//             then 0x23a6d INT 21h AH=4Ch, AL = status.
// Returns the DOS exit code (AL).
export function exit_28bdc(status) {
  crtExit();
  return status & 0xff;
}
