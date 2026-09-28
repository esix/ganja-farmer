// The game's pictures: assets/game/*.PNG (8-bit indexed, converted from the original PCX files), decoded
// once at start-up into colour indices + palette for PCX_Load (lib/20806_PCX_Load.js).
// Names are matched without the extension, case-insensitively: the program asks for "mainmnb.pcx" and
// gets MAINMNB.PNG.
import * as vfs from './vfs.js';
import { decodeIndexedPng } from './png.js';

const pictures = new Map(); // base name (upper case) -> { width, height, pixels, palette }
const baseName = (file) => file.toUpperCase().replace(/\.[^.\\/:]*$/, '');

export async function decodeAll() {
  for (const n of vfs.names()) {
    if (/\.PNG$/i.test(n)) pictures.set(baseName(n), await decodeIndexedPng(vfs.read(n), n));
  }
}

export function get(file) { return pictures.get(baseName(file)) || null; }
