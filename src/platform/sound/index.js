// Sound layer entry: the STKRUN services (stkrun.js) and, in the browser, the sound card's host side
// (OPL2 emulator + WebAudio output). Usage after pc.install():
//   sound.install();                 // STK functions, STK timer update, sound-card clock
//   await sound.attachBrowserAudio(); // browser only: DBOPL chip + AudioContext (starts on first gesture)
import * as card from './soundcard.js';
import { createOpl2 } from './opl2.js';
import { createAudioOut } from './audio-out.js';

export { install, state, SETUP } from './stkrun.js';
export { card };

export async function attachBrowserAudio() {
  card.setOplChip(await createOpl2());
  const out = await createAudioOut();
  card.setSink(out);
  return out;
}
