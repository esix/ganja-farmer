// The game's pictures: assets/game/*.PNG (8-bit indexed, converted from the original PCX files), decoded
// once at start-up into colour indices + palette for PCX_Load (lib/20806_PCX_Load.js).
// Names are matched without the extension, case-insensitively: the program asks for "mainmnb.pcx" and
// gets MAINMNB.PNG, or the frame named MAINMNB in an animated PNG (MAINMENU.PNG).
import * as vfs from './vfs.js';
import { decodeIndexedPng } from './png.js';

const pictures = new Map(); // base name (upper case) -> { width, height, pixels, palette }
const baseName = (file) => file.toUpperCase().replace(/\.[^.\\/:]*$/, '');

export async function decodeAll() {
  for (const n of vfs.names()) {
    if (!/\.PNG$/i.test(n)) continue;
    const pic = await decodeIndexedPng(vfs.read(n), n);
    pictures.set(baseName(n), pic);
    // An animated PNG supplies each named frame as a picture of its own (MAINMENU.PNG: mainmnb2.pcx, ...).
    for (const f of pic.frames ?? []) {
      if (f.name) pictures.set(f.name.toUpperCase(), { width: pic.width, height: pic.height, pixels: f.pixels, palette: pic.palette });
    }
  }
}

export function get(file) { return pictures.get(baseName(file)) || null; }

// Which picture a pcx_picture struct holds (stage 2: PCX_Load binds, the readers look up; there is no pixel
// buffer in emulated memory any more). Pixels are 64001 bytes: the picture plus the 0x0C byte the original
// decoder left at buf[64000].
const bound = new Map(); // struct address -> Uint8Array(64001)
export function bind(img, pic) {
  const px = new Uint8Array(64001);
  px.set(pic.pixels);
  px[64000] = 0x0c;
  bound.set(img >>> 0, px);
}
export function pictureOf(img) {
  const px = bound.get(img >>> 0);
  if (!px) throw new Error(`pcx_picture 0x${(img >>> 0).toString(16)}: no picture loaded`);
  return px;
}
