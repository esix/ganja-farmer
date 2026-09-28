// Test page for the ported library (not the game): shows any PCX the way the game
// does (Set_Video_Mode 13h, PCX_Init, PCX_Load with palette, PCX_Show_Buffer,
// PCX_Delete) and runs the game's fade (Screen_Transition effect 0).
import { loadInitialData, loadRomFont, writeCString } from './runtime/mem.js';
import { F } from './runtime/registry.js';
import * as vfs from './platform/vfs.js';
import * as pc from './platform/pc.js';
import * as con from './platform/console.js';
import * as display from './platform/display.js';
import { crtInit } from './lib/index.js';

const get = async (u) => new Uint8Array(await (await fetch(u)).arrayBuffer());
loadInitialData(await get('assets/boot/data_init.bin'));
loadRomFont(await get('assets/boot/font8x8.bin'));
await vfs.mountFromUrl('assets/game/', 'assets/boot/manifest.json');
pc.install({ onBiosKey: con.push });
crtInit();
const canvas = document.getElementById('screen');
display.attach(canvas);
pc.attachBrowser(canvas);

const PCX = 0x31ee4; // the game's pcx_picture instance
const nameBuf = F.malloc_23dab(64);
const status = document.getElementById('status');
let busy = false;

async function run(fn) {
  if (busy) return;
  busy = true;
  try { await fn(); } catch (e) { status.textContent = 'Error: ' + e.message; console.error(e); }
  busy = false;
}

async function show(file) {
  writeCString(nameBuf, file.toLowerCase());
  await F.Set_Video_Mode_203c6(0x13);
  await F.PCX_Init_207a0(PCX);
  const ok = await F.PCX_Load_20806(nameBuf, PCX, 1);
  await F.PCX_Show_Buffer_20b9b(PCX);
  await F.PCX_Delete_20b69(PCX);
  status.textContent = `${file}: PCX_Load returned ${ok}` + (con.outputText() ? ` — console: ${con.outputText()}` : '');
}

const sel = document.getElementById('file');
const names = (await (await fetch('assets/boot/manifest.json')).json()).filter((n) => /\.PCX$/i.test(n));
for (const n of names) sel.add(new Option(n, n));
sel.value = 'TITP.PCX';
sel.onchange = () => run(() => show(sel.value));
document.getElementById('fade').onclick = () => run(async () => {
  status.textContent = 'Screen_Transition(0)…';
  await F.Screen_Transition_21673(0);
  status.textContent = 'faded (Screen_Transition effect 0: 20 steps, one BIOS tick each)';
});
await run(() => show(sel.value));
