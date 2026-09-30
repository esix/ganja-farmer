// 0x1a825  void clearEnemies(void)   [Watcom, no args, no return value]
// In nine loops writes 0 / -70 into eleven arrays of 0x18c stride (the sprite struct size, LIBRARY.md
// "Structures"; the first two loops store to two arrays each), then zeroes four scalar globals:
//   25 entries: [0x35c90 + i*0x18c] = 0, [0x35b24 + i*0x18c] = -70
//   25 entries: [0x3833c + i*0x18c] = 0, [0x381d0 + i*0x18c] = -70
//   4 x [0x3d3ac], 1 x [0x3d220], 3 x [0x3d9dc], 63 x [0x3e00c], 13 x [0x34874], 200 x [0x4c688], 5 x [0x340b8] = 0
//   [0x46070] = [0x461fc] = [0x5fd74] = [0x4c4fc] = 0
// Which sprite field each address is depends on the (undocumented) array base; only addresses are given.
// EAX at RET is a leftover of the last loop (mov eax,[ebp-4] at 0x1a9b2); the 3 callers do not read it
// (signatures.json returns=false), so nothing is returned.
import { register } from '../runtime/registry.js';
import { W32 } from '../runtime/mem.js';
import { A10_JET, BOMB, BONG_SMOKE, CHOPPER, CROP_DUSTER, CRUISE_MISSILE, DUSTER_SPRAY, EXPLOSION, GROUND_TROOP, MISSILE, MISSILE_TARGET, PARATROOPER, UFO } from './states.js';
import { a10Jets, bombs, bongSmoke, choppers, cropDusters, cruiseMissile, dusterSpray, explosions, groundTroops, missile, missileTarget, paratroopers, ufo } from './data.js';
import { sprite } from './access.js';

register(0x1a825, 'clearEnemies_1a825', function clearEnemies() {
  let i; // [ebp-4]

  i = 0; // 0x1a83d (dead store)
  for (i = 0; i < 0x19; i++) {
    sprite(paratroopers, i).state = PARATROOPER.INACTIVE;
    sprite(paratroopers, i).y = -70; // 0xffffffba
  }
  for (i = 0; i < 0x19; i++) {
    sprite(groundTroops, i).state = GROUND_TROOP.INACTIVE;
    sprite(groundTroops, i).y = -70; // 0xffffffba
  }
  for (i = 0; i < 4; i++) {
    sprite(bombs, i).state = BOMB.INACTIVE;
  }
  for (i = 0; i < 1; i++) {
    sprite(a10Jets, i).state = A10_JET.INACTIVE;
  }
  for (i = 0; i < 3; i++) {
    sprite(cropDusters, i).state = CROP_DUSTER.INACTIVE;
  }
  for (i = 0; i < 0x3f; i++) {
    sprite(dusterSpray, i).state = DUSTER_SPRAY.INACTIVE;
  }
  for (i = 0; i < 0xd; i++) {
    sprite(explosions, i).state = EXPLOSION.IDLE;
  }
  for (i = 0; i < 200; i++) {
    sprite(bongSmoke, i).state = BONG_SMOKE.INACTIVE;
  }
  for (i = 0; i < 5; i++) {
    sprite(choppers, i).state = CHOPPER.INACTIVE;
  }
  sprite(missile).state = MISSILE.INACTIVE;
  sprite(missileTarget).state = MISSILE_TARGET.INACTIVE;
  sprite(cruiseMissile).state = CRUISE_MISSILE.INACTIVE;
  sprite(ufo).state = UFO.INACTIVE;
});
