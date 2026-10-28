import { createAdmissionPackageFacet } from "@hypit/hypit/admission";
import { compositionComponent, compositionManifest } from "./index.js";
export const hypitPackage = {
  format: "hypit.package@1" as const,
  modules: [{ manifest: compositionManifest }],
  facets: [createAdmissionPackageFacet(compositionComponent)],
};
export default hypitPackage;
