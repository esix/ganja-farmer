// VGA scan-out: continuously displays video memory through the current DAC palette, like the monitor
// does. The game never "presents"; it writes video memory, and this shows whatever is there.
//   mode 13h: the 320x200 framebuffer at 0xA0000
//   mode 03h: the text buffer at 0xB8000 (textmode.js; drawn 640x200 with the 8x8 ROM font)
import { u8, VGA_BASE } from '../runtime/mem.js';
import * as vga from './vga.js';
import * as text from './textmode.js';

// DAC palette: 256 entries x (r,g,b), 6-bit values (0..63) as programmed via
// ports 0x3C8/0x3C9. Owned here; the port I/O shim writes into it.
export const dac = new Uint8Array(768);

const rgba = new Uint32Array(256);

function buildLut() {
  for (let i = 0; i < 256; i++) {
    // 6-bit to 8-bit: VGA DACs output c*255/63; use the exact scaling.
    const r = Math.round(dac[i * 3] * 255 / 63);
    const g = Math.round(dac[i * 3 + 1] * 255 / 63);
    const b = Math.round(dac[i * 3 + 2] * 255 / 63);
    rgba[i] = 0xff000000 | (b << 16) | (g << 8) | r; // little-endian ABGR
  }
}

const frame13 = new Uint32Array(320 * 200);
const frameText = new Uint32Array(text.WIDTH * text.HEIGHT);

// Current picture: { width, height, pixels (Uint32Array, ABGR little-endian = RGBA bytes) }.
export function renderFrame() {
  buildLut();
  if (vga.videoMode === 0x03) {
    text.render(frameText, rgba);
    return { width: text.WIDTH, height: text.HEIGHT, pixels: frameText };
  }
  for (let i = 0; i < 64000; i++) frame13[i] = rgba[u8[VGA_BASE + i]];
  return { width: 320, height: 200, pixels: frame13 };
}

// Presentation on the page ("sharp bilinear"): the monitor shows 320x200 (or the 640x200 text picture) on a
// 4:3 screen, i.e. pixels 1.2x taller than wide (index.html sizes the canvas box to 4:3). Scaling the
// 320x200 picture straight to that box with nearest-neighbour gives uneven pixel rows/columns (e.g. rows
// alternating 3 and 4 device pixels); plain bilinear blurs. Instead each frame is first enlarged by whole
// numbers kx, ky (every source pixel becomes exactly kx x ky canvas pixels, nearest-neighbour), with kx, ky
// the smallest integers that reach the box size in device pixels; the browser then shrinks that canvas
// into the box with its normal (smooth) filtering, which only softens the one-device-pixel seams between
// source pixels. This is a display choice of the port (no counterpart in the program).
let canvas = null, ctx = null, img = null;
let src = null, sctx = null; // the frame at 1:1 (video memory through the DAC)

function makeCanvas(w, h) {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : canvas.ownerDocument.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function scanOut() {
  if (!ctx) return;
  const f = renderFrame();
  if (!src || src.width !== f.width || src.height !== f.height) {
    src = makeCanvas(f.width, f.height);
    sctx = src.getContext('2d');
    img = sctx.createImageData(f.width, f.height);
  }
  new Uint32Array(img.data.buffer).set(f.pixels);
  sctx.putImageData(img, 0, 0);
  const r = canvas.getBoundingClientRect();
  const dpr = globalThis.devicePixelRatio || 1;
  const kx = Math.min(16, Math.max(1, Math.ceil(r.width * dpr / f.width)));
  const ky = Math.min(16, Math.max(1, Math.ceil(r.height * dpr / f.height)));
  const w = f.width * kx, h = f.height * ky;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  ctx.imageSmoothingEnabled = false; // reset by a size change; nearest-neighbour for the integer step
  ctx.drawImage(src, 0, 0, w, h);
}

export function attach(c) {
  canvas = c;
  canvas.width = 320;
  canvas.height = 200;
  ctx = canvas.getContext('2d');
  src = null;
  const loop = () => { scanOut(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
