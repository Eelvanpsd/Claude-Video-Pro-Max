import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

// A date / number that hits the page like a seal: ~0.1 s from 2.4x down to 1x (accelerating), then a
// small damped bounce and a vertical jolt, settling at a slight tilt. Use for dates, numbers, verdicts.
// Ideas: hyperframes `kinetic-beat-slam` rule, onetake `impact`/`seal` moves.
// Pair with a short CC0 impact/chime SFX on `from`.
//
//   <SlamStamp from={4.2}>1453</SlamStamp>
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const SlamStamp: React.FC<{ from: number; hit?: number; tilt?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  from,
  hit = 0.1,
  tilt = -2.5,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = frame / fps - from;
  if (k < 0) return null;
  let s: number;
  let jolt = 0;
  if (k < hit) s = interpolate(k, [0, hit], [2.4, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  else {
    const a = k - hit;
    s = 1 - 0.07 * Math.exp(-9 * a) * Math.cos(26 * a);
    jolt = 9 * Math.exp(-14 * a) * Math.sin(70 * a);
  }
  const rot = tilt * Math.min(1, k / hit);
  const opacity = interpolate(k, [0, 0.06], [0, 1], clamp);
  return <div style={{ display: "inline-block", opacity, transform: `translateY(${jolt}px) scale(${s}) rotate(${rot}deg)`, ...style }}>{children}</div>;
};
