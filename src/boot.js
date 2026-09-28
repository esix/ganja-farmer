// Browser boot: data image + ROM font, the DOS file system (assets/game), display, keyboard/mouse on
// DOM events, real-time PIT, then the program as DOS + the Watcom startup run it (machine.js).
import { powerOn, runProgram, pc, con } from './machine.js';
import { setYieldHook, hostYield } from './runtime/cpu.js';
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
display.attach(canvas);          // repaints video memory on every animation frame
pc.attachBrowser(canvas);        // keyboard (window keydown/keyup -> set-1 bytes), mouse (canvas), PIT timer
// Each busy-wait yield also brings the PIT up to date, so 0x46C advances with wall-clock time
// (18.2065 Hz) between the 1 ms interval pumps as well.
//
// Hidden tab: the machine is suspended (pause chosen by the user, 2026-09-28). While document.hidden, the next yield does not return until the
// page is visible again, and the 1 ms PIT pump is stopped, so no instruction runs and no IRQ0 is
// delivered (0% CPU instead of a core spinning on MessageChannel yields). On return pit.start() takes a
// new time base (lastMs = null), so the hidden time is skipped rather than caught up: the program resumes
// exactly where it was, like a machine that was paused (DOSBox's "pause" priority setting for an
// unfocused window). The BIOS time of day (0x46C) then lags the wall clock by the hidden time; apart from
// srand(Timer_Query()) once at start-up (0x1aa3f) the program uses 0x46C only for differences
// (Timer_Query, Time_Delay), so the lag is not observable.
// Why not keep running with setTimeout sleeps and PIT catch-up: browsers throttle timers in hidden tabs to
// about 1 per second (Chrome: to 1 per minute after 5 minutes), so every yield would advance the clock by
// ~1 s (maxCatchUp = 1000 ms, pit.js) while the game computes one frame: an 18x "slow PC" with tick bursts
// the original never sees, and after intensive throttling the clock would lose time anyway. Keys and
// mouse buttons held when the page was hidden are released by kbd.js/mouse.js (blur/visibilitychange).
let resumeWaiters = [];
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pc.pit.stop(); return; }
  pc.pit.start(1);
  const w = resumeWaiters; resumeWaiters = [];
  for (const r of w) r();
});
if (document.hidden) pc.pit.stop(); // loaded in a background tab: suspended until first shown
setYieldHook(async () => {
  if (document.hidden) await new Promise((r) => resumeWaiters.push(r));
  pc.pit.pump();
  return hostYield();
});

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
