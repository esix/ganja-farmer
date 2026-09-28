// Unit tests for the Watcom CRT implementation (src/lib/crt*.js).
// Run: node --test tests/crt.test.mjs
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { u8, R8, R32, W32, loadInitialData, readCString, writeCString } from '../src/runtime/mem.js';
import { F } from '../src/runtime/registry.js';
import { stackAlloc, stackFree } from '../src/runtime/stack.js';
import * as vfs from '../src/platform/vfs.js';
import * as dos from '../src/platform/dos.js';
import * as con from '../src/platform/console.js';
import { crtInit, crtExit, heapReset } from '../src/lib/crt.js';

// runtime/cpu.js yieldCpu() uses a MessageChannel whose port keeps node's event loop alive once used
// (getch waiting below); end the process when the tests are done.
after(() => { setTimeout(() => process.exit(), 50).unref(); });

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const ORIG = join(ROOT, 'assets', 'game');
const SCORES = readFileSync(join(ORIG, 'SCORES.DAT'));

// fresh machine: data image, empty heap, DOS handles, console, CRT startup
function boot() {
  loadInitialData(readFileSync(join(ROOT, 'assets', 'boot', 'data_init.bin')));
  u8.fill(0, 0x100000);
  heapReset();
  dos.reset();
  con.clearKeys();
  con.clearOutput();
  crtInit();
}
const str = (a, s) => { writeCString(a, s); return a; };
const bytes = (a, n) => Array.from(u8.subarray(a, a + n));
const scratch = 0x7f0000; // test buffers (inside MEM_SIZE, far above the heap used here)

// Reads records exactly like the game: 0x10767 fopen("scores.dat" 0x3001b, "r" 0x30019), then
// 0x10010 fread(0x60a70 + i*0x18, 0x18, 1, fp) until it returns 0, then fclose.
function readScoresLikeGame() {
  const fp = F.fopen_2264a(0x3001b, 0x30019);
  assert.notEqual(fp, 0);
  let i = 0;
  while (F.fread_1e110(0x60a70 + i * 0x18, 0x18, 1, fp) !== 0) i++;
  assert.equal(F.fclose_228ed(fp), 0);
  return i;
}
function parseRecords(n) {
  const recs = [];
  for (let i = 0; i < n; i++) {
    const a = 0x60a70 + i * 0x18;
    recs.push({ score: R32(a), level: R32(a + 4), name: readCString(a + 8) });
  }
  return recs;
}

test('SCORES.DAT: text-mode read of 0x18-byte records as the game does', () => {
  boot();
  vfs.mountBytes('SCORES.DAT', new Uint8Array(SCORES));
  assert.equal(SCORES.length, 217); // 9*24 = 216 + 1: the level 10 (0x0a) of record 0 was written as "\r\n"
  const n = readScoresLikeGame();
  const recs = parseRecords(n);
  console.log('SCORES.DAT records:');
  for (const r of recs) console.log(`  ${String(r.score).padStart(7)}  level ${String(r.level).padStart(2)}  ${JSON.stringify(r.name)}`);
  assert.equal(n, 9);
  assert.deepEqual(recs.map((r) => r.score), [100000, 90000, 80000, 70000, 66492, 50000, 40000, 33947, 27624]);
  assert.deepEqual(recs.map((r) => r.level), [10, 9, 8, 7, 24, 5, 4, 3, 3]); // [0] needs "\r\n" -> "\n"
  assert.deepEqual(recs.map((r) => r.name), ['AlienJoe', 'P_Freak', 'NWT_Hyde', 'T_Rock', 'fsd            ',
    'Bryce_Spice', 'PaddywacksBill', 'Monkey_Pants', '$atan_666']);
});

test('SCORES.DAT: write back with fopen "w" + fwrite (0x10676) reproduces the original 217 bytes', () => {
  boot();
  vfs.mountBytes('SCORES.DAT', new Uint8Array(SCORES));
  readScoresLikeGame();
  const fp = F.fopen_2264a(0x3000e, 0x3000c);
  assert.notEqual(fp, 0);
  for (let i = 0; i < 9; i++) assert.equal(F.fwrite_2270d(0x60a70 + i * 0x18, 0x18, 1, fp), 1);
  assert.equal(F.fclose_228ed(fp), 0);
  assert.deepEqual(Array.from(vfs.read('scores.dat')), Array.from(SCORES));
});

