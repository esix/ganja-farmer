// 0x21673  void Screen_Transition(int effect)
//          [Watcom: EAX=effect; no stack args; no return value (epilogue does not set EAX)]
// switch (effect) via jump table at 0x21904 (6 entries, `ja` = unsigned bound 5):
//   0 (0x21699): 20x { for i=1..254: Read_Color_Reg(i,&c); each component c = (c > 4) ? c-3 : 0;
//                Write_Color_Reg(i,&c) }; Time_Delay(1) }
//   1 (0x21732): 20x { for i=0..254: Read_Color_Reg(i,&c); each component c = (u8)(c+4), if > 63 -> 63;
//                Write_Color_Reg(i,&c) }; Time_Delay(1) }
//   2 (0x217c5): nothing
//   3 (0x217ca): for i=0; i<160; i+=2: Wait_For_Vertical_Retrace; V_Line(0,199,319-i,0), V_Line(0,199,i,0),
//                V_Line(0,199,318-i,0), V_Line(0,199,i+1,0)
//   4 (0x21840): for i=0; i<100; i+=2: Wait_For_Vertical_Retrace; H_Line(0,319,199-i,0), H_Line(0,319,i,0),
//                H_Line(0,319,198-i,0), H_Line(0,319,i+1,0)
//   5 (0x218b3): for i=0; i<=300000; i++: y = rand()%200; x = rand()%320; Write_Pixel(x, y, 0)
//   other (unsigned > 5): nothing
// Async: calls Time_Delay (waits on the BIOS tick) and Wait_For_Vertical_Retrace (polls port 0x3DA).
import { F, register } from '../runtime/registry.js';
import { R8, W8 } from '../runtime/mem.js';
import { stackAlloc, stackFree } from '../runtime/stack.js';
import { imod } from '../runtime/cpu.js';

register(0x21673, 'Screen_Transition_21673', async function Screen_Transition(effect) {
  const color = stackAlloc(4);  // [ebp-4]: RGB_color (3 bytes used), address passed to Read/Write_Color_Reg
  let index;                    // [ebp-0x10]
  let i;                        // [ebp-0xc]
  // 2168b..21691: [ebp-0x14] = effect; [ebp-8] = effect; 2191c: cmp [ebp-8],5; ja (unsigned)
  switch (effect >>> 0) {
    case 0:
      // 21699..216ac: for (i = 0; i < 20; i++)  -- jge: signed
      for (i = 0; i < 0x14; i = (i + 1) | 0) {
        // 216b2..216c8: for (index = 1; index < 255; index++)  -- jge: signed
        for (index = 1; index < 0xff; index = (index + 1) | 0) {
          await F.Read_Color_Reg_205a8(index, color);        // 216ca..216d0: EAX=index, EDX=&color
          // 216d5..216e5: movzx byte; cmp 4; jle -> 0, else add byte -3
          if (R8(color) > 4) W8(color, (R8(color) + 0xfd) & 0xff);
          else W8(color, 0);
          // 216e9..216f9
          if (R8(color + 1) > 4) W8(color + 1, (R8(color + 1) + 0xfd) & 0xff);
          else W8(color + 1, 0);
          // 216fd..2170d
          if (R8(color + 2) > 4) W8(color + 2, (R8(color + 2) + 0xfd) & 0xff);
          else W8(color + 2, 0);
          await F.Write_Color_Reg_20541(index, color);       // 21711..21717: EAX=index, EDX=&color
        }
        await F.Time_Delay_20404(1);                         // 2171e..21723
      }
      break;                                                 // 2172d
    case 1:
      // 21732..21745: for (i = 0; i < 20; i++)  -- jge: signed
      for (i = 0; i < 0x14; i = (i + 1) | 0) {
        // 2174b..21761: for (index = 0; index < 255; index++)  -- jge: signed
        for (index = 0; index < 0xff; index = (index + 1) | 0) {
          await F.Read_Color_Reg_205a8(index, color);        // 21763..21769
          // 2176e..2177c: add byte +4 (wraps mod 256); movzx; cmp 0x3f; jle; else = 0x3f
          W8(color, (R8(color) + 4) & 0xff);
          if (R8(color) > 0x3f) W8(color, 0x3f);
          // 21780..2178e
          W8(color + 1, (R8(color + 1) + 4) & 0xff);
          if (R8(color + 1) > 0x3f) W8(color + 1, 0x3f);
          // 21792..217a0
          W8(color + 2, (R8(color + 2) + 4) & 0xff);
          if (R8(color + 2) > 0x3f) W8(color + 2, 0x3f);
          await F.Write_Color_Reg_20541(index, color);       // 217a4..217aa
        }
        await F.Time_Delay_20404(1);                         // 217b1..217b6
      }
      break;                                                 // 217c0
    case 2:
      break;                                                 // 217c5
    case 3:
      // 217ca..217de: for (i = 0; i < 160; i += 2)  -- jge: signed
      for (i = 0; i < 0xa0; i = (i + 2) | 0) {
        await F.Wait_For_Vertical_Retrace_21937();           // 217e0
        await F.V_Line_204b7(0, 0xc7, (0x13f - i) | 0, 0);   // 217e5..217f6: EAX=0, EDX=199, EBX=319-i, ECX=0
        await F.V_Line_204b7(0, 0xc7, i, 0);                 // 217fb..21807
        await F.V_Line_204b7(0, 0xc7, (0x13f - ((i + 1) | 0)) | 0, 0); // 2180c..21822
        await F.V_Line_204b7(0, 0xc7, (i + 1) | 0, 0);       // 21827..21834
      }
      break;                                                 // 2183b
    case 4:
      // 21840..21851: for (i = 0; i < 100; i += 2)  -- jge: signed
      for (i = 0; i < 0x64; i = (i + 2) | 0) {
        await F.Wait_For_Vertical_Retrace_21937();           // 21853
        await F.H_Line_2044b(0, 0x13f, (0xc7 - i) | 0, 0);   // 21858..21869: EAX=0, EDX=319, EBX=199-i, ECX=0
        await F.H_Line_2044b(0, 0x13f, i, 0);                // 2186e..2187a
        await F.H_Line_2044b(0, 0x13f, (0xc7 - ((i + 1) | 0)) | 0, 0); // 2187f..21895
        await F.H_Line_2044b(0, 0x13f, (i + 1) | 0, 0);      // 2189a..218a7
      }
      break;                                                 // 218ae
    case 5: {
      // 218b3..218c9: for (i = 0; i <= 300000; i++)  -- jg: signed
      for (i = 0; i <= 0x493e0; i = (i + 1) | 0) {
        // 218cb: EBX = 0 (color for Write_Pixel, set before the rand calls)
        const y = imod(await F.rand_232c7(), 0xc8);          // 218cd..218e0: cdq; idiv 200 -> remainder
        const x = imod(await F.rand_232c7(), 0x140);         // 218e2..218f5: cdq; idiv 320 -> remainder
        await F.Write_Pixel_2033c(x, y, 0);                  // 218f7..218f9: EAX=x, EDX=y, EBX=0
      }
      break;                                                 // 21900
    }
    default:
      break;                                                 // 21920 ja -> 21902
  }
  stackFree(4);
});
