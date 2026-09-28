// PMODE/W v1.31 DOS-extender services used by GANJAFRM.EXE, plus the real-mode (conventional)
// memory they expose. See re/HARDWARE.md §4 for the full inventory.
//
// Protected-mode INT 21h functions PMODE/W answers itself:
//   AX=FF00h DOS/4G check (DX=78h) -> AL=FFh, GS  Watcom cstart 0x238e4.
// (Stage 1 also had AH=35h/25h get/set PM interrupt vector for Keyboard_Install/Remove_Driver; since
// stage 2 the keyboard driver is connected directly, platform/kbd.js.)
// INT 31h (DPMI 0.9): 0006h get segment base, 0100h/0101h allocate/free DOS memory, 0300h simulate a
// real-mode interrupt. (Stage 1 also served the DiamondWare STK client stubs: 0002h, 0200h, 0600h/0601h
// and many 0100h/0101h calls; that client is gone since stage 2, lib/stk_client.js.)
// The only caller left is the Watcom CRT's XI initializer 0x2de33 (_setmbcp(0), src/lib/crt_startup.js):
// 0x2ec2c 0100h BX=1, 0300h INT 21h AX=6501h, 0101h (0x2ec3f/0x2ed57/0x2ed82), and 0300h INT
// 21h AX=6300h (0x2ebfb). The CRT's other INT 21h/INT 31h use (file I/O, malloc's DOS memory,
// signal/Ctrl-Break hooks) is implemented by the CRT layer in JS and does not come through here.
//
import { u8 } from '../runtime/mem.js';
import { loadRegs, outRegs, lo16, set16 } from './regs.js';

// ---- descriptors ---------------------------------------------------------------------------------
// PMODE/W without an external DPMI host (raw/XMS/VCPI; ASSUMED — under a DPMI host such as a Windows DOS
// box the host's own allocator would be used) serves INT 31h from its own GDT; there is no LDT, so every
// selector it hands out has TI=0 and RPL=0 (the program runs at PL0).
// Source: PMODE/W v1.33 src/pmodewk.asm (github.com/javiergutierrezchamorro/pmodew; the binary is v1.31).
// Checked against the v1.31 kernel in GANJAFRM.EXE (its MZ stub is LZ-packed; unpacked by running the
// stub's decompressor under unicorn up to the INT 2Fh XMS check; offsets below are in that image, which
// is PMODE_TEXT offset 0):
//   GDT limit = _pm_selectors*8 + 8*5 + 8*SYSSELECTORS - 1          v1.31 0x9a7..0x9b1 (add cx,77h)
//   0000h: searches DOWNWARD from (gdtlimit & ~7) for a descriptor whose byte 6 bit 10h ("used", the AVL
//          bit) is clear, down to 8*SYSSELECTORS = 50h; marks it {base 0, limit 0, access 92h, byte6 10h}
//                                                                   v1.31 0x1556..0x159f (cmp ax,50h)
//   0001h: clears bit 10h of byte 6 (the descriptor's base etc. are kept)       v1.31 0x15a2
//   0002h: compares dword [+2] (base 0..23 + access 92h) of the slots 8*FREESELECTORS = 70h .. gdtfree-8
//          (used or not); a match returns that slot, otherwise the slot at gdtfree (fails if it is used)
//          is set up and gdtfree += 8 — never freed (not called any more)   v1.31 0x15c9..0x1618
//   0006h/0007h: get/set base; "int31testsel" fails (CF=1, registers unchanged) if BX > gdtlimit or
//          the descriptor is not used; the index is BX & 0FFF8h            v1.31 0x1621, 0x1636, 0x1517
//   000Ah: 0000h + copy of the source descriptor with access 92h            v1.31 ..0x16c7
//   0100h: DOS AH=48h, then 000Ah(DS) + 0007h(base = segment*16); if 000Ah fails the block is freed
//          (AH=49h) and CF=1 with the registers unchanged; DOS failure: CF=1, AX = DOS error,
//          BX = largest block                                               v1.31 0x1705..0x1734
//   0101h: 0006h(DX) -> segment = base >> 4 (shrd dx,cx,4); DOS AH=49h ES=segment (CF=1, AX = DOS error
//          on failure); then 0001h(DX)                                     v1.31 0x1737..0x1744, 0x1753
// Table size: the stub's configuration block (first 21 bytes after the MZ header, copied to
// _pm_pagetables.. by pmodewe.asm _openexe2 with VARTYPE 1) is 04 0001 4000 8000 08 08 20 01 01 00 00 01
// ffffff7f 0000 -> _pm_selectors = 100h (= the v1.33 default PM_SELECTORS). SYSSELECTORS = 10 and
// FREESELECTORS = 14 are confirmed by the v1.31 code above. So GDT limit = 877h, the top slot is 870h.
const PM_SELECTORS = 0x100;
const SYSSELECTORS = 10, FREESELECTORS = SYSSELECTORS + 4;
const GDT_LIMIT = PM_SELECTORS * 8 + 8 * 5 + 8 * SYSSELECTORS - 1; // 0x877
const GDT_TOP = GDT_LIMIT & 0xfff8;                                 // 0x870

