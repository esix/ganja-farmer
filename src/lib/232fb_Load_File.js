// 0x232fb  int Load_File(char *name, uchar **out)
//          [Watcom: EAX=name, EDX=out; EAX=1 on return (LIBRARY.md: "always 1"; signatures.json says no return,
//           but 0x23380/0x23387 load 1 into EAX before RET)]
// fp = fopen(name, "rb"); fseek(fp, 0, SEEK_END); size = ftell(fp); *out = malloc(size & 0xFFFF);
// fseek(fp, 0, SEEK_SET); fread(*out, size & 0xFFFF, 1, fp); fclose(fp); return 1.
// No error checks. Used to load .DWD / .DWM files (LIBRARY.md). The name is descriptive (LIBRARY.md).
import { F, register } from '../runtime/registry.js';
import { R32, W32 } from '../runtime/mem.js';

register(0x232fb, 'Load_File_232fb', function Load_File_232fb(name, out) {
  let fp; // [ebp-8]
  let size; // [ebp-4]
  let result; // [ebp-0xc]

  // 0x23318: EDX = 0x307bc ("rb"), EAX = name
  fp = F.fopen_2264a(name, 0x307bc /* "rb" */);
  // 0x23328: EBX = 2, EDX = 0 -> fseek(fp, 0, 2)
  F.fseek_23ee1(fp, 0, 2);
  size = F.ftell_24b81(fp);
  // 0x23342: xor eax,eax; mov ax,[ebp-4] -> low 16 bits of size, zero-extended
  // ORIGINAL BUG: size is truncated to 16 bits for malloc and fread; a file of 64 KB or more is loaded
  // only partially (harmless for the game's DWD/DWM files, which are smaller - LIBRARY.md).
  W32(out, F.malloc_23dab(size & 0xffff));
  // 0x23354: EBX = 0, EDX = 0 -> fseek(fp, 0, 0)
  F.fseek_23ee1(fp, 0, 0);
  // 0x23360: ECX = fp, EBX = 1, EDX = size & 0xffff (xor edx,edx; mov dx,[ebp-4]), EAX = *out
  F.fread_1e110(R32(out), size & 0xffff, 1, fp);
  F.fclose_228ed(fp);
  result = 1;
  return result;
});
