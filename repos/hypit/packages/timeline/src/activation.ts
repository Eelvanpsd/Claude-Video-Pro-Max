import { createAdmissionPackageFacet } from "@hypit/hypit/admission";
import { createProducerPackageFacet } from "@hypit/hypit/producer";
import { timelineComponent, timelineManifest } from "./index.js";

export const hypitPackage = {
  format: "hypit.package@1" as const,
  modules: [{ manifest: timelineManifest }],
  facets: [...[timelineComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)])],
};
export default hypitPackage;