// Descriptors in use when the program starts (base null = not modelled, PMODE/W's own memory):
//   kernel, fixed (pmodewk.asm DATA; v1.31 vxr_init 0x9f0..0xa5c): 08h SELCODE (PMODE_TEXT: the default
//   PM interrupt handlers), 10h SELDATA, 18h SELZERO (base 0, 4 GB), 20h callback DS, 40h (base 400h),
//   and from 8*SYSSELECTORS up: 50h caller SS, 58h caller DS, 60h environment (stored into PSP[2Ch]; only
//   when the environment segment is not 0, which DOS always provides), 68h PSP (limit 100h).
//   extender (pmodewe.asm startup, v1.31 call sites of _initdescriptor 0x2e88: 0x2759, 0x2766, 0x2779,
//   0x2784, 0x2d63 — through 0000h, so top-down): 870h zero-based 32-bit code (_selcode = the program's CS),
//   868h zero-based data (_selzero = DS/SS/ES of the program, GS at entry), 860h DTA buffer (_selbuf),
//   858h INT 21h low buffer (_int21lowbufsel, returned in GS by INT 21h AX=FF00h), 850h fixup buffer
//   (_selfixup; its free is commented out in the source, so it stays allocated). Both PMW1 objects are
//   32-bit (flags 2045h/2043h, bit 2000h), so no per-object descriptors are allocated (_loadobj1a).
export const SEL_PMW = 0x0008;   // PMODE/W kernel code: default PM interrupt vectors (intrmatrix)
export const SEL_ENV = 0x0060;   // environment (PSP[2Ch])
export const SEL_PSP = 0x0068;   // PSP (ES at program entry)
export const SEL_LOWBUF = 0x0858; // INT 21h low buffer (GS after INT 21h AX=FF00h DX=78h)
export const SEL_DATA = 0x0868;  // DS/ES/SS of the flat program (base 0)
export const SEL_CODE = 0x0870;  // CS of the flat program (base 0)
const INITIAL_DESCRIPTORS = [
  [0x08, null], [0x10, null], [0x18, 0], [0x20, null], [0x40, 0x400],
  [0x50, null], [0x58, null], [SEL_ENV, null], [SEL_PSP, null],
  [0x850, null], [SEL_LOWBUF, null], [0x860, null], [SEL_DATA, 0], [SEL_CODE, 0],
];
let gdt;      // index (selector & 0xfff8) -> { used, base, access }
let gdtFree;  // pmodewk.asm gdtfree: next slot for 0002h
function resetDescriptors() {
  gdt = new Map();
  for (const [sel, base] of INITIAL_DESCRIPTORS) gdt.set(sel, { used: true, base, access: 0x92 });
  gdtFree = 8 * FREESELECTORS; // 0x70
}
resetDescriptors();
// int31testsel: the descriptor for BX, or null (-> CF=1, registers unchanged)
function testsel(bx) {
  if ((bx & 0xffff) > GDT_LIMIT) return null;
  const d = gdt.get(bx & 0xfff8);
  return d && d.used ? d : null;
}
// 0000h with CX = count: the lowest selector of `count` consecutive free descriptors found scanning down
// from the top (a used one restarts the count), or -1.
function allocDescriptors(count) {
  if (count === 0) return -1;
  let need = count;
  for (let ax = GDT_TOP; ax >= 8 * SYSSELECTORS; ax -= 8) {
    const d = gdt.get(ax);
    if (d && d.used) { need = count; continue; }
    if (--need === 0) {
      for (let k = 0, bx = ax; k < count; k++, bx += 8) gdt.set(bx, { used: true, base: 0, access: 0x92 });
      return ax;
    }
  }
  return -1;
}
// Linear base of a selector, for ported code that addresses memory through a loaded segment register
// (e.g. the STK stubs' `mov es, sel ... es:[edi]`): flat address = selBase(sel) + offset.
export function selBase(sel) {
  const d = testsel(sel);
  if (!d || d.base === null) throw new Error('dpmi: unknown selector 0x' + (sel & 0xffff).toString(16));
  return d.base;
}

