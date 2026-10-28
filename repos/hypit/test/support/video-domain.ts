import { blobManifest } from "@hypit/blob";
import { compositionComponent, compositionManifest } from "@hypit/composition";
import { mediaComponent, mediaManifest } from "@hypit/media";
import { narrativeManifest } from "@hypit/narrative";
import { narrativeTemporalManifest } from "@hypit/narrative-temporal";
import { timelineManifest } from "@hypit/timeline";
import { spatialComponent, spatialManifest } from "@hypit/spatial";
import { speechAlignmentManifest } from "@hypit/narrative-speech-alignment";
import { speechEvidenceManifest } from "@hypit/speech-evidence";
import { recipeManifest } from "@hypit/recipe";
import { temporalManifest } from "@hypit/temporal";

/** Shared test fixture only; production packages import only the contracts they use. */
export const videoContractManifests = [
  blobManifest,
  narrativeManifest,
  narrativeTemporalManifest,
  mediaManifest,
  speechAlignmentManifest,
  speechEvidenceManifest,
  recipeManifest,
  timelineManifest,
  spatialManifest,
  temporalManifest,
  compositionManifest,
] as const;

export { compositionComponent, mediaComponent, spatialComponent };
