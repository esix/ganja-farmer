// Sound layer entry: the STKRUN services (stkrun.js) and, in the browser, the sound card's host side
// (WebAudio output + the music recordings, music-out.js). Usage after pc.install():
//   sound.install();                 // STK functions, STK timer update, sound-card clock
//   await sound.attachBrowserAudio(); // browser only: AudioContext (starts on first gesture) + the music recordings
import * as card from './soundcard.js';
import * as musicOut from './music-out.js';
import { createAudioOut } from './audio-out.js';

export { install, state, SETUP } from './stkrun.js';
export { card };

export async function attachBrowserAudio() {
  const out = await createAudioOut();
  card.setSink(out);
  if (out.context) await musicOut.attach(out.context);
  return out;
}
