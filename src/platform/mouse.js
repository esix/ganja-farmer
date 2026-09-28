// INT 33h mouse driver (Microsoft Mouse driver interface), only the functions the program calls.
//
// All calls come from Squeeze_Mouse 0x230df through int386(0x33) (0x23d5d); inregs only AX is set:
//   AX=0000h reset         0x2311c   from Squeeze_Mouse(0,..) at 0x11755, 0x1cd1d; stores BX -> *buttons
//   AX=0002h hide cursor   0x2316d   from Squeeze_Mouse(2,..) at 0x11765, 0x1cd2d
//   AX=0003h position/btn  0x2318f   from Squeeze_Mouse(3,..) at 0x10d8e, 0x118b0, 0x1d147:
//                                    *x = CX (0x60b48), *y = DX (0x60b4c), *buttons = BX (0x60b50)
// Squeeze_Mouse also has cases for AX=0001h, 000Bh and 001Ah, but no call site passes those commands,
// so they are not emulated (a call throws).
// PMODE/W passes INT 33h from protected mode to the real-mode driver with the general registers
// (none of these functions takes a pointer, so no translation is involved).
//
// Semantics (MS Mouse driver interface; coordinate/granularity rules as in DOSBox src/ints/mouse.cpp):
//   - Coordinates are "virtual screen" coordinates. In mode 13h the virtual screen is 640x200: x runs
//     0..639 and only even values are reported (DOSBox: granularity mask 0xFFFE for modes 0Dh/13h),
//     y runs 0..199. (The program converts with (x>>1)-16.)
//   - Reset: AX = FFFFh (driver installed), BX = number of buttons of the attached mouse: 2 for a
//     two-button Microsoft-compatible mouse (CuteMouse ctmouse.asm, "00 - Reset driver and read status":
//     "[BX] = 2/3/FFFFh (number of buttons)", buttonscnt = 2 or 3 from the detected hardware; local copy
//     re/ref/ctmouse.asm lines 2561-2566, 2192-2200). DOSBox/DOSBox-X return 3 (MOUSE_BUTTONS), which
//     models a 3-button mouse. Not observable by the game: Squeeze_Mouse(0) stores BX to 0x60b50, and
//     a control-flow walk (recursive descent, incl. the jump table at 0x11870) finds no read of 0x60b50
//     (cmp with 1/2) between reset 0x11755 and fn 3 at 0x118b0 in 0x11659, nor between reset 0x1cd1d
//     and fn 3 at 0x1d147 in main; the other readers are 0x10cac (calls fn 3 at 0x10d8e before its reads)
//     and 0x18f27 (reached only from main: 0x1d630 and 0x15c7d->0x15e15; neither call lies on a path
//     from reset 0x1cd1d that avoids fn 3 at 0x1d147). Cursor hidden (hide counter -1),
//     moved to the screen centre (320,100), ranges reset to the full virtual screen.
//   - Hide: decrements the show counter. The cursor is never shown by this program (fn 1 is never
//     called), so no cursor is ever drawn into video memory.
//   - Get position: BX = button state (bit 0 left, bit 1 right), CX = x, DX = y.
import { loadRegs, outRegs, set16 } from './regs.js';
import * as vga from './vga.js';

let x = 0, y = 0;
let buttons = 0;
let showCount = -1;
let maxX = 639, maxY = 199, granX = 0xffff;

// Host pointer position as fractions of the canvas (set by browser events; may lie outside 0..1 when the
// pointer is outside the canvas). null = the host pointer has not been seen yet.
let hostFx = null, hostFy = null;

// Position update like CuteMouse's updateposition/@savecutpos (re/ref/ctmouse.asm lines 1058-1071): the
// new position is cut to [rangemin, rangemax] (after a reset: 0..639 x 0..199), then granulated
// (granpos = pos & granumask; applied in fn 3 below).
function applyHost() {
  if (hostFx === null) return;
  x = Math.min(maxX, Math.max(0, Math.floor(hostFx * (maxX + 1))));
  y = Math.min(maxY, Math.max(0, Math.floor(hostFy * (maxY + 1))));
}

