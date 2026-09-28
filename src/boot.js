// Browser boot: data image + ROM font, the DOS file system (assets/game), display, keyboard/mouse on
// DOM events, real-time PIT, then the program as DOS + the Watcom startup run it (machine.js).
import { powerOn, runProgram, pc, con } from './machine.js';
import * as vfs from './platform/vfs.js';
import * as display from './platform/display.js';
import * as sound from './platform/sound/index.js';

const status = document.getElementById('status');
const say = (s) => { if (status) status.textContent = s; };

// Machine images: fetched with vfs.fetchBytes (checks the HTTP status, retries transient failures).
let dataInit, font;
try {
  dataInit = await vfs.fetchBytes('assets/boot/data_init.bin');
  font = await vfs.fetchBytes('assets/boot/font8x8.bin');
} catch (e) {
  say('Could not load the machine images (assets/boot/data_init.bin, assets/boot/font8x8.bin): ' + e.message +
    ' — reload the page to retry.');
  throw e;
}
vfs.setStore(vfs.localStorageStore);
try {
  await vfs.mountFromUrl('assets/game/', 'assets/boot/manifest.json', (d, n, f) => say(`loading game files ${d}/${n} (${f})`));
} catch (e) {
  say('Could not load game files: ' + e.message + ' — reload the page to retry.');
  throw e;
}

powerOn({ dataInit, font });

// ---- STK sound service ------------------------------------------------------------------------
// SINGLE CALL SITE for the sound layer (platform/sound/index.js): install() registers the STK functions
// with stk.js, the STK update with the STK timer and the sound card with the emulated clock (after
// pc.install, before main); attachBrowserAudio() adds the OPL2 chip and the WebAudio output (it starts
// on the first pointer/key press, browser autoplay policy).
sound.install();
try { await sound.attachBrowserAudio(); } catch (e) { console.warn('no audio output:', e); }

const canvas = document.getElementById('screen');
display.attach(canvas);          // shows video memory; redraws when it or the palette changes
pc.attachBrowser(canvas);        // keyboard, mouse, PIT clock, idle sleep and hidden-tab pause (pc.js)

canvas.focus?.();
say('');
try {
  const { exitCode } = await runProgram();
  say(`Program exited (code ${exitCode}).`);
  console.log('exit code', exitCode, 'console output:\n' + con.outputText());
} catch (e) {
  say('Crash: ' + e.message);
  console.error(e);
}
