// 0x22bd7  void Keyboard_Install_Driver(void)
// Zeroes keyboard_state[128] (0x64f04, dwords), then installs Keyboard_Driver (0x22b04). Stage 1 did this
// through INT 21h AH=35h/25h (saving the old INT 9 vector at 0x64efc:0x64ef8); stage 2 connects the
// driver to the keyboard directly (platform/kbd.js setGameHandler) and no vector is saved.
import { F, register } from '../runtime/registry.js';
import { W32 } from '../runtime/mem.js';
import { setGameHandler } from '../platform/kbd.js';

register(0x22bd7, 'Keyboard_Install_Driver_22bd7', function Keyboard_Install_Driver() {
  for (let i = 0; i < 0x80; i++) W32(0x64f04 + i * 4, 0);
  setGameHandler((scan) => F.Keyboard_Driver_22b04(scan));
});
