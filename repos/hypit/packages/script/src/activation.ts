import { createMarkupSurfaceFacet } from "@hypit/hypit/markup";
import { createStudioCompanionFacet } from "@hypit/studio-companion";

import {
  decodeScriptSurface,
  scriptManifest,
  scriptModuleRef,
  scriptMarkupSurfaces,
} from "./index.js";
import { scriptStudioTemporalDomains } from "./studio.js";

export const hypitPackage = {
  format: "hypit.package@1" as const,
  modules: [{ manifest: scriptManifest }],
  facets: [
    createMarkupSurfaceFacet({
      module: scriptModuleRef,
      declaration: scriptMarkupSurfaces.find((item) => item.name === "script")!,
      handler: decodeScriptSurface,
    }),
    createStudioCompanionFacet({ temporalDomains: scriptStudioTemporalDomains }),
  ],
};

export default hypitPackage;
