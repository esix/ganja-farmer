// Host audio output for the emulated sound card (platform only; nothing here comes from the binary).
// createAudioOut() returns a sink { rate, write(Float32Array mono) } for soundcard.setSink().
//   Browser: WebAudio. The AudioContext is created at once (to know its rate) but browsers keep it
//   suspended until a user gesture (autoplay policy), so it is resumed on the first pointerdown/keydown.
//   Frames written while the context is not running are dropped. An AudioWorklet plays a FIFO of
//   the written frames; where AudioWorklet is unavailable, a ScriptProcessorNode does the same.
//   The emulated time (performance.now()) and the audio clock drift slightly: an empty FIFO plays
//   silence, and a FIFO longer than MAX_LATENCY_S drops its oldest frames.
//   Frames arrive in bursts, one per IRQ0 the host delivers (boot.js sleeps between them, ~14 ms), so
//   playback (re)starts only when MIN_BUFFER_S is queued: a jitter buffer instead of an underrun per burst.
//   Node (no WebAudio): a no-op sink; audio output is not needed for tests.
export const MAX_LATENCY_S = 0.25;
export const MIN_BUFFER_S = 0.05;

const WORKLET_SRC = `
class StkOut extends AudioWorkletProcessor {
  constructor(o) {
    super();
    this.q = []; this.off = 0; this.len = 0;
    this.max = o.processorOptions.maxFrames;
    this.min = o.processorOptions.minFrames;
    this.playing = false;
    this.port.onmessage = (e) => {
      this.q.push(e.data); this.len += e.data.length;
      while (this.len - this.off > this.max && this.q.length > 1) { this.len -= this.q[0].length; this.q.shift(); this.off = 0; }
    };
  }
  process(inputs, outputs) {
    const out = outputs[0];
    const n = out[0].length;
    if (!this.playing && this.len - this.off >= this.min) this.playing = true;
    for (let i = 0; i < n; i++) {
      let v = 0;
      if (!this.q.length) this.playing = false; // underrun: wait for the buffer to fill again
      else if (this.playing) {
        const b = this.q[0];
        v = b[this.off++];
        if (this.off >= b.length) { this.q.shift(); this.len -= b.length; this.off = 0; }
      }
      for (let c = 0; c < out.length; c++) out[c][i] = v;
    }
    return true;
  }
}
registerProcessor('stk-out', StkOut);
`;

export function nullSink(rate = 48000) { return { rate, write() {} }; }

export async function createAudioOut() {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return nullSink();
  const ctx = new AC();
  const rate = ctx.sampleRate;
  const maxFrames = Math.ceil(MAX_LATENCY_S * rate);
  const minFrames = Math.ceil(MIN_BUFFER_S * rate);
  let write;
  if (ctx.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
    const url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const node = new AudioWorkletNode(ctx, 'stk-out', {
      numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { maxFrames, minFrames },
    });
    node.connect(ctx.destination);
    write = (f) => node.port.postMessage(f, [f.buffer]);
  } else {
    // ScriptProcessorNode fallback (deprecated API, main-thread FIFO).
    const q = []; let off = 0; let len = 0; let playing = false;
    const sp = ctx.createScriptProcessor(2048, 0, 2);
    sp.onaudioprocess = (e) => {
      const L = e.outputBuffer.getChannelData(0), R = e.outputBuffer.getChannelData(1);
      if (!playing && len - off >= minFrames) playing = true;
      for (let i = 0; i < L.length; i++) {
        let v = 0;
        if (!q.length) playing = false;
        else if (playing) { const b = q[0]; v = b[off++]; if (off >= b.length) { q.shift(); len -= b.length; off = 0; } }
        L[i] = v; R[i] = v;
      }
    };
    sp.connect(ctx.destination);
    write = (f) => {
      q.push(f); len += f.length;
      while (len - off > maxFrames && q.length > 1) { len -= q[0].length; q.shift(); off = 0; }
    };
  }
  let hiddenSuspended = false;
  const resume = () => { if (ctx.state !== 'running' && !globalThis.document?.hidden) ctx.resume(); };
  for (const ev of ['pointerdown', 'keydown']) globalThis.addEventListener?.(ev, resume, { capture: true });
  // Hidden tab: the machine is paused (platform/pc.js), so the audio clock is paused too; otherwise the
  // music recording (music-out.js) would play on while the sequencer that drives it stands still.
  globalThis.document?.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (ctx.state === 'running') { hiddenSuspended = true; ctx.suspend(); } }
    else if (hiddenSuspended) { hiddenSuspended = false; ctx.resume(); }
  });
  return {
    rate,
    context: ctx,
    write(f) { if (ctx.state === 'running') write(f); },
  };
}
