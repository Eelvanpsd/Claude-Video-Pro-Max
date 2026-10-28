import type { AdmissionPackage } from "@hypit/hypit/admission";
import type { ProducerPackage } from "@hypit/hypit/producer";
import type { StoredValue } from "@hypit/hypit/protocol";

import {
  assertNarrativeSegmentRefIdentity,
  assertNarrativeIdentity,
  assertNarrativeMomentRefIdentity,
  assertNarrativeSelectionRefIdentity,
} from "./identity.js";
import { narrativeTypes } from "./manifest.js";
import type {
  Narrative,
  NarrativeSegmentRef,
  NarrativeMomentRef,
  NarrativeSelectionRef,
} from "./types.js";

function inline<T>(value: StoredValue, subject: string): T {
  if (value.kind !== "inline") throw new Error(`${subject} must be inline.`);
  return value.value as T;
}

export const narrativeComponent = {
  validators: [
    { type: narrativeTypes.narrative, handler: ({ value }) => assertNarrativeIdentity(inline<Narrative>(value, "Narrative")) },
    { type: narrativeTypes.segmentRef, handler: ({ value }) => assertNarrativeSegmentRefIdentity(inline<NarrativeSegmentRef>(value, "NarrativeSegmentRef")) },
    { type: narrativeTypes.selection, handler: ({ value }) => assertNarrativeSelectionRefIdentity(inline<NarrativeSelectionRef>(value, "NarrativeSelection")) },
    { type: narrativeTypes.moment, handler: ({ value }) => assertNarrativeMomentRefIdentity(inline<NarrativeMomentRef>(value, "NarrativeMoment")) },
  ],
} satisfies ProducerPackage & AdmissionPackage;
