import type { AdmissionPackage } from "@hypit/hypit/admission";
import type { ProducerPackage } from "@hypit/hypit/producer";
import { canonicalize } from "@hypit/hypit/protocol";
import type { StoredValue } from "@hypit/hypit/protocol";
import type { SpatialFrame } from "@hypit/spatial";
import type { Recipe } from "@hypit/hypit/recipe";
import type { Timeline } from "@hypit/timeline";

import { regionEvidenceProducers, regionEvidenceTypes } from "./manifest.js";
import { assertRegionEvidence, resolveRegionEvidence } from "./evidence.js";
import type { RegionEvidence } from "./types.js";

function inline<T>(value: StoredValue | undefined, label: string): T {
  if (value?.kind !== "inline") throw new Error(`${label} must be inline.`);
  return value.value as unknown as T;
}
const output = (value: unknown) => ({ kind: "inline" as const, value: canonicalize(value) });

export const regionEvidenceComponent = {
  producers: [{ producer: regionEvidenceProducers.resolve, handler: ({ inputs }) => ({ outputs: { evidence: output(resolveRegionEvidence(
    inline<Recipe>(inputs.recipe?.value, "Recipe"),
    inline<SpatialFrame>(inputs.within?.value, "SpatialFrame"),
    inline<Timeline>(inputs.timeline?.value, "Timeline"),
  )) }, needs: {} }) }],
  validators: [{ type: regionEvidenceTypes.evidence, handler: ({ value }) => assertRegionEvidence(inline<RegionEvidence>(value, "RegionEvidence")) }],
} satisfies ProducerPackage & AdmissionPackage;
