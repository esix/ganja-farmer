// 0x1556a  void sub_1556a(void)   [Watcom, no args, no return value]
// Per-call update of the 63-entry sprite array at 0x3de9c (stride 0x18c; Sprite_Init'ed in a 0x3f-iteration
// loop, decompiled.c "Sprite_Init(&DAT_0003de9c + iStack_18 * 99, ...)" — 99 dwords = 0x18c bytes), tested
// against the 26-entry sprite array at 0x3a878 (stride 0x18c; see 14425_sub_14425.js header for evidence).
// Field names from the sprite struct (LIBRARY.md): +0 x, +4 y, +8 width, +0x168 curr_frame, +0x170 state.
//   0x3de9c x, 0x3dea0 y, 0x3dea4 width, 0x3e00c state   (array A, index i)
//   0x3a878 x, 0x3a87c y, 0x3a880 width, 0x3a9e0 curr_frame, 0x3a9e8 state   (array B, index j)
// For each A[i]:
//   if state == 0: x = -200.
//   if state == 1: x += rand()%4 - rand()%4; y++ (if the old y > 0xa4: state = 0);
//     then for each B[j]: if A[i].state == 0 (re-read each j) and
//       ((A.x < B.x && B.x < A.x+A.width) || (A.x < B.x+B.width && B.x+B.width < A.x+A.width))
//       and B.state == 1 and B.y + 10 < A.y  ->  B.state = 0, B.curr_frame = 1.
//     (So the inner test can only succeed for an A[i] whose state was just set to 0 by the y check.)
// Return value: none. EAX at RET (0x15787) is a leftover (loop counter / imul result); the only call site
// (0x1d667) is followed by `call 0x15788`, which takes no register args (signatures.json regs 0) and whose
// prologue does not read EAX; signatures.json returns=false.
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';
import { imod } from '../runtime/cpu.js';

register(0x1556a, 'sub_1556a', function sub_1556a() {
  let i; // [ebp-8]
  let j; // [ebp-4]
  let r1; // EBX at 0x155f8: first rand() % 4
  let r2; // EDX at 0x1560b: second rand() % 4
  let old; // EDX at 0x1561c: y before the increment

  i = 0; // 0x15582
  j = 0; // 0x15589
  // 0x15590..0x155a3: for (i = 0; i < 0x3f; i++)  (signed jge)
  for (i = 0; i < 0x3f; i++) {
    // 0x155a9: if (A[i].state == 0) A[i].x = -200
    if (R32(0x3e00c + Math.imul(i, 0x18c)) === 0) {
      W32(0x3de9c + Math.imul(i, 0x18c), -200); // 0x155c0: 0xffffff38
    }
    // 0x155ca: if (A[i].state == 1)
    if (R32(0x3e00c + Math.imul(i, 0x18c)) === 1) {
      // 0x155e5..0x155f6: rand(); cdq; idiv 4 -> remainder (EBX)
      r1 = imod(F.rand_232c7(), 4);
      // 0x155fa..0x1560b: rand(); cdq; idiv 4 -> remainder (EDX)
      r2 = imod(F.rand_232c7(), 4);
      // 0x1560d..0x1560f: sub ebx, edx; add [A[i].x], ebx
      W32(0x3de9c + Math.imul(i, 0x18c), (R32(0x3de9c + Math.imul(i, 0x18c)) + ((r1 - r2) | 0)) | 0);
      // 0x1561c..0x15622: old = A[i].y; A[i].y++
      old = R32(0x3dea0 + Math.imul(i, 0x18c));
      W32(0x3dea0 + Math.imul(i, 0x18c), (R32(0x3dea0 + Math.imul(i, 0x18c)) + 1) | 0);
      // 0x15628: cmp old, 0xa4; jle (signed)
      if (old > 0xa4) {
        W32(0x3e00c + Math.imul(i, 0x18c), 0); // 0x15637: A[i].state = 0
      }
      // 0x15641..0x15654: for (j = 0; j < 0x1a; j++)  (signed jge)
      for (j = 0; j < 0x1a; j++) {
        // 0x1565a: A[i].state != 0 -> next j
        if (R32(0x3e00c + Math.imul(i, 0x18c)) !== 0) continue;
        // 0x1567c..0x15688: cmp A.x, B.x; jge 0x156b5
        let inRange = false;
        if (R32(0x3de9c + Math.imul(i, 0x18c)) < R32(0x3a878 + Math.imul(j, 0x18c))) {
          // 0x1568a..0x156b3: A.x + A.width > B.x -> 0x1571c (-> 0x15720)
          if (((R32(0x3de9c + Math.imul(i, 0x18c)) + R32(0x3dea4 + Math.imul(i, 0x18c))) | 0) >
              R32(0x3a878 + Math.imul(j, 0x18c))) inRange = true;
        }
        if (!inRange) {
          // 0x156b5..0x156de: B.x + B.width <= A.x -> 0x1571a (next j)
          if (((R32(0x3a878 + Math.imul(j, 0x18c)) + R32(0x3a880 + Math.imul(j, 0x18c))) | 0) >
              R32(0x3de9c + Math.imul(i, 0x18c))) {
            // 0x156e0..0x15718: A.x + A.width > B.x + B.width -> 0x1571c (-> 0x15720)
            if (((R32(0x3de9c + Math.imul(i, 0x18c)) + R32(0x3dea4 + Math.imul(i, 0x18c))) | 0) >
                ((R32(0x3a878 + Math.imul(j, 0x18c)) + R32(0x3a880 + Math.imul(j, 0x18c))) | 0)) inRange = true;
          }
        }
        // 0x1571a -> 0x1571e -> 0x15730 -> 0x15751 -> 0x15775: next j
        if (!inRange) continue;
        // 0x15720: B[j].state != 1 -> next j
        if (R32(0x3a9e8 + Math.imul(j, 0x18c)) !== 1) continue;
        // 0x15732..0x1574f: cmp B[j].y + 10, A[i].y; jl (signed) -> hit, else next j
        if (!(((R32(0x3a87c + Math.imul(j, 0x18c)) + 10) | 0) < R32(0x3dea0 + Math.imul(i, 0x18c)))) continue;
        W32(0x3a9e8 + Math.imul(j, 0x18c), 0); // 0x1575a: B[j].state = 0
        W32(0x3a9e0 + Math.imul(j, 0x18c), 1); // 0x1576b: B[j].curr_frame = 1
      }
    }
  }
});
