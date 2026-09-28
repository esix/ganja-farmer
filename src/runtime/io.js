// Port I/O and software interrupts (IN/OUT, INT n) of the original code.
// Game/library ports never touch hardware directly: they call these functions
// with exactly the port, width, value (and register values for INT) that the
// original instruction used, in the original order. What actually happens is
// decided by a pluggable backend:
//   - platform shims (VGA DAC 0x3c8/0x3c9, retrace 0x3da, keyboard 0x60, PIC, OPL...)
//     install a backend that emulates the device;
//   - the differential tester (re/difftest/difftest.mjs) installs a recorder, so
//     every access is logged and compared with the original's IN/OUT/INT.
//
// Backend interface:
//   out(port, size, value)   size in bytes (1/2/4), value already masked
//   in(port, size) -> value
//   int(num, regs) -> regs   regs: plain object; keys are the registers the
//                            original loaded before the INT (eax/ax/al/ah, ebx..., esi, edi),
//                            return the register values after the interrupt.

const noBackend = {
  out(port) { throw new Error('io: no backend installed (OUT 0x' + port.toString(16) + ')'); },
  in(port) { throw new Error('io: no backend installed (IN 0x' + port.toString(16) + ')'); },
  int(num) { throw new Error('io: no backend installed (INT 0x' + num.toString(16) + ')'); },
};
let backend = noBackend;

// Install a backend; returns the previous one (so tests can restore it).
export function setIoBackend(b) { const prev = backend; backend = b || noBackend; return prev; }

export const outb = (port, v) => backend.out(port & 0xffff, 1, v & 0xff);
export const outw = (port, v) => backend.out(port & 0xffff, 2, v & 0xffff);
export const outd = (port, v) => backend.out(port & 0xffff, 4, v >>> 0);
export const inb = (port) => backend.in(port & 0xffff, 1) & 0xff;
export const inw = (port) => backend.in(port & 0xffff, 2) & 0xffff;
export const ind = (port) => backend.in(port & 0xffff, 4) >>> 0;
export const int86 = (num, regs = {}) => backend.int(num & 0xff, { ...regs });
