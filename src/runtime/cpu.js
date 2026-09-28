// Cooperative scheduling. The original busy-waits on memory written by
// interrupt handlers (timer, keyboard, mouse) and on the clock. In JS such a
// loop must yield so that "interrupts" (browser events, timers) can run.
// Rule: every loop whose exit condition depends on ISR-updated state or time
// contains `await yieldCpu()` in its body.

let channel = null;
let pending = [];

// The host (boot.js / the headless runner) may replace how a yield is performed, e.g. to advance a
// virtual clock and deliver the interrupts that became due. The hook returns a promise.
let hook = null;
export function setYieldHook(fn) { hook = fn; }

export function yieldCpu() {
  if (hook) return hook();
  return hostYield();
}

// Default: give the host event loop one turn (a macrotask), so timers and input events can run.
export function hostYield() {
  if (typeof MessageChannel === 'undefined') return new Promise((r) => setTimeout(r, 0));
  if (!channel) {
    channel = new MessageChannel();
    channel.port1.onmessage = () => {
      const p = pending;
      pending = [];
      for (const r of p) r();
    };
  }
  return new Promise((r) => {
    pending.push(r);
    channel.port2.postMessage(0);
  });
}

// C integer helpers.
export const i32 = (v) => v | 0;
export const u32 = (v) => v >>> 0;
// LATENT (audit round1 F-risky F9): idiv(INT_MIN, -1) gives INT_MIN and imod(INT_MIN, -1) gives 0 where the
// x86 raises #DE; unreachable — every idiv/imod call in src has a positive constant divisor.
export const idiv = (a, b) => { if ((b | 0) === 0) throw new Error('divide error'); return (a / b) | 0; };
export const imod = (a, b) => { if ((b | 0) === 0) throw new Error('divide error'); return (a % b) | 0; };
export const imul = Math.imul;
