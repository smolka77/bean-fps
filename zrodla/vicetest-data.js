// TYMCZASOWA mapa testowa potoku Vice (do usunięcia po zbudowaniu właściwych map)
import { defineMap, PAL, PI, HALF } from './vice-kit.js';
export const VICE = defineMap({
  name: 'ViceTest', seed: 5, bounds: [-40, -40, 40, 40],
  env: { preset: new URLSearchParams(globalThis.location?.search || '').get('env') || 'sunset', ocean: { rect: [32, -400, 420, 400], shore: [1, 0, 32], deep: 0x2a3a7a, shallow: 0x3fb8b8 } },
  layout(B) {
    B.paint(-90, -90, 90, 90, 'asphalt');
    B.paint(20, -90, 34, 90, 'sand'); B.paint(14, -90, 20, 90, 'boardwalk');
    B.paint(-30, -90, -18, 90, 'sidewalk'); B.paint(-2, -90, 14, 90, 'sidewalk');
    B.block(-1.9, 0, -40, 0, 0.15, 40, { top: 'sidewalk', side: 'concrete' });
    for (let z = -36; z <= 36; z += 12) B.palm(13, z, 7 + (z % 3), 1.2, 0.4 + z * 0.01, { planter: 0xf6efe2 });
    B.tower(-30, -30, -18, -14, 14, { c: PAL.pink, lit: 0.1, ground: 'shopfront_lit', tank: true });
    B.tower(-30, -12, -18, 2, 11, { c: PAL.mint, ground: 'shopfront' });
    B.tower(-30, 4, -18, 20, 17, { c: PAL.lavender, win: 'win_deco', lit: 0.2 });
    B.sign(-17.7, 6, -22, 6, 1.5, HALF, 'signs_a', 0, 0x22e6ff);
    B.sign(-17.7, 5, 12, 5, 1.25, HALF, 'signs_a', 1, 0xff2d95);
    B.shell(-14, 22, -2, 34, { floors: [3.6, 3.4], wall: { t: 'stucco', c: PAL.peach }, open: { nz: [{ at: 3, w: 1.6 }, { at: 8, w: 2.2, y0: 1, y1: 2.4 }], px: [{ at: 6, w: 1.6 }], nx: [{ at: 4, w: 2, y0: 1, y1: 2.4, f: 1 }] }, holes: [[-13.5, 30, -11.5, 33.5, 0]] });
    B.stairs(-12.5, 30.2, 2, 1.8, 0, 3.6);
    B.car(-7, -20, 0, 'sedan'); B.car(-7, -12, 0, 'convertible', 0xff7aa8); B.car(-11, -2, 2, 'van'); B.car(-7, 5, 0, 'coupe', 0xe8e4dc); B.car(-11, 14, 2, 'taxi'); B.car(-7, -30, 0, 'police');
    for (let z = -35; z <= 35; z += 14) { B.lamp(-0.6, z, -HALF, 'cobra'); B.lamp(-17, z + 7, HALF, 'cobra'); }
    B.line(-9, -40, -9, 40, 0.14, 0xf2c14e, null); B.line(-8.7, -40, -8.7, 40, 0.14, 0xf2c14e, null);
    B.crosswalk(-17, -6, -1, -2, 'z');
    B.lifeguard(26, -10, -HALF, 0xff8fb0); B.lifeguard(26, 18, -HALF, 0x8fd8e0);
    for (let i = 0; i < 6; i++) { B.umbrella(23 + (i % 2) * 4, -26 + i * 4, i % 4); B.lounger(24 + (i % 2) * 4, -25 + i * 4, HALF); }
    B.kiosk(17, 0, HALF, 3, 2.2, PAL.aqua, { sign: 2, signTile: 'signs_b' });
    B.boat(29, 8, 1);
    B.utilityPoles([[-31, -38], [-31, -18], [-31, 2], [-31, 22]]);
    B.trafficLight(-17, -4, HALF, 5);
    B.billboard(-24, 30, PI * 0.75, 'billboard_a');
    B.lowWall(14, -40, 14.6, -6, 1.0); B.lowWall(14, -3, 14.6, 40, 1.0);
    B.block(-41, 0, -41, 41, 4, -40, 'concrete_wall', {}); B.block(-41, 0, 40, 41, 4, 41, 'concrete_wall'); B.block(-41, 0, -40, -40, 4, 40, 'concrete_wall');
    B.solid(40, 0, -40, 41, 4, 40, { hit: false });
    B.skyline(0, 0, 170, 220, -2.6, -0.3, 26, 25, 90);
    B.ferris(60, 18, -110, 16, 0.3);
    for (let i = 0; i < 24; i++) B.spawn(-10 + (i % 6) * 3, -20 + Math.floor(i / 6) * 10, 0);
  },
});
export const MAP = VICE.data;
