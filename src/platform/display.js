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

// Change detection: the scan-out only redraws when the picture can differ from the last one drawn, i.e.
// when the video mode, the DAC or the displayed memory changed (stage 2 optimization: the game writes
// ~9 frames/s, the browser asks for 60+). Text mode has no blink/cursor emulation, so it is static too.
const lastVram = new Uint32Array(64000 / 4);
const lastText = new Uint32Array(80 * 25 * 2 / 4);
const lastDac = new Uint8Array(768);
let lastMode = -1;
const vram32 = new Uint32Array(u8.buffer, VGA_BASE, 64000 / 4);
const text32 = new Uint32Array(u8.buffer, 0xb8000, 80 * 25 * 2 / 4);

function sameAndCopy(cur, last) {
  let same = true;
  for (let i = 0; i < cur.length; i++) if (cur[i] !== last[i]) { same = false; break; }
  if (!same) last.set(cur);
  return same;
}

// True if the picture may have changed since the previous call that returned true.
export function frameChanged() {
  const mode = vga.videoMode;
  let changed = mode !== lastMode;
  lastMode = mode;
  if (!sameAndCopy(dac, lastDac)) changed = true;
  if (!sameAndCopy(mode === 0x03 ? text32 : vram32, mode === 0x03 ? lastText : lastVram)) changed = true;
  return changed;
}

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
// 4:3 screen, i.e. pixels 1.2x taller than wide (index.html sizes the canvas box to 4:3). Nearest-neighbour
// scaling to that box gives uneven pixel rows/columns (e.g. rows alternating 3 and 4 device pixels); plain
// bilinear blurs. "Sharp bilinear" keeps every source pixel a solid block and only blends across the one
// device pixel where two source pixels meet. This is a display choice of the port (no counterpart in the
// program).
//   WebGL (default): the frame is uploaded as a texture only when it changed, and a fragment shader does the
//     sharp-bilinear sampling directly at the canvas's device-pixel size.
//   2D canvas (fallback): enlarge by whole numbers kx, ky with nearest-neighbour into the canvas, and let the
//     browser shrink that into the box with its smooth filtering.
let canvas = null;
let gl = null, glProg = null, glTex = null, glU = null;
let ctx = null, src = null, sctx = null, img = null; // 2D fallback
let drawnW = 0, drawnH = 0, texW = 0, texH = 0;

function makeCanvas(w, h) {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : canvas.ownerDocument.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

const VS = `attribute vec2 p; varying vec2 uv;
void main() { uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `precision highp float;
uniform sampler2D tex; uniform vec2 srcSize; uniform vec2 dstSize; varying vec2 uv;
void main() {
  vec2 scale = dstSize / srcSize;           // device pixels per source pixel
  vec2 texel = uv * srcSize;
  vec2 base = floor(texel);
  vec2 d = fract(texel) - 0.5;
  vec2 r = max(0.5 - 0.5 / scale, 0.0);
  vec2 f = (d - clamp(d, -r, r)) * scale + 0.5; // flat inside a source pixel, a 1-device-pixel ramp at edges
  gl_FragColor = texture2D(tex, (base + f) / srcSize);
}`;

function initGl() {
  const g = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false });
  if (!g) return false;
  const sh = (type, code) => {
    const o = g.createShader(type); g.shaderSource(o, code); g.compileShader(o);
    if (!g.getShaderParameter(o, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(o));
    return o;
  };
  const prog = g.createProgram();
  g.attachShader(prog, sh(g.VERTEX_SHADER, VS));
  g.attachShader(prog, sh(g.FRAGMENT_SHADER, FS));
  g.linkProgram(prog);
  if (!g.getProgramParameter(prog, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(prog));
  g.useProgram(prog);
  const buf = g.createBuffer();
  g.bindBuffer(g.ARRAY_BUFFER, buf);
  g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW); // one covering triangle
  const loc = g.getAttribLocation(prog, 'p');
  g.enableVertexAttribArray(loc);
  g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
  glTex = g.createTexture();
  g.bindTexture(g.TEXTURE_2D, glTex);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
  glU = { srcSize: g.getUniformLocation(prog, 'srcSize'), dstSize: g.getUniformLocation(prog, 'dstSize') };
  gl = g; glProg = prog;
  return true;
}

// Canvas backing store in device pixels for its CSS box.
function deviceSize() {
  const r = canvas.getBoundingClientRect();
  const dpr = globalThis.devicePixelRatio || 1;
  return [Math.max(1, Math.round(r.width * dpr)), Math.max(1, Math.round(r.height * dpr))];
}

function drawGl(force) {
  const [w, h] = deviceSize();
  const resized = w !== drawnW || h !== drawnH;
  if (!frameChanged() && !resized && !force) return;
  if (resized) { canvas.width = w; canvas.height = h; drawnW = w; drawnH = h; }
  const f = renderFrame();
  const bytes = new Uint8Array(f.pixels.buffer, f.pixels.byteOffset, f.pixels.byteLength);
  if (f.width !== texW || f.height !== texH) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, f.width, f.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    texW = f.width; texH = f.height;
  } else {
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, f.width, f.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  }
  gl.viewport(0, 0, w, h);
  gl.uniform2f(glU.srcSize, f.width, f.height);
  gl.uniform2f(glU.dstSize, w, h);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function draw2d(force) {
  const r = canvas.getBoundingClientRect();
  const dpr = globalThis.devicePixelRatio || 1;
  const fw = vga.videoMode === 0x03 ? text.WIDTH : 320, fh = vga.videoMode === 0x03 ? text.HEIGHT : 200;
  const kx = Math.min(16, Math.max(1, Math.ceil(r.width * dpr / fw)));
  const ky = Math.min(16, Math.max(1, Math.ceil(r.height * dpr / fh)));
  const w = fw * kx, h = fh * ky;
  const resized = canvas.width !== w || canvas.height !== h;
  if (!frameChanged() && !resized && !force) return;
  const f = renderFrame();
  if (!src || src.width !== f.width || src.height !== f.height) {
    src = makeCanvas(f.width, f.height);
    sctx = src.getContext('2d');
    img = sctx.createImageData(f.width, f.height);
  }
  new Uint32Array(img.data.buffer).set(f.pixels);
  sctx.putImageData(img, 0, 0);
  if (resized) { canvas.width = w; canvas.height = h; }
  ctx.imageSmoothingEnabled = false; // reset by a size change; nearest-neighbour for the integer step
  ctx.drawImage(src, 0, 0, w, h);
}

// Draws the current picture if it (or the canvas size) changed; force redraws unconditionally.
export function scanOut(force = false) {
  if (gl) drawGl(force);
  else if (ctx) draw2d(force);
}

export function attach(c) {
  canvas = c;
  gl = null; ctx = null; src = null; drawnW = drawnH = texW = texH = 0; lastMode = -1;
  let ok = false;
  try { ok = initGl(); } catch (e) { console.warn('WebGL display unavailable, using 2D canvas:', e); gl = null; }
  if (!ok) { canvas.width = 320; canvas.height = 200; ctx = canvas.getContext('2d'); }
  // A lost WebGL context (GPU reset) would leave the canvas blank: redraw everything once it is restored.
  canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
  canvas.addEventListener('webglcontextrestored', () => { initGl(); texW = texH = 0; scanOut(true); });
  const loop = () => { scanOut(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
