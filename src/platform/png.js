// Minimal decoder for 8-bit indexed (palette) PNGs: the game's pictures (assets/game/*.PNG, converted from
// the original PCX files). Keeps the colour indices and the palette exactly, which a browser image
// decoder (RGBA output) would not. Inflate is the platform's DecompressionStream (browsers, Node >= 18).
//   decodeIndexedPng(bytes) -> Promise<{ width, height, pixels: Uint8Array(w*h), palette: Uint8Array(768) }>
// palette: 256 x (r, g, b), 8-bit; entries missing from PLTE are 0.

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
    } else if (type === 'IEND') {
      break;
    }
    p += 12 + len;
  }
  if (!width || !idat.length) fail('missing IHDR or IDAT');
  const raw = await inflate(idat.length === 1 ? idat[0] : new Uint8Array(await new Blob(idat).arrayBuffer()));
  if (raw.length < (width + 1) * height) fail('image data too short');

  // Undo the per-row filters (1 byte per pixel, so the "left" neighbour is the previous byte).
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
  return { width, height, pixels, palette };
}
