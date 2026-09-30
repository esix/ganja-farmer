// Minimal decoder for 8-bit indexed (palette) PNGs: the game's pictures (assets/game/*.PNG, converted from
// the original PCX files). Keeps the colour indices and the palette exactly, which a browser image
// decoder (RGBA output) would not. Inflate is the platform's DecompressionStream (browsers, Node >= 18).
//   decodeIndexedPng(bytes) -> Promise<{ width, height, pixels: Uint8Array(w*h), palette: Uint8Array(768),
//                                        frames?: [{ name, pixels }] }>
// palette: 256 x (r, g, b), 8-bit; entries missing from PLTE are 0.
// Animated PNG (APNG): `frames` holds every frame composed to full size (blend SOURCE / OVER with tRNS alpha 0,
// dispose NONE / BACKGROUND / PREVIOUS); a tEXt chunk "Frames" with comma-separated names names them
// (tools/make-apng.mjs). `pixels` is then the default image (frame 0).

const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

async function inflate(data) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export async function decodeIndexedPng(bytes, name = 'PNG') {
  const fail = (why) => { throw new Error(`${name}: ${why}`); };
  for (let i = 0; i < 8; i++) if (bytes[i] !== SIG[i]) fail('not a PNG file');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0, height = 0;
  const palette = new Uint8Array(768);
  const idat = [];
  let animated = false, frameNames = [], trns = null;
  const fctls = [];     // { w, h, x, y, dispose, blend, data: [] }
  for (let p = 8; p + 8 <= bytes.length;) {
    const len = dv.getUint32(p);
    const type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
    const body = bytes.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = dv.getUint32(p + 8); height = dv.getUint32(p + 12);
      const depth = body[8], colorType = body[9], interlace = body[12];
      if (depth !== 8 || colorType !== 3) fail(`must be an 8-bit indexed (palette) PNG, got depth ${depth} colour type ${colorType}`);
      if (interlace !== 0) fail('interlaced PNGs are not supported');
    } else if (type === 'PLTE') {
      palette.set(body.subarray(0, Math.min(768, body.length)));
    } else if (type === 'IDAT') {
      idat.push(body);
      if (fctls.length) fctls[fctls.length - 1].data.push(body);
    } else if (type === 'acTL') {
      animated = true;
    } else if (type === 'fcTL') {
      const d = new DataView(body.buffer, body.byteOffset, body.byteLength);
      fctls.push({ w: d.getUint32(4), h: d.getUint32(8), x: d.getUint32(12), y: d.getUint32(16), dispose: body[24], blend: body[25], data: [] });
    } else if (type === 'fdAT') {
      if (fctls.length) fctls[fctls.length - 1].data.push(body.subarray(4));
    } else if (type === 'tRNS') {
      trns = body;
    } else if (type === 'tEXt') {
      const z = body.indexOf(0);
      const key = String.fromCharCode(...body.subarray(0, z));
      if (key === 'Frames') frameNames = String.fromCharCode(...body.subarray(z + 1)).split(',');
    } else if (type === 'IEND') {
      break;
    }
    p += 12 + len;
  }
  if (!width || !idat.length) fail('missing IHDR or IDAT');
  const concat = async (parts) => (parts.length === 1 ? parts[0] : new Uint8Array(await new Blob(parts).arrayBuffer()));
  const pixels = unfilter(await inflate(await concat(idat)), width, height, fail);
  if (!animated) return { width, height, pixels, palette };

  // APNG: compose the frames on a canvas.
  const transparent = (v) => trns !== null && v < trns.length && trns[v] === 0;
  let canvas = new Uint8Array(width * height);
  const frames = [];
  for (let k = 0; k < fctls.length; k++) {
    const f = fctls[k];
    if (f.x + f.w > width || f.y + f.h > height) fail(`frame ${k} outside the image`);
    const px = unfilter(await inflate(await concat(f.data)), f.w, f.h, fail);
    const before = f.dispose === 2 ? canvas.slice() : null;
    for (let y = 0; y < f.h; y++) {
      for (let x = 0; x < f.w; x++) {
        const v = px[y * f.w + x];
        if (f.blend === 1 && transparent(v)) continue;
        canvas[(f.y + y) * width + f.x + x] = v;
      }
    }
    frames.push({ name: frameNames[k] ?? null, pixels: canvas.slice() });
    if (f.dispose === 1) for (let y = 0; y < f.h; y++) canvas.fill(0, (f.y + y) * width + f.x, (f.y + y) * width + f.x + f.w);
    else if (f.dispose === 2) canvas = before;
  }
  return { width, height, pixels, palette, frames };
}

// Undo the per-row filters (1 byte per pixel, so the "left" neighbour is the previous byte).
function unfilter(raw, width, height, fail) {
  if (raw.length < (width + 1) * height) fail('image data too short');
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (width + 1)];
    const src = y * (width + 1) + 1, dst = y * width, up = dst - width;
    for (let x = 0; x < width; x++) {
      const a = x > 0 ? pixels[dst + x - 1] : 0;
      const b = y > 0 ? pixels[up + x] : 0;
      const c = x > 0 && y > 0 ? pixels[up + x - 1] : 0;
      const v = raw[src + x];
      switch (f) {
        case 0: pixels[dst + x] = v; break;
        case 1: pixels[dst + x] = v + a; break;
        case 2: pixels[dst + x] = v + b; break;
        case 3: pixels[dst + x] = v + ((a + b) >> 1); break;
        case 4: pixels[dst + x] = v + paeth(a, b, c); break;
        default: fail(`bad filter type ${f} in row ${y}`);
      }
    }
  }
  return pixels;
}