test('FILE layout, static __iob slot reuse, fclose on a closed stream', () => {
  boot();
  vfs.mountBytes('SCORES.DAT', new Uint8Array(SCORES));
  const fp = F.fopen_2264a(0x3001b, 0x30019);
  assert.equal(fp, 0x31352); // first free __iob entry (after stdin..stdprn)
  assert.equal(R32(fp + 0x0c), 0x1); // READ, text
  assert.equal(R32(fp + 0x10), 5); // first file handle
  F.fgetc_23bb9(fp);
  assert.equal(R32(fp + 0x14), 0x1000); // bufsize
  assert.equal(R32(fp + 4), 217 - 1); // whole (short) file read into the buffer, one byte taken
  assert.equal(F.ftell_24b81(fp), 1);
  assert.equal(F.fclose_228ed(fp), 0);
  assert.equal(F.fclose_228ed(fp), -1); // no longer on the open list
  const fp2 = F.fopen_2264a(0x3001b, str(scratch, 'rb'));
  assert.equal(fp2, fp); // record from the free list -> same FILE
  assert.equal(R32(fp2 + 0x0c), 0x41); // READ | BINARY
  F.fclose_228ed(fp2);
  assert.equal(F.fopen_2264a(str(scratch, 'nofile.xyz'), str(scratch + 0x20, 'r')), 0);
  assert.equal(R32(0x651dc), 1); // errno ENOENT (DOS error 2 -> table 0x31674)
  assert.equal(F.fopen_2264a(0x3001b, str(scratch, 'x')), 0);
  assert.equal(R32(0x651dc), 9); // invalid mode -> errno 9
});

function readAllText(content, mode = 'r') {
  vfs.mountBytes('T.TXT', Uint8Array.from(content));
  const fp = F.fopen_2264a(str(scratch, 't.txt'), str(scratch + 0x20, mode));
  const out = [];
  let c;
  while ((c = F.fgetc_23bb9(fp)) !== -1) out.push(c);
  const eof = (R32(fp + 0xc) & 0x10) !== 0;
  F.fclose_228ed(fp);
  return { out, eof };
}

test('text mode: CR handling and Ctrl-Z in fgetc and fread', () => {
  boot();
  // "\r\n" -> "\n"; lone "\r" drops itself and returns the next byte; "\r\r\n" -> "\r\n"
  assert.deepEqual(readAllText([0x41, 0x0d, 0x0a, 0x42, 0x0d, 0x43, 0x0d, 0x0d, 0x0a, 0x44]).out,
    [0x41, 0x0a, 0x42, 0x43, 0x0d, 0x0a, 0x44]);
  // "\r" at end of file: dropped, EOF
  assert.deepEqual(readAllText([0x41, 0x0d]).out, [0x41]);
  // Ctrl-Z ends the text (EOF flag), binary mode keeps everything
  let r = readAllText([0x41, 0x1a, 0x42]);
  assert.deepEqual(r.out, [0x41]);
  assert.equal(r.eof, true);
  assert.deepEqual(readAllText([0x41, 0x0d, 0x0a, 0x1a, 0x42], 'rb').out, [0x41, 0x0d, 0x0a, 0x1a, 0x42]);

  // fread text: stops at 0x1A with EOF, partial items still stored, returns whole items only
  vfs.mountBytes('T.TXT', Uint8Array.from([1, 2, 0x0d, 0x0a, 3, 0x1a, 9, 9]));
  const fp = F.fopen_2264a(str(scratch, 't.txt'), str(scratch + 0x20, 'r'));
  u8.fill(0xee, scratch + 0x100, scratch + 0x110);
  assert.equal(F.fread_1e110(scratch + 0x100, 2, 4, fp), 2); // 4 bytes stored: 1,2,0a,3
  assert.deepEqual(bytes(scratch + 0x100, 5), [1, 2, 0x0a, 3, 0xee]);
  assert.equal(R32(fp + 0xc) & 0x10, 0x10);
  // reading continues after the 0x1A (the CRT does not stop at the EOF flag)
  assert.equal(F.fread_1e110(scratch + 0x100, 1, 8, fp), 2);
  assert.deepEqual(bytes(scratch + 0x100, 2), [9, 9]);
  F.fclose_228ed(fp);
});

