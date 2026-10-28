// 《二十一键》 21 Keys, Opened — the single timeline (seconds). Picture, voice, score, subtitles and checks all read this file.
// 96 BPM, 4/4: one beat = 0.625 s, one bar = 2.5 s. Cuts, landings and label hits sit on beats or half-beats.
export const BPM = 96;
export const BEAT = 60 / BPM, BAR = 4 * BEAT;
export const b = (bar, beat = 0) => +((bar - 1) * BAR + beat * BEAT).toFixed(4);   // bar 1 beat 0 = 0.0 s

export const T = {
  hero: 0, tap: b(2, 1), suck: b(2, 3), explode: b(3),          // 0 · 3.125 · 4.375 · 5.0
  labelsIn: b(3, 3), gapOpen: b(5), labelsOut: b(5, 3),        // 6.875 · 10.0 · 11.875
  dive: b(6), chip: b(7), led: b(8, 1), swTravel: b(9, 2), sw: b(9, 3.5), // 12.5 · 15.0 · 18.125 · 21.25 · 22.19
  pullOut: b(11), collapse: b(11, 1), dims: b(12, 1), card: b(14, 2), end: b(16, 2), // 25.0 · 25.625 · 28.125 · 33.75 · 38.75
};
export const DUR = T.end;

// explode: each layer leaves at its own time (top first), returns bottom first; keycaps fan out in a wave
export const LAYERS = ['feet', 'screwB', 'case', 'spacer', 'pcb', 'plate', 'screwT', 'sw', 'cap'];
export const OFF = { feet: 0, screwB: 10, case: 18, spacer: 34, pcb: 50, plate: 70, screwT: 80, sw: 92, cap: 116 };
export const UP = { cap: 5.0, sw: 5.31, plate: 5.47, screwT: 5.47, pcb: 5.63, spacer: 5.78, screwB: 5.85, case: 5.94, feet: 99 };
export const DOWN = { case: 25.63, screwB: 25.68, spacer: 25.74, pcb: 25.85, plate: 25.98, screwT: 26.0, sw: 26.1, cap: 26.25, feet: 99 };
export const UPDUR = 1.25, DOWNDUR = 1.0, WAVEUP = .45, WAVEDOWN = .36;
// extra lift for the dive: every layer from the PCB up rises 30 mm more, opening a room between the board and the case
export const GAP = { lift: 30, open: [b(5), b(6, 2)], close: [25.0, 26.4], layers: ['pcb', 'plate', 'screwT', 'sw', 'cap'] };
// second gap for the switch shot: the switches rise 16 mm more so their pins are clear of the plate
export const GAP2 = { lift: 16, open: [b(9, 1), b(9, 3)], close: [25.0, 26.4], layers: ['sw', 'cap'] };

// narration (Kokoro, English) with the Chinese subtitle line; `say` is what is spoken, `en` what is shown
export const VO = [
  { id: 'v1', t: 0.55, say: 'Twenty-one keys. Half a keyboard.', en: 'Twenty-one keys. Half a keyboard.', zh: '二十一个键，半把键盘。' },
  { id: 'v2', t: 5.35, say: 'Take it apart: six layers.', en: 'Take it apart: six layers.', zh: '拆开，是六层。' },
  { id: 'v3', t: 8.15, say: 'Every one of them is drawn in open files.', en: 'Every one of them is drawn in open files.', zh: '每一层，都画在公开的文件里。' },
  { id: 'v4', t: 14.9, say: 'One R P twenty forty chip runs it all.', en: 'One RP2040 chip runs it all.', zh: '一颗 RP2040 芯片，管着全部。', asr: 'One RP 2040 chip runs it all.' },
  { id: 'v5', t: 18.55, say: 'Twenty-three lights, mounted upside down.', en: 'Twenty-three lights, mounted upside down.', zh: '二十三颗灯珠，反着贴在背面。' },
  { id: 'v6', t: 22.35, say: 'Hot-swappable. No soldering.', en: 'Hot-swappable. No soldering.', zh: '热插拔，不用焊接。' },
  { id: 'v7', t: 25.55, say: 'Put it back together.', en: 'Put it back together.', zh: '装回去。' },
  { id: 'v8', t: 27.8, say: 'Nineteen point oh five millimetres apart.', en: '19.05 millimetres apart.', zh: '键距 19.05 毫米。', asr: '19.05 millimeters apart.' },
  { id: 'v9', t: 31.1, say: 'Every number is public.', en: 'Every number is public.', zh: '每一个数字，都是公开的。' },
];

// on-screen labels: [id, t0, t1]; anchors and words live in overlay.js
export const LBL = {
  layers: { t0: T.labelsIn, step: .16, t1: T.labelsOut },
  chip: [b(6, 3), b(8, 1)], flash: [b(6, 3.5), b(8, 1)],
  led: [b(8, 1), b(9, 3)],
  sw: [b(9, 3.2), b(11, 1)],
  dimW: [b(12, 1), b(14, 2) - .1], dimD: [b(12, 2), b(14, 2) - .1], dimH: [b(12, 3), b(14, 2) - .1], dimP: [b(12, 0), b(14, 2) - .1],
};

// camera: [t, mode, ...] — 'orbit' keys: [t, 'o', az°, el°, dist, target{x,y,h}, fov, shiftX]; 'look' keys: [t, 'l', eye{x,y,h}, target{x,y,h}, fov, shiftX]
// x, y in KiCad board millimetres (y points to the front of the keyboard); h = height above the floor
export const CAM = [
  [0.0, 'l', [-6, 70, 33], [-62, 18, 22], 30, 0],
  [2.5, 'l', [-58, 80, 36], [-84, 16, 21], 30, 0],
  [4.3, 'o', -36, 27, 330, [-71, 22, 13], 26, 0],
  [5.0, 'o', -31, 26, 380, [-71, 22, 34], 26, 40],
  [6.3, 'o', -22, 23, 430, [-71, 22, 66], 26, 140],
  [8.0, 'o', -9, 20, 432, [-71, 22, 76], 26, 170],
  [10.0, 'o', 6, 17, 440, [-71, 22, 84], 26, 170],
  [11.875, 'o', 18, 14, 452, [-71, 22, 94], 26, 120],
  [13.6, 'l', [-82, 128, 64], [-74, 40, 80], 30, 0],
  [15.0, 'l', [-83, 63, 62], [-72.6, 37.4, 84.5], 32, 0],
  [17.9, 'l', [-81, 59, 64], [-71.0, 36.0, 85.0], 32, 0],
  [18.9, 'l', [-73, 47, 66], [-70.4, 29.8, 85.5], 32, 0],
  [21.0, 'l', [-72, 45, 67.5], [-70.2, 29.0, 85.5], 32, 0],
  [21.7, 'l', [-62, 108, 96], [-61, 50, 120], 30, 0],
  [22.3, 'l', [-44, 101, 146], [-58, 46, 148], 30, 0],
  [25.0, 'l', [-47, 92, 147.5], [-59, 46, 148.5], 30, 0],
  [26.4, 'o', 30, 30, 380, [-71, 22, 30], 26, 0],
  [28.1, 'o', 20, 40, 374, [-71, 24, 10], 26, 0],
  [33.5, 'o', 40, 33, 336, [-71, 24, 9], 26, 0],
  [36.25, 'o', 50, 30, 316, [-71, 24, 10], 26, -230],
  [38.75, 'o', 59, 28, 298, [-71, 24, 10], 26, -230],
];
