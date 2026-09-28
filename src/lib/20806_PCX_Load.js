// 0x20806  int PCX_Load(char *file, pcx_picture *img, int enable_palette)
//          [Watcom: EAX=file, EDX=img, EBX=enable_palette; returns 1 ok / 0 file not found]
// fopen(file, "rb"); on NULL printf("\nPCX SYSTEM - Couldn't find file: %s", file) and return 0.
// Reads 128 header bytes into img+0; RLE-decodes into img->buffer (img+0x394) while count <= 64000
// (unsigned), ignoring the header's dimensions; fseek(fp, -768, SEEK_END); reads 256*3 palette bytes,
// each stored >>2 (sar) at img+0x94+i*3+{0,1,2}; fclose; if enable_palette, Write_Color_Reg(i, img+0x94+i*3)
// for i = 0..255. Returns 1.
//
// Every byte read is an inline expansion of the Watcom getc() macro (6 identical sites: 0x20877, 0x208db,
// 0x2094e, 0x20a05, 0x20a5f, 0x20ab9). It is written once as getc_inline() below; each call of it stands for
// one expansion at its site.
import { F, register } from '../runtime/registry.js';
import { R8, R32, W8, W32 } from '../runtime/mem.js';

// Inline getc(fp) as compiled at each site above. FILE fields used: +0 = _ptr, +4 = _cnt.
//   cmp [fp+4],0 / jle -> fgetc(fp)
//   movzx byte [_ptr]; sub 0xd; cmp 0xfd; ja -> fast path, else fgetc(fp)
//   fast path: dec [fp+4]; edx = [fp]; inc [fp]; eax = byte [edx]
// The unsigned test (b - 0xd) > 0xfd is true only for bytes 0x00..0x0c, so only those bytes are taken
// from the buffer directly; every other byte goes through fgetc (this is what the compiled code does).
// LATENT (audit round1 F-risky F10): addresses here and below are formed with `| 0` / signed R32, so an
// address >= 2^31 would go negative in JS where x86 wraps or faults; only fuzz inputs reach that (x86 faults).
function getc_inline(fp) {
  let c;
  if (R32(fp + 4) > 0 && ((R8(R32(fp)) - 0xd) >>> 0) > 0xfd) {
    W32(fp + 4, R32(fp + 4) - 1);
    const p = R32(fp);
    W32(fp, p + 1);
    c = R8(p);
  } else {
    c = F.fgetc_23bb9(fp);
  }
  return c;
}

register(0x20806, 'PCX_Load_20806', function PCX_Load_20806(file, img, enable_palette) {
  let fp; // [ebp-0x18]
  let result; // [ebp-0x1c]
  let hdr; // [ebp-8]: img (header destination)
  let i; // [ebp-0x10]
  let count; // [ebp-0xc]: output byte index
  let b; // [ebp-4]: byte
  let n; // [ebp-0x14]: run length
  let c; // [ebp-0x2c]..[ebp-0x40]: getc results

  fp = F.fopen_2264a(file, 0x3060d /* "rb" */);
  if (fp === 0) {
    F.printf_23783(0x30610 /* "\nPCX SYSTEM - Couldn't find file: %s" */, file);
    result = 0;
    return result;
  }

  hdr = img;
  for (i = 0; i < 0x80; i++) {
    c = getc_inline(fp); // [ebp-0x2c]
    W8((hdr + i) | 0, c & 0xff);
  }

  count = 0;
  // ORIGINAL BUG: the bound is only checked between codes; a run starting at count <= 64000 writes up to 63
  // bytes, so up to 64063 bytes can be written into the 64001-byte buffer (malloc'd in PCX_Init).
  // In practice it never overruns: every PCX the game loads (the 36 distinct *.pcx names in flat.bin, all 320x200)
  // decodes to exactly 64001 bytes — the decoder ends at count 64000, reads the 0x0C palette marker as a
  // literal byte and stores it at buf[64000], the buffer's last byte (audit round1 F-risky F11,
  // re/audit/round1/F-risky/t_kbd_gfx/pcxsim.py over assets/game/*.PCX: end_count = 64001 for each).
  // Only JAH2.PCX / JAH3.PCX (4-byte files, never named in the binary) would overrun.
  while ((count >>> 0) <= 0xfa00) {
    c = getc_inline(fp); // [ebp-0x30]
    b = c & 0xff;
    if (b >= 0xc0 && b <= 0xff) {
      n = (b - 0xc0) | 0;
      c = getc_inline(fp); // [ebp-0x34]
      b = c & 0xff;
      while (n-- > 0) {
        W8((R32(img + 0x394) + count++) | 0, b);
      }
    } else {
      W8((R32(img + 0x394) + count++) | 0, b);
    }
  }

  F.fseek_23ee1(fp, -768, 2 /* SEEK_END */);

  for (i = 0; i < 0x100; i++) {
    c = getc_inline(fp); // [ebp-0x38]
    W8((i * 3 + img + 0x94) | 0, (c >> 2) & 0xff);
    c = getc_inline(fp); // [ebp-0x3c]
    W8((i * 3 + img + 0x95) | 0, (c >> 2) & 0xff);
    c = getc_inline(fp); // [ebp-0x40]
    W8((i * 3 + img + 0x96) | 0, (c >> 2) & 0xff);
  }

  F.fclose_228ed(fp);

  if (enable_palette !== 0) {
    for (i = 0; i < 0x100; i++) {
      F.Write_Color_Reg_20541(i, (i * 3 + ((img + 0x94) | 0)) | 0);
    }
  }

  result = 1;
  return result;
});
