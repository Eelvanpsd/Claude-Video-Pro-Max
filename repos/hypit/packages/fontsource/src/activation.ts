import { createMarkupSurfaceFacet } from "@hypit/hypit/markup";
import { createStudioCompanionFacet } from "@hypit/studio-companion";
import {
  decodeFontsourceFaceSurface,
  fontsourceManifest,
  fontsourceMarkupSurfaces,
  fontsourceModuleRef,
  fontsourceStudioParameterCompanions,
} from "./index.js";

export default {
  format: "hypit.package@1" as const,
  modules: [{ manifest: fontsourceManifest }],
  facets: [
    createMarkupSurfaceFacet({
      module: fontsourceModuleRef,
      declaration: fontsourceMarkupSurfaces[0]!,
      handler: decodeFontsourceFaceSurface,
    }),
    createStudioCompanionFacet({ parameters: fontsourceStudioParameterCompanions }),
  ],
};
