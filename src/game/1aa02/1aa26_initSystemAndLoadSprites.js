// main (0x1aa02) chunk I1: range [0x1aa26, 0x1af47)
// Entry 0x1aa26, single exit 0x1af47 (falls through to chunk I2, loadMenuAndGroundSprites).
// No live registers/locals at either end (MAIN_PLAN.md §2). Locals: [ebp-4], [ebp-8] (chunk-local lets).
// Contents: Set_Video_Mode(0x13), Create_Double_Buffer(0xc8), Keyboard_Install_Driver, srand(Timer_Query()),
// word stores 0x60ff0.., dws_DetectHardWare, dws_Init, dwt_Init(2) (all dws/dwt calls cdecl: `add esp` after),
// then 5 groups PCX_Init/PCX_Load/Sprite_Init/PCX_Get_Sprite loop(s)/PCX_Delete on the PCX struct at 0x31ee4,
// with rand()-based stores into the 5 sprite structs at 0x33f48 + j*0x18c and a copy loop over the 25
// sprite structs at 0x35b20 + j*0x18c.
// Callees: Set_Video_Mode, Create_Double_Buffer, Keyboard_Install_Driver, Timer_Query, srand,
// dws_DetectHardWare, dws_Init, dwt_Init, PCX_Init x5, PCX_Load x5, Sprite_Init x5 call sites,
// PCX_Get_Sprite x9 call sites, PCX_Delete x5, rand x3 call sites.
// Sprite_Init: Watcom EAX, EDX, EBX, ECX + 7 pushed args (callee pops 0x1c); the last push is the 5th arg.
// PCX_Get_Sprite: Watcom EAX, EDX, EBX, ECX + 1 pushed arg (5th).
// Sprite struct field offsets (stride 0x18c) as in Sprite_Init_20ce5: +0 x, +4 y, +0x10 c1, +0x14 c2,
// +0x28.. frame pointer table, +0x170 (LIBRARY.md / lib/20ce5_Sprite_Init.js).
import { F } from '../../runtime/registry.js';
import { R32, W16, W32 } from '../../runtime/mem.js';
import { imod } from '../../runtime/cpu.js';
import { CHOPPER } from '../states.js';
import { DETECT_OVERRIDES, SPRITE, choppers, gunSight, paratroopers, pcxScratch, sndDetectOverrides, sndDetectResults, sndIdeal, statusBar, van } from '../data.js';
import { ideal, sprite } from '../access.js';

