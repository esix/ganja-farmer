// 8259A master PIC (IRQ0..7), only as far as this program's interrupt handlers touch it.
//
// Used by the binary:
//   - Keyboard_Driver (ISR at 0x22b04) ends with outp(0x20, 0x20) at 0x22b5e..0x22b68: non-specific EOI.
//   - (STKRUN.EXE, emulated elsewhere) its INT 8 ISR sends the specific EOI 0x60 (IRQ0) when it does not
//     chain to the BIOS (STKRUN 0530:0052 `mov al,0x60; out 0x20,al`).
// The BIOS INT 8 / INT 9 handlers, which are emulated here as firmware, send a non-specific EOI.
//
// Model: IRR (requested) and ISR (in service) bits. An IRQ is dispatched only when no IRQ of equal or
// higher priority (lower number) is in service, exactly like the 8259A in fully-nested mode. The
// dispatcher sets the ISR bit before calling the handler; only an EOI clears it. So a handler that
// did not EOI blocks further IRQs of its level, as on real hardware. IMR (port 0x21) is not
// programmed by the program and is not emulated (all IRQs used here are unmasked).

let irr = 0;
let isr = 0;
const handlers = []; // irq -> function() : runs the interrupt (vector dispatch)
let dispatching = false;

export function setIrqHandler(irq, fn) { handlers[irq] = fn; }

export function request(irq) { irr |= 1 << irq; }

// OUT 0x20: OCW2. Only EOI commands are issued by this program's (and the emulated firmware's) code.
export function writeCommand(v) {
  v &= 0xff;
  if (v === 0x20) { // non-specific EOI: clear highest-priority in-service bit
    for (let i = 0; i < 8; i++) if (isr & (1 << i)) { isr &= ~(1 << i); break; }
  } else if ((v & 0xf8) === 0x60) { // specific EOI
    isr &= ~(1 << (v & 7));
  } else {
    throw new Error('pic: OCW 0x' + v.toString(16) + ' not used by the program');
  }
}

// Dispatch every pending IRQ that the priority/in-service state allows. Handlers run synchronously
// (the JS event loop guarantees they do not interrupt ported code in the middle of a statement).
export function service() {
  if (dispatching) return; // an IRQ raised from inside a handler is serviced after it returns
  dispatching = true;
  try {
    for (;;) {
      let irq = -1;
      for (let i = 0; i < 8; i++) {
        if (isr & ((2 << i) - 1)) break; // this level or a higher one is in service
        if (irr & (1 << i)) { irq = i; break; }
      }
      if (irq < 0) break;
      irr &= ~(1 << irq);
      isr |= 1 << irq;
      const h = handlers[irq];
      if (!h) throw new Error('pic: no handler for IRQ' + irq);
      h();
    }
  } finally {
    dispatching = false;
  }
}

export const inService = (irq) => (isr >> irq) & 1;
export const pending = (irq) => (irr >> irq) & 1;
export function reset() { irr = 0; isr = 0; dispatching = false; }
