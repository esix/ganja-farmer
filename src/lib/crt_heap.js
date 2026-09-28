// Watcom C runtime heap: malloc 0x23dab, free 0x23ff0.
//
// Behaviour taken from this binary's malloc (0x23dab):
//   - malloc(0) returns NULL (0x23dbb: test eax,eax; je -> xor eax,eax).
//   - a request above 0xFFFFFFD4 (unsigned) returns NULL (0x23dbf: cmp eax,-0x2c; jbe).
//   - block size = (n + 0xB) & ~7, at least 0x10 (0x23dcb..0x23dd6): a 4-byte size tag plus the data,
//     rounded up to 8 bytes.
//   - memory is NOT cleared (nothing in malloc writes the user area).
//   - when the heap cannot grow, NULL is returned (the _nmemneed hook 0x26a20 is `xor eax,eax; ret`),
//     and errno is not set.
//   - free(NULL) does nothing (0x23ff6: test eax,eax; je).
// Not reproduced: the Watcom heap's internal layout (heap "miniheaps" at [0x3114c]/[0x31150], rover
// [0x65150], free-list links), the addresses it hands out, and the order in which freed blocks are reused.
// The game only stores the returned pointers and tests them against 0; it never depends on their
// values, so a different allocator is sufficient. Blocks live in mem.js space [HEAP_BASE, MEM_SIZE).
//
// This allocator: each block = 4-byte tag (block size | 1 while in use) + data; the first block starts
// at HEAP_BASE + 4 so user pointers are 8-byte aligned; first fit over the freed blocks (address order),
// splitting when at least 0x10 bytes remain; adjacent free blocks are merged; the top of the heap is
// lowered when its last block is freed.
import { register } from '../runtime/registry.js';
import { R32u, W8, W32, HEAP_BASE, MEM_SIZE } from '../runtime/mem.js';

const START = HEAP_BASE + 4;
let top = START; // end of the highest block
let freeList = []; // sorted block addresses of free blocks

export function heapReset() { top = START; freeList = []; }

function blockSize(n) {
  let s = ((n + 0xb) & ~7) >>> 0;
  if (s < 0x10) s = 0x10;
  return s;
}

// Byte [0x65210]: set to 0 at the end of every malloc that got past the size checks (0x23e77) and of every
// free of a non-NULL pointer (0x240e0). Nothing in the image reads it (the only references to 0x65210 are
// these two stores); it is written for memory-image fidelity.
export function malloc(n) {
  n >>>= 0;
  if (n === 0 || n > 0xffffffd4) return 0;
  const r = mallocBlock(n);
  W8(0x65210, 0);
  return r;
}
function mallocBlock(n) {
  const need = blockSize(n);
  for (let i = 0; i < freeList.length; i++) {
    const b = freeList[i];
    const size = R32u(b) & ~7;
    if (size >= need) {
      if (size - need >= 0x10) {
        W32(b + need, (size - need) >>> 0); // remainder stays free
        freeList[i] = b + need;
        W32(b, need | 1);
      } else {
        freeList.splice(i, 1);
        W32(b, size | 1);
      }
      return b + 4;
    }
  }
  if (top + need > MEM_SIZE) return 0;
  const b = top;
  top += need;
  W32(b, need | 1);
  return b + 4;
}

export function free(p) {
  p >>>= 0;
  if (p === 0) return;
  freeBlock(p);
  W8(0x65210, 0);
}
function freeBlock(p) {
  const b = p - 4;
  if (b < START || b >= top) return; // UNCERTAIN: not a heap pointer; the original's handling is not modelled
  const tag = R32u(b);
  if ((tag & 1) === 0) return; // already free (UNCERTAIN: double free not modelled)
  let size = tag & ~7;
  W32(b, size);
  // insert in address order, merge with neighbours
  let i = 0;
  while (i < freeList.length && freeList[i] < b) i++;
  freeList.splice(i, 0, b);
  if (i + 1 < freeList.length && b + size === freeList[i + 1]) {
    size += R32u(freeList[i + 1]) & ~7;
    W32(b, size);
    freeList.splice(i + 1, 1);
  }
  if (i > 0) {
    const pb = freeList[i - 1];
    const ps = R32u(pb) & ~7;
    if (pb + ps === b) {
      W32(pb, ps + size);
      freeList.splice(i, 1);
      i--;
    }
  }
  const last = freeList[freeList.length - 1];
  if (last !== undefined && last + (R32u(last) & ~7) === top) {
    top = last;
    freeList.pop();
  }
}

register(0x23dab, 'malloc_23dab', function malloc_23dab(n) { return malloc(n); });
register(0x23ff0, 'free_23ff0', function free_23ff0(p) { free(p); });
