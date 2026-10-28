import type { SpatialFrame } from "@hypit/spatial";

/** One named sequence of resolved program-picture regions. */
export type RegionSeries = {
  readonly id: string;
  readonly frames: readonly (SpatialFrame | null)[];
};

/** External spatial evidence indexed directly by one Timeline's frames. */
export type RegionEvidence = {
  readonly timelineId: string;
  readonly series: readonly RegionSeries[];
};
