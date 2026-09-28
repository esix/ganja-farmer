// 0x22c58  void Keyboard_Remove_Driver(void)
// Disconnects Keyboard_Driver: keys go to the BIOS keyboard buffer again (platform/kbd.js). Stage 1
// restored the INT 9 vector saved by Keyboard_Install_Driver.
import { register } from '../runtime/registry.js';
import { setGameHandler } from '../platform/kbd.js';

register(0x22c58, 'Keyboard_Remove_Driver_22c58', function Keyboard_Remove_Driver() {
  setGameHandler(null);
});