export function initSystemAndLoadSprites() {
  let i; // [ebp-4]
  let j; // [ebp-8]

  F.Set_Video_Mode_203c6(0x13);                            // 1aa26..1aa2b
  F.Create_Double_Buffer_2156b(0xc8);                      // 1aa30..1aa35
  F.Keyboard_Install_Driver_22bd7();                       // 1aa3a
  F.srand_232eb(F.Timer_Query_235f9());              // 1aa3f, 1aa44 (EAX of Timer_Query -> srand)
  W16(sndDetectOverrides, 0xffff);                                          // 1aa49
  W16((sndDetectOverrides + DETECT_OVERRIDES.dma), 0xffff);                                          // 1aa52
  W16((sndDetectOverrides + DETECT_OVERRIDES.irq), 0xffff);                                          // 1aa5b
  F.dws_DetectHardWare_1ea27(sndDetectOverrides, sndDetectResults);            // 1aa64..1aa75 (cdecl: push 0x61000, push 0x60ff0)
  ideal(sndIdeal).musicType = 1;                                               // 1aa78
  ideal(sndIdeal).digitalType = 8;                                               // 1aa81
  ideal(sndIdeal).digitalRate = 0x2aed;                                          // 1aa8a
  ideal(sndIdeal).digitalVoices = 0x10;                                            // 1aa93
  ideal(sndIdeal).field8 = 1;                                               // 1aa9c
  F.dws_Init_1ebe4(sndDetectResults, sndIdeal);                      // 1aaa5..1aab6 (cdecl: push 0x61040, push 0x61000)
  F.dwt_Init_1ff4f(2);                                     // 1aab9..1aac4 (cdecl)

  // --- group 1: "gunsite.pcx" (0x3019c: 67 75 6e 73 69 74 65 2e 70 63 78 00), sprite struct 0x33aa4
  F.PCX_Load_20806(0x3019c /* "gunsite.pcx" */, pcxScratch, 1); // 1aad1..1aae0
  F.Sprite_Init_20ce5(gunSight, 0x8c, 0x19, 0xd, 0x11, 0, 0, 0, 0, 0, 0); // 1aae5..1ab07
  for (j = 0; j < 2; j++) {                                      // 1ab0c..1ab1f, 1ab15..1ab18 (signed jge)
    F.PCX_Get_Sprite_20c12(pcxScratch, gunSight, j, j, 0);     // 1ab21..1ab33
  }                                                              // 1ab38 jmp

  // --- group 2: "van.pcx" (0x301a8: 76 61 6e 2e 70 63 78 00), sprite struct 0x33c30
  F.PCX_Load_20806(0x301a8 /* "van.pcx" */, pcxScratch, 1);   // 1ab4e..1ab5d
  F.Sprite_Init_20ce5(van, 0x82, 0xab, 0x40, 0x1e, 0, 0, 0, 0, 0, 0); // 1ab62..1ab84
  for (j = 0; j < 1; j++) {                                      // 1ab89..1ab9c, 1ab92..1ab95 (signed jge)
    F.PCX_Get_Sprite_20c12(pcxScratch, van, j, j, 0);     // 1ab9e..1abb0
  }                                                              // 1abb5 jmp

  // --- group 3: "regbar.pcx" (0x301b0: 72 65 67 62 61 72 2e 70 63 78 00), sprite struct 0x33918
  F.PCX_Load_20806(0x301b0 /* "regbar.pcx" */, pcxScratch, 1); // 1abcb..1abda
  F.Sprite_Init_20ce5(statusBar, 1, 0, 0x13f, 0xa, 0, 0, 0, 0, 0, 0); // 1abdf..1abfe (xor ebx,ebx)
  for (j = 0; j < 1; j++) {                                      // 1ac03..1ac16, 1ac0c..1ac0f (signed jge)
    F.PCX_Get_Sprite_20c12(pcxScratch, statusBar, j, j, 0);     // 1ac18..1ac2a
  }                                                              // 1ac2f jmp

  // --- group 4: "chopper2.pcx" (0x301bb: 63 68 6f 70 70 65 72 32 2e 70 63 78 00), 5 sprite structs at
  //     0x33f48 + i*0x18c
  F.PCX_Load_20806(0x301bb /* "chopper2.pcx" */, pcxScratch, 1); // 1ac45..1ac54
  for (i = 0; i < 5; i++) {                                      // 1ac59..1ac6c, 1ac62..1ac65 (signed jge)
    F.Sprite_Init_20ce5(sprite(choppers, i).addr, 0x64, 0x14, 0x89, 0x2a, 0, 0, 0, 0, 0, 0); // 1ac72..1ac9d
    for (j = 0; j < 2; j++) {                                    // 1aca2..1acb5, 1acab..1acae (signed jge)
      F.PCX_Get_Sprite_20c12(pcxScratch, sprite(choppers, i).addr, j, j, 0); // 1acb7..1acd2
    }                                                            // 1acd7 jmp
    for (j = 2; j < 4; j++) {                                    // 1acd9..1acec, 1ace2..1ace5 (signed jge)
      F.PCX_Get_Sprite_20c12(pcxScratch, sprite(choppers, i).addr, j, (j - 2) | 0, 1); // 1acee..1ad0c
    }                                                            // 1ad11 jmp
    sprite(choppers, i).state = CHOPPER.FLYING_LEFT;              // 1ad13..1ad1a (+0x170)
    let r = F.rand_232c7();                                // 1ad24
    sprite(choppers, i).counter1 = (-1 - imod(r, 5)) | 0; // 1ad29..1ad45 (sar edx,31; idiv; 0xffffffff - edx) (+0x10)
    r = F.rand_232c7();                                    // 1ad4b
    sprite(choppers, i).y = (imod(r, 0x3c) + 0x14) | 0; // 1ad50..1ad68 (idiv; edx + 0x14) (+4)
    r = F.rand_232c7();                                    // 1ad6e
    sprite(choppers, i).x = (imod(r, 0x258) + 0x190) | 0; // 1ad73..1ad8f (idiv; edx + 0x190) (+0)
    sprite(choppers, i).counter2 = 0xa;               // 1ad95..1ad9c (+0x14)
  }                                                              // 1ada6 jmp

  // --- group 5: "ptroop.pcx" (0x301c8: 70 74 72 6f 6f 70 2e 70 63 78 00), 25 sprite structs at
  //     0x35b20 + i*0x18c; frames only cut into the first one, then copied to the others
  F.PCX_Load_20806(0x301c8 /* "ptroop.pcx" */, pcxScratch, 1); // 1adbf..1adce
  for (i = 0; i < 0x19; i++) {                                   // 1add3..1ade6, 1addc..1addf (signed jge)
    F.Sprite_Init_20ce5(sprite(paratroopers, i).addr, 0xa0, -0x32, 0x26, 0x2d, 0, 0, 0, 0, 0, 0); // 1ade8..1ae13 (ebx = 0xffffffce)
  }                                                              // 1ae18 jmp
  for (j = 0; j < 6; j++) {                                      // 1ae1a..1ae2d, 1ae23..1ae26 (signed jge)
    F.PCX_Get_Sprite_20c12(pcxScratch, paratroopers, j, j, 0);     // 1ae2f..1ae41
  }                                                              // 1ae46 jmp
  for (j = 6; j < 0xc; j++) {                                    // 1ae48..1ae5b, 1ae51..1ae54 (signed jge)
    F.PCX_Get_Sprite_20c12(pcxScratch, paratroopers, j, (j - 6) | 0, 1); // 1ae5d..1ae72
  }                                                              // 1ae77 jmp
  for (j = 0xc; j < 0x13; j++) {                                 // 1ae79..1ae8c, 1ae82..1ae85 (signed jge)
    F.PCX_Get_Sprite_20c12(pcxScratch, paratroopers, j, (j - 0xc) | 0, 2); // 1ae8e..1aea3
  }                                                              // 1aea8 jmp
  for (j = 0x13; j < 0x1b; j++) {                                // 1aeaa..1aebd, 1aeb3..1aeb6 (signed jge)
    F.PCX_Get_Sprite_20c12(pcxScratch, paratroopers, j, (j - 0x13) | 0, 3); // 1aebf..1aed4
  }                                                              // 1aed9 jmp
  // Nest 1aeea{1aeff}: outer counter [ebp-8], inner [ebp-4]; no calls.
  for (j = 1; j < 0x19; j++) {                                   // 1aedb..1aeee, 1aee4..1aee7 (signed jge)
    for (i = 0; i < 0x1b; i++) {                                 // 1aef0..1af03, 1aef9..1aefc (signed jge)
      // 1af05..1af20: edx = i<<2; ecx = j*0x18c; eax = (i<<2) + ecx; [eax+0x35b48] = [edx+0x35b48]
      W32(((i << 2) + Math.imul(j, SPRITE.SIZE) + (paratroopers + SPRITE.frames)) | 0, R32(((i << 2) + (paratroopers + SPRITE.frames)) | 0));
    }                                                            // 1af26 jmp
    sprite(paratroopers, j).numFrames = sprite(paratroopers).numFrames;      // 1af28..1af35 (+0x16c)
  }                                                              // 1af3b jmp
}