export function int33(regs) {
  const s = loadRegs(regs);
  const ax = s.eax & 0xffff;
  switch (ax) {
    case 0x0000: {
      // virtual screen for the current mode; the program resets only in mode 13h (after 0x1aa2b)
      if (vga.videoMode === 0x13) { maxX = 639; maxY = 199; granX = 0xfffe; }
      else throw new Error('mouse: reset in video mode 0x' + vga.videoMode.toString(16) + ' (not used by the program)');
      // CuteMouse softreset_21 (ctmouse.asm lines 2443-2472): rangemax = 639/199, position = the middle
      // (shr cx,1 / shr dx,1 -> 320,100), mickey counters and rounding errors cleared; later motion is
      // added to that position.
      x = (maxX + 1) >> 1; y = (maxY + 1) >> 1;
      // Host sync after a reset (port decision, see "host input" below): the port maps the host pointer
      // absolutely, so the host position (if the pointer has been seen) is NOT discarded here; the next
      // fn 3 reports it again. With the host cursor hidden over the canvas (index.html) the game's arrow
      // therefore stays where the player's pointer is, instead of showing the centre and then jumping to
      // the pointer on the first motion. UNCERTAIN/deviation: on the original the first fn 3 after a
      // reset returns (320,100) until the mouse moves, and motion is relative to it. If the host pointer
      // has not been seen since page load, the centre is reported until it is (as on the original).
      showCount = -1;
      s.eax = set16(s.eax, 0xffff);
      s.ebx = set16(s.ebx, 2);
      break;
    }
    case 0x0002:
      showCount--;
      break;
    case 0x0003:
      applyHost();
      s.ebx = set16(s.ebx, buttons);
      s.ecx = set16(s.ecx, x & granX);
      s.edx = set16(s.edx, y);
      break;
    default:
      throw new Error('mouse: INT 33h AX=0x' + ax.toString(16) + ' is not used by the program');
  }
  return outRegs(s);
}

// ---- host input ---------------------------------------------------------------------------------
// The browser pointer stands in for the mouse: its position over the canvas maps linearly onto the
// virtual screen (canvas width -> 640 units, height -> 200 units). UNCERTAIN: a real mouse reports
// relative motion (mickeys, default 8 mickeys per 8 virtual x units and 16 per 8 y units, plus the
// driver's speed doubling); absolute mapping is used so the game cursor follows the host pointer.
// Outside the canvas the position is cut to the virtual range (a real mouse cursor cannot leave the
// screen: it stops at 0/639, 0/199, applyHost).
export function hostMove(fx, fy) { // fx, fy: fractions of the canvas (0..1 inside it)
  hostFx = fx; hostFy = fy;
}
export function hostButtons(mask) { buttons = mask & 3; }

// Browser wiring:
//   - pointermove is taken on the whole window, so motion outside the canvas moves the position to the
//     edge instead of freezing it at the last in-canvas sample.
//   - pointerdown on the canvas captures the pointer (setPointerCapture): the button release is then
//     delivered even when it happens outside the canvas/window, as a real mouse button's release is.
//   - buttons are taken from events on the canvas or while it holds the capture (a press that started
//     elsewhere on the page and is dragged in still counts once over the canvas, as before);
//     lostpointercapture (e.g. focus lost mid-drag) and window blur release the buttons.
export function attach(canvas) {
  const win = canvas.ownerDocument?.defaultView ?? globalThis;
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    hostMove((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  };
  // PointerEvent.buttons: 1 left, 2 right -> driver bits 0, 1 (2-button driver: middle not reported)
  const ours = (e) => e.target === canvas || canvas.hasPointerCapture?.(e.pointerId);
  const move = (e) => { pos(e); if (ours(e)) hostButtons(e.buttons & 3); };
  const down = (e) => {
    pos(e); hostButtons(e.buttons & 3);
    try { canvas.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    e.preventDefault();
  };
  const up = (e) => { pos(e); hostButtons(e.buttons & 3); };
  const lost = () => hostButtons(0);
  const ctx = (e) => e.preventDefault();
  win.addEventListener('pointermove', move);
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('lostpointercapture', lost);
  win.addEventListener('blur', lost);
  canvas.addEventListener('contextmenu', ctx);
  return () => {
    win.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('lostpointercapture', lost);
    win.removeEventListener('blur', lost);
    canvas.removeEventListener('contextmenu', ctx);
  };
}

export const state = () => ({ x, y, buttons, showCount, maxX, maxY });
export function reset() { x = 0; y = 0; buttons = 0; showCount = -1; maxX = 639; maxY = 199; granX = 0xffff; hostFx = hostFy = null; }
