import type { AdmissionPackage } from "@hypit/hypit/admission";
import type { ProducerPackage } from "@hypit/hypit/producer";
import type { Narrative, NarrativeSegmentRef } from "@hypit/narrative";
import type { StoredValue } from "@hypit/hypit/protocol";
import { canonicalize } from "@hypit/hypit/protocol";
import type { AlignedTranscriptEvidence } from "@hypit/speech-evidence";
import type { LocalTemporalDomain } from "@hypit/temporal";

import { alignNarrative } from "./local.js";
import { speechAlignmentProducers } from "./manifest.js";

function inline<T>(value: StoredValue | undefined, subject: string): T {
  if (value?.kind !== "inline") throw new Error(`${subject} must be inline`);
  return value.value as T;
}

export const speechAlignmentComponent = {
  producers: [{
    producer: speechAlignmentProducers.alignNarrative,
    handler: ({ inputs }) => {
      const result = alignNarrative(
        inline<Narrative>(inputs.narrative?.value, "Narrative"),
        inline<NarrativeSegmentRef>(inputs.segment?.value, "NarrativeSegmentRef"),
        inline<LocalTemporalDomain>(inputs.domain?.value, "LocalTemporalDomain"),
        inline<AlignedTranscriptEvidence>(inputs.evidence?.value, "AlignedTranscriptEvidence"),
      );
      return { outputs: {
        alignment: { kind: "inline", value: canonicalize(result) },
      }, needs: {} };
    },
  }],
} satisfies ProducerPackage & AdmissionPackage;