// ---- real-mode memory ---------------------------------------------------------------------------
// Real-mode seg:off -> flat address. Conventional memory is identity-mapped (linear = seg*16+off) into
// the port's flat array, where 0x00000..0x003FF is the IVT and 0x00400..0x004FF the BIOS data area.
export const rmLinear = (seg, off) => (((seg & 0xffff) << 4) + (off & 0xffff)) >>> 0;
export const rmFarPtr = (farptr) => rmLinear(farptr >>> 16, farptr & 0xffff);

// DOS memory arena (INT 21h AH=48h/49h semantics behind DPMI 0100h/0101h): first-fit over a chain of
// paragraph blocks, each preceded by a 1-paragraph MCB, as DOS does (default strategy 0 = first fit).
// UNCERTAIN: how much conventional memory was free under the original DOS + STKRUN + PMODE/W setup is
// not knowable from the binary. The port's flat map reserves 0x10000..0x667CF for the unrelocated
// program image/stack, so the arena is the two free areas around it: 0x00800..0x0FFFF and
// 0x66800..0x9FFFF. The paragraph at 0x07000 stays out of the arena, where the STK resident stub used to
// sit (stage 1), so DOS blocks keep the addresses they had.
const ARENAS = [[0x0080, 0x0700], [0x0701, 0x1000], [0x6680, 0xa000]]; // [firstSeg, endSeg)
let blocks; // {mcb, paras, owner} sorted, covering each arena: owner 0 = free
export function resetDosMemory() {
  blocks = ARENAS.map(([a, b]) => ({ mcb: a, paras: b - a - 1, free: true }));
}
resetDosMemory();

function coalesce() {
  for (let i = 0; i + 1 < blocks.length; i++) {
    const x = blocks[i], y = blocks[i + 1];
    if (x.free && y.free && x.mcb + 1 + x.paras === y.mcb) { x.paras += 1 + y.paras; blocks.splice(i + 1, 1); i--; }
  }
}
export function dosAlloc(paras) {
  coalesce();
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (!b.free || b.paras < paras) continue;
    if (b.paras > paras) blocks.splice(i + 1, 0, { mcb: b.mcb + 1 + paras, paras: b.paras - paras - 1, free: true });
    b.paras = paras; b.free = false;
    return { seg: b.mcb + 1 };
  }
  let largest = 0;
  for (const b of blocks) if (b.free && b.paras > largest) largest = b.paras;
  return { error: 8, largest }; // DOS error 8: insufficient memory
}
export function dosFree(seg) {
  const b = blocks.find((x) => x.mcb + 1 === seg && !x.free);
  if (!b) return false;
  b.free = true;
  return true;
}

// ---- INT 21h (the extender's own answers; everything else goes to the DOS layer) ------------------
let dosHandler = null; // other INT 21h functions: the CRT/DOS layer may register a handler
export function setDosHandler(fn) { dosHandler = fn; }

export function int21(regs) {
  const s = loadRegs(regs);
  const ah = (s.eax >>> 8) & 0xff, al = s.eax & 0xff;
  // AX=FF00h DX=78h: the DOS/4G presence check answered by the extender (pmodewe.asm _int21FF: GS =
  // _int21lowbufsel, EAX = 4734FFFFh; v1.31 0x3be9..0x3bf3). Asked by Watcom cstart 0x238e4. Any other
  // AH=FFh goes on to DOS.
  if (lo16(s.eax) === 0xff00 && lo16(s.edx) === 0x78) {
    s.eax = 0x4734ffff;
    return { ...outRegs(s), gs: SEL_LOWBUF };
  }
  if (dosHandler) return dosHandler(regs);
  throw new Error('dpmi: INT 21h AH=0x' + ah.toString(16) + ' not emulated here');
}