test('text-mode write: "\\n" -> "\\r\\n"; binary unchanged; fwrite return values', () => {
  boot();
  const src = scratch + 0x200;
  u8.set([0x41, 0x0a, 0x42, 0x0d, 0x0a], src);
  let fp = F.fopen_2264a(str(scratch, 'o.txt'), str(scratch + 0x20, 'w'));
  assert.equal(F.fwrite_2270d(src, 1, 5, fp), 5);
  assert.equal(F.fwrite_2270d(src, 5, 0, fp), 0);
  F.fclose_228ed(fp);
  assert.deepEqual(Array.from(vfs.read('O.TXT')), [0x41, 0x0d, 0x0a, 0x42, 0x0d, 0x0d, 0x0a]);
  fp = F.fopen_2264a(str(scratch, 'o.bin'), str(scratch + 0x20, 'wb'));
  assert.equal(F.fwrite_2270d(src, 5, 1, fp), 1);
  F.fclose_228ed(fp);
  assert.deepEqual(Array.from(vfs.read('O.BIN')), [0x41, 0x0a, 0x42, 0x0d, 0x0a]);
  // fwrite on a read-only stream: 0, errno 4, ERR flag
  vfs.mountBytes('T.TXT', Uint8Array.from([1]));
  fp = F.fopen_2264a(str(scratch, 't.txt'), str(scratch + 0x20, 'r'));
  assert.equal(F.fwrite_2270d(src, 1, 1, fp), 0);
  assert.equal(R32(0x651dc), 4);
  assert.equal(R32(fp + 0xc) & 0x20, 0x20);
  F.fclose_228ed(fp);
  // "w" truncates an existing file
  fp = F.fopen_2264a(str(scratch, 'o.bin'), str(scratch + 0x20, 'w'));
  F.fclose_228ed(fp);
  assert.equal(vfs.read('O.BIN').length, 0);
});

test('Load_File pattern: fopen rb, fseek end, ftell, fseek 0, fread', () => {
  boot();
  const data = readFileSync(join(ORIG, 'CLICK.DWD'));
  vfs.mountBytes('CLICK.DWD', new Uint8Array(data));
  const fp = F.fopen_2264a(str(scratch, 'click.dwd'), 0x307bc);
  assert.equal(F.fseek_23ee1(fp, 0, 2), 0);
  const size = F.ftell_24b81(fp);
  assert.equal(size, data.length);
  const buf = F.malloc_23dab(size & 0xffff);
  assert.equal(F.fseek_23ee1(fp, 0, 0), 0);
  assert.equal(F.fread_1e110(buf, size & 0xffff, 1, fp), 1);
  assert.deepEqual(Buffer.from(u8.subarray(buf, buf + size)), data);
  assert.equal(F.fread_1e110(buf, 1, 1, fp), 0);
  F.fclose_228ed(fp);
});

test('PCX_Load pattern: header by fgetc, fseek(-768, SEEK_END), palette, buffer fields', () => {
  boot();
  const data = readFileSync(join(ORIG, 'BACK.PCX'));
  vfs.mountBytes('BACK.PCX', new Uint8Array(data));
  const fp = F.fopen_2264a(str(scratch, 'back.pcx'), 0x3060d);
  for (let i = 0; i < 128; i++) assert.equal(F.fgetc_23bb9(fp), data[i]);
  assert.equal(R32(fp + 4), 0x1000 - 128); // _cnt as PCX_Load's inline getc sees it
  assert.equal(F.fseek_23ee1(fp, -768, 2), 0);
  for (let i = 0; i < 768; i++) assert.equal(F.fgetc_23bb9(fp), data[data.length - 768 + i]);
  assert.equal(F.fgetc_23bb9(fp), -1);
  // in-buffer seek (SEEK_SET inside the current buffer) moves _ptr/_cnt only
  F.fseek_23ee1(fp, 10, 0);
  assert.equal(F.fgetc_23bb9(fp), data[10]);
  F.fseek_23ee1(fp, -1, 1);
  assert.equal(F.fgetc_23bb9(fp), data[10]);
  F.fclose_228ed(fp);
});

test('printf: stdout is line buffered (tty), "\\n" -> "\\r\\n", %s, flushed at exit', () => {
  boot();
  assert.equal(F.printf_23783(0x30610, str(scratch, "BACK.PCX")), 34 + 8);
  // the leading '\n' flushed "\r\n" at once (line buffered); the rest waits in stdout's 0x86-byte buffer
  assert.equal(con.outputText(), '\r\n');
  assert.equal(R32(0x312ea + 0x14), 0x86);
  assert.equal(R32(0x312ea + 0xc) & 0x2200, 0x2200); // ISTTY | IOLBF
  F.printf_23783(0x305d1); // "Later..\n"
  assert.equal(con.outputText(), "\r\nPCX SYSTEM - Couldn't find file: BACK.PCXLater..\r\n");
  con.clearOutput();
  F.printf_23783(0x30548); // "GANJA FARMER  " (no newline)
  crtExit();
  assert.equal(con.outputText(), 'GANJA FARMER  ');
});

