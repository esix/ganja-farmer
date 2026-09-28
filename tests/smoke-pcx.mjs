// Headless smoke test: runs the ported library the way the game uses it
// (Set_Video_Mode 13h, PCX_Init, PCX_Load, PCX_Show_Buffer, Print_String) and
// writes the resulting screen (VRAM through the DAC) to a PPM image.
// Usage: node tests/smoke-pcx.mjs TITP.PCX out.ppm
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { loadInitialData, loadRomFont, u8, writeCString, VGA_BASE } from '../src/runtime/mem.js';
import { F } from '../src/runtime/registry.js';
import * as vfs from '../src/platform/vfs.js';
import * as pc from '../src/platform/pc.js';
import * as con from '../src/platform/console.js';
import { dac } from '../src/platform/display.js';
import { crtInit } from '../src/lib/index.js';

const root = new URL('../', import.meta.url).pathname;
const [file = 'TITP.PCX', out = 'out.ppm'] = process.argv.slice(2);

loadInitialData(readFileSync(root + 'assets/boot/data_init.bin'));
loadRomFont(readFileSync(root + 'assets/boot/font8x8.bin'));
for (const n of readdirSync(root + 'assets/game')) vfs.mountBytes(n, readFileSync(root + 'assets/game/' + n));
pc.install({ onBiosKey: con.push });
crtInit();

const PCX = 0x31ee4; // the game's own pcx_picture instance (main passes &DAT_00031ee4)
const name = F.malloc_23dab(64);
writeCString(name, file.toLowerCase());
const msg = F.malloc_23dab(64);
writeCString(msg, 'GANJA FARMER JS PORT');

await F.Set_Video_Mode_203c6(0x13);
await F.PCX_Init_207a0(PCX);
const ok = await F.PCX_Load_20806(name, PCX, 1);
await F.PCX_Show_Buffer_20b9b(PCX);
await F.PCX_Delete_20b69(PCX);
await F.Print_String_202cd(4, 190, 15, msg, 1);

let ppm = 'P6\n320 200\n255\n';
const px = Buffer.alloc(320 * 200 * 3);
for (let i = 0; i < 64000; i++) {
  const c = u8[VGA_BASE + i];
  for (let k = 0; k < 3; k++) px[i * 3 + k] = Math.round(dac[c * 3 + k] * 255 / 63);
}
writeFileSync(out, Buffer.concat([Buffer.from(ppm), px]));
console.log('PCX_Load returned', ok, '; wrote', out, '; console:', JSON.stringify(con.outputText()));
process.exit(0);