// ---- INT 31h ------------------------------------------------------------------------------------
// Failures follow PMODE/W: int31fail returns CF=1 with every register as it was (pmodewk.asm int31fail:
// popad), int31failax/int31failbx also return AX / BX.
export function int31(regs) {
  const s = loadRegs(regs);
  const ax = lo16(s.eax);
  const fail = () => { const f = loadRegs(regs); f.cflag = 1; return outRegs(f); };
  s.cflag = 0;
  switch (ax) {
    case 0x0006: { // get segment base: BX = selector -> CX:DX = linear base
      const d = testsel(s.ebx);
      if (!d) return fail();
      if (d.base === null) throw new Error('dpmi: base of PMODE/W selector 0x' + lo16(s.ebx).toString(16) + ' not modelled');
      s.ecx = set16(s.ecx, d.base >>> 16); s.edx = set16(s.edx, d.base & 0xffff);
      break;
    }
    case 0x0100: { // allocate DOS memory: BX = paragraphs -> AX = segment, DX = selector
      const r = dosAlloc(lo16(s.ebx));                                // AH=48h
      if (r.error) { s.cflag = 1; s.eax = set16(s.eax, r.error); s.ebx = set16(s.ebx, r.largest); break; }
      // 000Ah BX=DS: the caller's DS, which in this program is always the flat data selector (a port
      // passing no `ds` means that one)
      const src = testsel(regs.ds ?? SEL_DATA);
      const sel = src ? allocDescriptors(1) : -1;
      if (sel < 0) { dosFree(r.seg); return fail(); }                // AH=49h; int31fail
      gdt.get(sel).base = (r.seg << 4) >>> 0;                         // 0007h
      s.eax = set16(s.eax, r.seg); s.edx = set16(s.edx, sel);
      break;
    }
    case 0x0101: { // free DOS memory: DX = selector
      const d = testsel(s.edx);                                       // 0006h
      if (!d) return fail();
      if (d.base === null) throw new Error('dpmi: base of PMODE/W selector 0x' + lo16(s.edx).toString(16) + ' not modelled');
      if (!dosFree((d.base >>> 4) & 0xffff)) {                        // AH=49h ES = base >> 4
        const f = loadRegs(regs); f.cflag = 1; f.eax = set16(f.eax, DOS_ERR_INVALID_BLOCK); return outRegs(f);
      }
      d.used = false;                                                 // 0001h
      break;
    }
    case 0x0300: // simulate real-mode interrupt: BL = INT, ES:EDI = real-mode call structure
      simulateRealModeInt(s.ebx & 0xff, selBase(s.es) + s.edi);
      break;
    default:
      throw new Error('dpmi: INT 31h AX=0x' + ax.toString(16) + ' is not used by the program');
  }
  return outRegs(s);
}
// DOS AH=49h on a segment that is not an allocated block: error 9 "invalid memory block address".
// UNCERTAIN: MS-DOS may report 7 (arena trashed) instead when the word before ES is not an MCB; no
// caller of 0101h reads AX.
const DOS_ERR_INVALID_BLOCK = 9;

// Real-mode INT 21h services reached only through DPMI 0300h (the CRT's _setmbcp, 0x2eb2a / 0x2ec2c,
// run by the XI initializer 0x2de33 — src/lib/crt_startup.js). Assumed: MS-DOS 5.0..6.22, US
// (country 001, code page 437), no DBCS. Structure offsets (DPMI 0.9): EDI 00h, ESI 04h, EBX 10h,
// EDX 14h, ECX 18h, EAX 1Ch, flags 20h, ES 22h, DS 24h.
//   AX=6300h get DBCS lead-byte table: AL=0, DS:SI -> table; MS-DOS 3.2..6.x without DBCS returns an
//            empty table (terminating 0000h word only). UNCERTAIN: the address of that table inside DOS;
//            it is placed at DOS_DBCS_TABLE (zeroed in resetDpmi).
//   AX=6501h get general internationalization info into ES:DI, CX = buffer size: byte 01h, word size of
//            the following information (0026h), word country ID, word code page, ... truncated to CX
//            bytes; CX = bytes returned; CF clear. UNCERTAIN: the size word DOS stores when the buffer is
//            truncated (0026h assumed); the program reads only the code page word at +5.
const DOS_DBCS_TABLE = 0x00600;
function simulateRealModeInt(n, st) {
  const rw = (o) => u8[st + o] | (u8[st + o + 1] << 8);
  const ww = (o, v) => { u8[st + o] = v & 0xff; u8[st + o + 1] = (v >> 8) & 0xff; };
  const ax = rw(0x1c);
  if (n === 0x21 && ax === 0x6300) {
    ww(0x1c, ax & 0xff00);                                   // AL = 0
    ww(0x24, DOS_DBCS_TABLE >>> 4); ww(0x04, DOS_DBCS_TABLE & 0x0f);
    ww(0x20, rw(0x20) & ~1);                                 // CF clear
    return;
  }
  if (n === 0x21 && ax === 0x6501) {
    const info = [0x01, 0x26, 0x00, 0x01, 0x00, 437 & 0xff, 437 >> 8];
    const len = Math.min(rw(0x18), info.length);
    const buf = rmLinear(rw(0x22), rw(0x00));
    for (let i = 0; i < len; i++) u8[buf + i] = info[i];
    ww(0x18, len);
    ww(0x20, rw(0x20) & ~1);
    return;
  }
  throw new Error('dpmi: 0300h INT 0x' + n.toString(16) + ' AX=0x' + ax.toString(16) + ' not emulated');
}

export function resetDpmi() {
  u8.fill(0, 0, 0x400); // real-mode IVT: nothing hooked
  u8[DOS_DBCS_TABLE] = 0; u8[DOS_DBCS_TABLE + 1] = 0;
  resetDosMemory();
  resetDescriptors();
}