test('heap: NULL cases, sizes, reuse, not zeroed', () => {
  boot();
  assert.equal(F.malloc_23dab(0), 0);
  assert.equal(F.malloc_23dab(0xffffffd5), 0);
  const a = F.malloc_23dab(1);
  const b = F.malloc_23dab(64001);
  assert.equal(a % 8, 0);
  assert.ok(b >= a + 12);
  u8[b] = 0x5a;
  F.free_23ff0(b);
  F.free_23ff0(0);
  const c = F.malloc_23dab(64001);
  assert.equal(c, b);
  assert.equal(u8[c], 0x5a); // malloc does not clear
  assert.equal(F.malloc_23dab(0x7fffffff), 0); // cannot grow -> NULL
});

test('rand/srand: LCG at 0x310e8, initial seed 1', () => {
  boot();
  assert.equal(R32(0x310e8), 1);
  const seq = [];
  for (let i = 0; i < 10; i++) seq.push(F.rand_232c7());
  assert.deepEqual(seq, [16838, 5758, 10113, 17515, 31051, 5627, 23010, 7419, 16212, 4086]);
  F.srand_232eb(1);
  assert.equal(F.rand_232c7(), 16838);
  F.srand_232eb(0xdeadbeef);
  assert.equal(R32(0x310e8) >>> 0, 0xdeadbeef);
});

test('rand sequence from seed 1 matches the original code under unicorn', (t) => {
  const py = join(ROOT, 're', '.venv', 'bin', 'python');
  if (!existsSync(py)) { t.skip('re/.venv not available'); return; }
  const script = `
import sys
from unicorn import *
from unicorn.x86_const import *
d=open(sys.argv[1],'rb').read()
mu=Uc(UC_ARCH_X86,UC_MODE_32); mu.mem_map(0,0x800000); mu.mem_write(0,d)
mu.mem_write(0x310e8,(1).to_bytes(4,'little'))
out=[]
for i in range(1000):
    sp=0x7ff000; mu.mem_write(sp,(0x7fff00).to_bytes(4,'little'))
    mu.reg_write(UC_X86_REG_ESP,sp)
    mu.emu_start(0x232c7,0x7fff00)
    out.append(mu.reg_read(UC_X86_REG_EAX))
print(','.join(map(str,out)))`;
  const x86 = execFileSync(py, ['-c', script, join(ROOT, 're', 'unpacked', 'flat.bin')], { encoding: 'utf8' })
    .trim().split(',').map(Number);
  boot();
  const js = [];
  for (let i = 0; i < 1000; i++) js.push(F.rand_232c7());
  assert.deepEqual(js, x86);
});

test('abs / labs(0x23d7a) / div / __CHP / strlen / memset / memcpy', () => {
  boot();
  assert.equal(F.abs_2377c(-5), 5);
  assert.equal(F.abs_2377c(-0x80000000), -0x80000000);
  assert.equal(F.sub_23d7a(-7), 7);
  const r = stackAlloc(8);
  assert.equal(F.div_23744(-7, 2, r), r);
  assert.deepEqual([R32(r), R32(r + 4)], [-3, -1]);
  F.div_23744(7, -2, r);
  assert.deepEqual([R32(r), R32(r + 4)], [-3, 1]);
  assert.throws(() => F.div_23744(1, 0, r));
  assert.throws(() => F.div_23744(-0x80000000, -1, r));
  stackFree(8);
  assert.equal(F.__CHP_222a4(2.9), 2);
  assert.equal(F.__CHP_222a4(-2.9), -2);
  assert.equal(F.strlen_23d44(0x30493), 'This version of GANJA FARMER '.length);
  assert.equal(F.memset_23d81(scratch, 0x1ab, 5), scratch);
  assert.deepEqual(bytes(scratch, 6), [0xab, 0xab, 0xab, 0xab, 0xab, 0]);
  u8.set([1, 2, 3, 4, 5, 6, 7, 8, 9], scratch);
  F.memcpy_240eb(scratch + 1, scratch, 8); // overlapping, dst > src: forward dword copy
  assert.deepEqual(bytes(scratch, 9), [1, 1, 2, 3, 4, 4, 6, 7, 8]); // dword 0 then dword 1, each read after the previous write
});

