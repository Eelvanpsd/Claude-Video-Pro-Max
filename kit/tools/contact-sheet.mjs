#!/usr/bin/env node
// Contact sheet for visual QA of a finished render: one thumbnail every N seconds, tiled into a single
// image, so a whole video can be checked at a glance (clipped labels, subjects off the edge, empty frames,
// overlaps). Tiles read left-to-right, top-to-bottom; tile k = k x every. With --strip, every frame of a
// range (motion / transition check). Ideas: ClaudeAnimationBase render.mjs --sheet/--strip, gbro ffmpeg QA.
//
//   node contact-sheet.mjs video.mp4                    # every 1.5 s -> video-sheet.jpg
//   node contact-sheet.mjs video.mp4 --every 1 --cols 8
//   node contact-sheet.mjs video.mp4 --strip 44.9:45.8   # every frame in a range
// Requires ffmpeg + ffprobe on PATH.
import path from "node:path";
import { execFileSync } from "node:child_process";

const argv = process.argv.slice(2);
const src = argv.find((a) => !a.startsWith("--") && !/^[\d.:]+$/.test(a));
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
if (!src) {
  console.error("usage: node contact-sheet.mjs <video.mp4> [--every 1.5] [--strip a:b] [--cols 6] [--width 270] [--out file.jpg]");
  process.exit(1);
}
const cols = Number(opt("cols", 6));
const tw = Number(opt("width", 270));
const strip = opt("strip");
const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]).toString());
const [num, den = 1] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", src]).toString().trim().split("/").map(Number);
const fps = num / den;
const stem = path.join(path.dirname(src), path.basename(src, path.extname(src)));
let vf, ss = [], out;
if (strip) {
  const [a, b] = strip.split(":").map(Number);
  ss = ["-ss", String(a), "-to", String(b)];
  const n = Math.ceil((b - a) * fps);
  vf = `scale=${tw}:-1,tile=${cols}x${Math.ceil(n / cols)}:padding=4:color=black`;
  out = opt("out", `${stem}-strip-${a}-${b}.jpg`);
} else {
  const every = Number(opt("every", 1.5));
  const n = Math.max(1, Math.floor(dur / every));
  vf = `fps=1/${every},scale=${tw}:-1,tile=${cols}x${Math.ceil(n / cols)}:padding=4:color=black`;
  out = opt("out", `${stem}-sheet.jpg`);
}
execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...ss, "-i", src, "-vf", vf, "-frames:v", "1", "-q:v", "3", out]);
console.log(`-> ${out} (${dur.toFixed(1)} s, ${cols} columns; tile k = k x ${strip ? `1 frame from ${strip.split(":")[0]} s` : `${opt("every", 1.5)} s`})`);
