import type { Timeline } from "@hypit/timeline";
import type { CaptionDocument, CaptionProgram, CaptionTiming } from "@hypit/caption";
import type { ProducerPackage } from "@hypit/hypit/producer";
import type { AdmissionPackage } from "@hypit/hypit/admission";
import type { StoredValue } from "@hypit/hypit/protocol";
import { canonicalize } from "@hypit/hypit/protocol";
import type { RegionEvidence } from "@hypit/region-evidence";
import type { SpatialFrame } from "@hypit/spatial";

import { captionFineProducers } from "./manifest.js";
import { renderFineCaption } from "./render.js";
import { scheduleFineCaption } from "./schedule.js";
import type { FineCaptionSchedule } from "./types.js";

function inline<T>(value: StoredValue | undefined, subject: string): T {
  if (value?.kind !== "inline") throw new Error(`${subject} must be inline`);
  return value.value as T;
}

export const captionFineComponent = {
  producers: [
    {
      producer: captionFineProducers.schedule,
      handler: ({ inputs }) => ({
        outputs: { schedule: { kind: "inline", value: canonicalize(scheduleFineCaption(
          inline<CaptionTiming>(inputs.timing?.value, "CaptionTiming"),
          inline<CaptionProgram>(inputs.program?.value, "CaptionProgram"),
          inline<CaptionDocument>(inputs.document?.value, "CaptionDocument"),
        )) } },
        needs: {},
      }),
    },
    {
      producer: captionFineProducers.render,
      handler: ({ inputs }) => ({
        outputs: { track: { kind: "inline", value: canonicalize(renderFineCaption(
          inline<FineCaptionSchedule>(inputs.schedule?.value, "FineCaptionSchedule"),
          inline<CaptionProgram>(inputs.program?.value, "CaptionProgram"),
          inline<CaptionDocument>(inputs.document?.value, "CaptionDocument"),
          inline<Timeline>(inputs.timeline?.value, "Timeline"),
          inline<SpatialFrame>(inputs.within?.value, "SpatialFrame"),
        )) } },
        needs: {},
      }),
    },
    {
      producer: captionFineProducers.renderWithRegions,
      handler: ({ inputs }) => ({
        outputs: { track: { kind: "inline", value: canonicalize(renderFineCaption(
          inline<FineCaptionSchedule>(inputs.schedule?.value, "FineCaptionSchedule"),
          inline<CaptionProgram>(inputs.program?.value, "CaptionProgram"),
          inline<CaptionDocument>(inputs.document?.value, "CaptionDocument"),
          inline<Timeline>(inputs.timeline?.value, "Timeline"),
          inline<SpatialFrame>(inputs.within?.value, "SpatialFrame"),
          inline<RegionEvidence>(inputs.regions?.value, "RegionEvidence"),
        )) } },
        needs: {},
      }),
    },
  ],
} satisfies ProducerPackage & AdmissionPackage;