test('kbhit / getch via the DOS console (BIOS keyboard buffer)', async () => {
  boot();
  assert.equal(F.kbhit_2328d(), 0);
  con.push(0x1e, 0x61); // 'a'
  con.push(0x48, 0x00); // Up arrow (extended)
  assert.equal(F.kbhit_2328d(), -1); // AL=0xFF sign-extended
  assert.equal(await F.getch_232a4(), 0x61);
  assert.equal(await F.getch_232a4(), 0);
  assert.equal(F.kbhit_2328d(), -1);
  assert.equal(await F.getch_232a4(), 0x48);
  assert.equal(F.kbhit_2328d(), 0);
  W32(0x3112c, 0x1234); // ungetch buffer
  assert.equal(F.kbhit_2328d(), 1);
  assert.equal(await F.getch_232a4(), 0x1234);
  const p = F.getch_232a4(); // waits
  setTimeout(() => con.push(0x1c, 0x0d), 5);
  assert.equal(await p, 0x0d);
});

test('cin >> buf (0x2231a): words from the console line, EOF/fail bits', async () => {
  boot();
  const typed = ' JAH  Bob\r';
  for (const ch of typed) con.push(0, ch.charCodeAt(0));
  const buf = scratch + 0x300;
  assert.equal(await F.istream_extract_cstr_2231a(0x64eb8, buf), 0x64eb8);
  assert.equal(readCString(buf), 'JAH');
  await F.istream_extract_cstr_2231a(0x64eb8, buf);
  assert.equal(readCString(buf), 'Bob');
  assert.equal(R32(0x64ed8), 0); // state good
  assert.equal(con.outputText(), ' JAH  Bob\r\n'); // DOS echo of the cooked line
});

test('int386 / _dos_getvect / _dos_setvect / outp / inp through runtime/io.js (platform pc.js)', async () => {
  const pc = await import('../src/platform/pc.js');
  const { setIoBackend } = await import('../src/runtime/io.js');
  boot();
  const prev = pc.install({ msSinceMidnight: 0, onBiosKey: con.push });
  try {
    // int386(0x10, &in, &out) with AX=0013h: mode set; outregs copied back, cflag 0
    const inr = scratch + 0x400, outr = scratch + 0x420;
    u8.fill(0, inr, inr + 0x1c);
    W32(inr, 0x13);
    W32(outr + 0x18, 0x55);
    assert.equal(F.int386_23d5d(0x10, inr, outr), 0x13);
    assert.equal(R32(outr), 0x13);
    assert.equal(R32(outr + 0x18), 0);
    // vector get/set as Keyboard_Install_Driver / Remove do
    const old = F._dos_getvect_24ccb(9);
    F._dos_setvect_24cfb(9, 0x22b04, 0x0008);
    assert.deepEqual(F._dos_getvect_24ccb(9), { eax: 0x22b04, edx: 0x0008 });
    F._dos_setvect_24cfb(9, old.eax, old.edx);
    assert.deepEqual(F._dos_getvect_24ccb(9), old);
    // outp/inp are byte accesses (DAC write then read back)
    F.outp_23d99(0x3c8, 7); F.outp_23d99(0x3c9, 1); F.outp_23d99(0x3c9, 2); F.outp_23d99(0x3c9, 0x103);
    F.outp_23d99(0x3c7, 7);
    assert.deepEqual([F.inp_23da3(0x3c9), F.inp_23da3(0x3c9), F.inp_23da3(0x3c9)], [1, 2, 3]);
  } finally {
    setIoBackend(prev);
  }
});

test('x87: trig results are 64-bit Ext values, rounded once by the following fmul (CW 0x127F)', async () => {
  const x87 = await import('../src/runtime/x87.js');
  boot();
  // site 0x11e36..0x11e5a with (dy-20)/(dx-20) = 4/-3: x87 gives exactly -3.0, double-rounding JS -3.0000000000000004
  const ang = x87.toDouble(F.atan_st0_23686(4 / -3));
  const c = F.cos_st0_236cc(ang);
  assert.ok(x87.isExt(c));
  assert.equal(x87.fmul(c, -5.0), -3);
  assert.equal(Math.cos(ang) * -5.0, -3.0000000000000004);
  assert.equal(x87.toDouble(F.sin_st0_236d6(ang)), Math.sin(ang));
  // __CHP on an Ext and on doubles
  assert.equal(F.__CHP_222a4(x87.fchs(c)), 0);
  assert.equal(F.__CHP_222a4(-2.9), -2);
  // exact single rounding of the other operations
  assert.equal(x87.fdiv(1, 3), 1 / 3);
  assert.equal(x87.fsub(0.1, 0.3), 0.1 - 0.3);
  // FPREM reduction by the 80-bit 2*pi (0x310ec) for |x| >= 2^63
  assert.notEqual(x87.toDouble(F.sin_st0_236d6(1e19)), Math.sin(1e19));
});
