import { createAdmissionPackageFacet } from "@hypit/hypit/admission";
import { createProducerPackageFacet } from "@hypit/hypit/producer";
import { createMarkupSurfaceFacet } from "@hypit/hypit/markup";

import {
  decodeMimoVoiceCloneSurface,
  decodeMimoVoiceDesignSurface,
  mimoSpeechComponent,
  mimoSpeechDefinition,
  mimoSpeechManifest,
  mimoSpeechMarkupSurfaces,
  mimoSpeechModuleRef,
} from "./index.js";

export const hypitPackage = {
  format: "hypit.package@1" as const,
  modules: [{ manifest: mimoSpeechManifest }],
  facets: [
    ...[mimoSpeechComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),
    mimoSpeechDefinition.facet,
    createMarkupSurfaceFacet({
      module: mimoSpeechModuleRef,
      declaration: mimoSpeechMarkupSurfaces.find((item) => item.name === "voiceDesign")!,
      handler: decodeMimoVoiceDesignSurface,
    }),
    createMarkupSurfaceFacet({
      module: mimoSpeechModuleRef,
      declaration: mimoSpeechMarkupSurfaces.find((item) => item.name === "voiceClone")!,
      handler: decodeMimoVoiceCloneSurface,
    }),
  ],
};

export default hypitPackage;
