import React from "react";
import { useCurrentFrame } from "remotion";

// Line boil: hand-drawn art is "redrawn" every few frames (a new turbulence seed), so the ink line
// shimmers like traditional animation while camera moves stay smooth every frame.
// Ideas: ClaudeAnimationBase `boilSeed` (per-element seeds), hyperframes `hw-boil` (quantised time).
// Boil figures and props only; keep full-frame backdrops, text and captions still.
//
//   <LineBoil id="boil-hero" seed={3}><Hero /></LineBoil>
export const LineBoil: React.FC<{
  id: string; // unique per layer
  seed?: number; // per-layer offset so layers don't jitter in unison
  every?: number; // frames per redraw (3 at 30 fps = 10 redraws/s, "on threes")
  cycle?: number; // number of distinct seeds to cycle through (cheap, still reads as alive)
  scale?: number; // displacement in px; 2.5-4 for 1080p line art
  frequency?: number; // turbulence baseFrequency
  children: React.ReactNode;
}> = ({ id, seed = 0, every = 3, cycle = 5, scale = 3.2, frequency = 0.035, children }) => {
  const frame = useCurrentFrame();
  const s = seed + (Math.floor(frame / every) % cycle) * 7;
  return (
    <>
      <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency={frequency} numOctaves={2} seed={s} />
        <feDisplacementMap in="SourceGraphic" scale={scale} xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <g filter={`url(#${id})`}>{children}</g>
    </>
  );
};
