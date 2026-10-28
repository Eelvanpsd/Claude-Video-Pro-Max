// The one timeline: picture, score, foley, voice and subtitles all read these numbers.
// 100 BPM, 4/4: one beat = 0.6 s, one bar = 2.4 s. Key actions sit on beats (tools/cuecheck.py checks).
export const BPM = 100;
export const BEAT = 60 / BPM;
export const b = n => +(n * BEAT).toFixed(4);          // beat number -> seconds

export const T = {
  lock: b(1),          // 0.6  reticle locks on the Aral
  mapOn: b(2),         // 1.2  map layer on: blue fill + 咸海
  dive0: b(3),         // 1.8  the dive starts
  grey0: b(6),         // 3.6  colour starts to drain
  touch: b(9),         // 5.4  touchdown, map blue drains away; silence 1
  rewind: b(11),       // 6.6  first sound after silence: the rewind
  y1977: b(13),        // 7.8  the sea in 1977, first ring
  y1989: b(16),        // 9.6
  y2000: b(18),        // 10.8
  y2009: b(19.5),      // 11.7
  y2014: b(20.5),      // 12.3
  y2025: b(22),        // 13.2  hard stop on today
  portLock: b(24.5),   // 14.7  the reticle locks on Muynak's old port before the push
  push0: b(25.5),      // 15.3  after a held breath, push towards the south shore
  shore77: b(27.5),    // 16.5  the 1977 shoreline is drawn past the port
  horn: b(27),         // 16.2  ship horn (J-cut)
  muynak: b(27),       // 16.2  label: old fishing port (with the horn)
  arrive: b(29),       // 17.4  the camera settles on the port
  range0: b(31),       // 18.6  the range line starts
  rangeEnd: b(34),     // 20.4  reading lands at today's sea, on the spoken number
  sil2: b(36.5),       // 21.9  silence 2
  water: b(38),        // 22.8  first sound after silence 2: water, before we see it (J-cut)
  whip: b(39),         // 23.4  whip pan north
  north: b(40),        // 24.0  arrive over the dam
  dam: b(41),          // 24.6  dam line complete
  n2001: b(42),        // 25.2  ring 2001
  n2009: b(44),        // 26.4  ring 2009, water regains colour
  pull: b(48),         // 28.8  pull back to orbit
  relabel: b(51),      // 30.6  咸海 label moves to the north sea (pins one beat later)
  end: b(57),          // 34.2  end card
  dur: 37.8,
};

// ring sequence (south basin), time each ring is stamped; the scan sweep ends on that beat
export const RINGS = [
  { year: 1977, t: T.y1977, sweep: 0.50 },
  { year: 1989, t: T.y1989, sweep: 0.55 },
  { year: 2000, t: T.y2000, sweep: 0.48 },
  { year: 2009, t: T.y2009, sweep: 0.40 },
  { year: 2014, t: T.y2014, sweep: 0.34 },
  { year: 2025, t: T.y2025, sweep: 0.48 },
];
// the rewind: today back to 1977, upward scans (time running backwards)
export const REWIND = [
  { from: 2025, to: 2014, t0: T.rewind + 0.00, t1: T.rewind + 0.22 },
  { from: 2014, to: 2009, t0: T.rewind + 0.22, t1: T.rewind + 0.42 },
  { from: 2009, to: 2000, t0: T.rewind + 0.42, t1: T.rewind + 0.62 },
  { from: 2000, to: 1989, t0: T.rewind + 0.62, t1: T.rewind + 0.84 },
  { from: 1989, to: 1977, t0: T.rewind + 0.84, t1: T.rewind + 1.10 },
];

// narration: id, start time, text (spoken), subtitle zh / en. Start times are refined against the
// real TTS durations in voice/dur.json (tools/export.mjs checks that nothing overlaps).
export const VO = [
  { id: 'l1', t: 2.05, speed: 0.9, say: 'On the map, this is still a sea.', zh: '地图上，这里还是一片海。', en: 'On the map, this is still a sea.' },
  { id: 'l2', t: 7.85, speed: 1.0, say: 'In nineteen seventy-seven, it was.', zh: '1977 年，它确实是。', en: 'In 1977, it was.', asr: 'In 1977, it was.' },
  { id: 'l3', t: 10.78, speed: 1.0, say: 'Then its rivers went to the cotton fields.', zh: '后来，河水被引去种棉花。', en: 'Then its rivers went to the cotton fields.' },
  { id: 'l4', t: 13.68, speed: 1.0, say: 'By twenty fourteen, the eastern basin had dried.', zh: '到 2014 年，东边的湖盆干涸了。', en: 'By 2014, the eastern basin had dried.', asr: 'By 2014, the eastern basin had dried.' },
  { id: 'l5', t: 16.95, speed: 1.0, say: 'This was a fishing port.', zh: '这里曾是渔港。', en: 'This was a fishing port.' },
  { id: 'l6', t: 19.12, speed: 1.0, say: 'Today, the sea is DIST kilometres away.', zh: '如今，海在 DIST 公里之外。', en: 'Today, the sea is DIST km away.', asr: 'Today, the sea is DIST kilometers away.' },
  { id: 'l7', t: 23.72, speed: 0.9, say: 'But up north, a dam went in.', zh: '可在北边，修起了一道坝。', en: 'But up north, a dam went in.' },
  { id: 'l8', t: 26.7, speed: 0.9, say: 'And the water came back.', zh: '水回来了。', en: 'And the water came back.' },
  { id: 'l9', t: 29.4, speed: 0.9, say: 'The sea did not come back on its own.', zh: '海不是自己回来的。', en: 'The sea did not come back on its own.' },
  { id: 'l10', t: 32.3, speed: 0.9, say: 'Someone kept it.', zh: '是有人把它留住了。', en: 'Someone kept it.' },
];
