import { createAdmissionPackageFacet } from "@hypit/hypit/admission";
import { createProducerPackageFacet } from "@hypit/hypit/producer";
import { createMarkupSurfaceFacet } from "@hypit/hypit/markup";

import {
  decodeNarrativeCaptionTimingSurface,
  narrativeCaptionComponent,
  narrativeCaptionManifest,
  narrativeCaptionModuleRef,
  narrativeCaptionTimingMarkupSurface,
} from "./index.js";

export const hypitPackage = {
  format: "hypit.package@1" as const,
  modules: [{ manifest: narrativeCaptionManifest }],
  facets: [
    ...[narrativeCaptionComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),createMarkupSurfaceFacet({
    module: narrativeCaptionModuleRef,
    declaration: narrativeCaptionTimingMarkupSurface,
    handler: decodeNarrativeCaptionTimingSurface,
  })],
};
export default hypitPackage;
