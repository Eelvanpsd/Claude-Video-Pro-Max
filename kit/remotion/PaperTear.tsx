import React, { useMemo } from "react";
import { AbsoluteFill, random } from "remotion";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";

// Torn-paper wipe for @remotion/transitions. The new scene is revealed behind a jagged edge that sweeps
// right-to-left. With `rim`, the edge is real torn paper: a fibrous white core plus a soft shadow cast
// onto the scene underneath (instead of a glowing line).
// Ideas: hyperframes `torn-paper-rip`, ClaudeAnimationBase `brushWipe`.
//
//   <TransitionSeries.Transition presentation={paperTear({ width: 1080, height: 1920, rim: true })}
//                                timing={linearTiming({ durationInFrames: 18 })} />
type Props = { width: number; height: number; rim?: boolean; paper?: string };

const Tear: React.FC<TransitionPresentationComponentProps<Props>> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const { width: W, height: H, rim, paper = "#f3ead6" } = passedProps;
  const jag = useMemo(() => Array.from({ length: 40 }, (_, i) => (random(`tear-${i}`) - 0.5) * 90), []);
  // uneven width of the exposed paper core, like real torn paper
  const core = useMemo(() => Array.from({ length: 40 }, (_, i) => 10 + random(`core-${i}`) * 22), []);
  if (presentationDirection === "exiting") return <AbsoluteFill>{children}</AbsoluteFill>;
  const base = W + 160 - presentationProgress * (W + 320);
  // slight diagonal so it feels hand-torn
  const pts = jag.map((j, i) => {
    const y = (i / (jag.length - 1)) * H;
    return [base + j + (y / H) * 120, y] as const;
  });
  const clip = `polygon(${pts.map(([x, y]) => `${x.toFixed(0)}px ${y.toFixed(0)}px`).join(",")}, ${W + 400}px ${H}px, ${W + 400}px 0px)`;
  const edge = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(0)} ${y.toFixed(0)}`).join("");
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: clip }}>{children}</AbsoluteFill>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {rim ? (
          <>
            <defs>
              <filter id="tear-shadow" x="-20%" y="-5%" width="140%" height="110%">
                <feGaussianBlur stdDeviation={9} />
              </filter>
              <filter id="tear-fibre" x="-10%" y="-2%" width="120%" height="104%">
                <feTurbulence type="fractalNoise" baseFrequency="0.09 0.025" numOctaves={3} seed={4} />
                <feDisplacementMap in="SourceGraphic" scale={9} xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </defs>
            <path d={edge} transform="translate(12 6)" fill="none" stroke="rgba(15,8,2,0.55)" strokeWidth={26} filter="url(#tear-shadow)" />
            <polygon
              points={[...pts.map(([x, y]) => `${x.toFixed(0)},${y.toFixed(0)}`), ...pts.map(([x, y], i) => `${(x - core[i]).toFixed(0)},${y.toFixed(0)}`).reverse()].join(" ")}
              fill={paper}
              filter="url(#tear-fibre)"
            />
            <path d={edge} fill="none" stroke="#fffdf6" strokeWidth={2.5} opacity={0.9} filter="url(#tear-fibre)" />
          </>
        ) : (
          <>
            <path d={edge} fill="none" stroke="#fff3cf" strokeWidth={14} opacity={0.35} />
            <path d={edge} fill="none" stroke="#fffaf0" strokeWidth={4} opacity={0.9} />
          </>
        )}
      </svg>
    </AbsoluteFill>
  );
};

export const paperTear = (props: Props): TransitionPresentation<Props> => ({ component: Tear, props });
