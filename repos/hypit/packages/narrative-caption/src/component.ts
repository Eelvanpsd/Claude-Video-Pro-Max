import type { AdmissionPackage } from "@hypit/hypit/admission";
import type { CaptionDocument, CaptionTiming } from "@hypit/caption";
import type { ProducerPackage } from "@hypit/hypit/producer";
import type { StoredValue } from "@hypit/hypit/protocol";
import { canonicalize } from "@hypit/hypit/protocol";
import type { NarrativeProjection } from "@hypit/narrative-temporal";

import { assertNarrativeCaptionBindingIdentity } from "./identity.js";
import { narrativeCaptionProducers, narrativeCaptionTypes } from "./manifest.js";
import { projectNarrativeCaptionTiming } from "./project.js";
import type { NarrativeCaptionBinding } from "./types.js";

function inline<T>(value: StoredValue | undefined, subject: string): T {
  if (value?.kind !== "inline") throw new Error(`${subject} must be inline`);
  return value.value as T;
}

export const narrativeCaptionComponent = {
  producers: [{
    producer: narrativeCaptionProducers.projectTiming,
    handler: ({ inputs }) => ({
      outputs: { timing: { kind: "inline", value: canonicalize(projectNarrativeCaptionTiming(
        inline<CaptionDocument>(inputs.document?.value, "CaptionDocument"),
        inline<NarrativeCaptionBinding>(inputs.binding?.value, "NarrativeCaptionBinding"),
        inline<NarrativeProjection>(inputs.projection?.value, "NarrativeProjection"),
      ) as CaptionTiming) } },
      needs: {},
    }),
  }],
  validators: [{
    type: narrativeCaptionTypes.binding,
    handler: ({ value }) => assertNarrativeCaptionBindingIdentity(inline<NarrativeCaptionBinding>(value, "NarrativeCaptionBinding")),
  }],
} satisfies ProducerPackage & AdmissionPackage;
