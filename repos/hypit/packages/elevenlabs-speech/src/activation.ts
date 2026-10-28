import { createAdmissionPackageFacet } from "@hypit/hypit/admission";
import { createProducerPackageFacet } from "@hypit/hypit/producer";
import { createMarkupSurfaceFacet } from "@hypit/hypit/markup";

import {
  decodeElevenLabsVoiceDesignSurface,
  elevenLabsSpeechComponent,
  elevenLabsSpeechDefinition,
  elevenLabsSpeechManifest,
  elevenLabsSpeechMarkupSurfaces,
  elevenLabsSpeechModuleRef,
} from "./index.js";

export const hypitPackage = {
  format: "hypit.package@1" as const,
  modules: [{ manifest: elevenLabsSpeechManifest }],
  facets: [
    ...[elevenLabsSpeechComponent].flatMap((component) => [createProducerPackageFacet(component), createAdmissionPackageFacet(component)]),
    elevenLabsSpeechDefinition.facet,
    createMarkupSurfaceFacet({
      module: elevenLabsSpeechModuleRef,
      declaration: elevenLabsSpeechMarkupSurfaces.find((item) => item.name === "voiceDesign")!,
      handler: decodeElevenLabsVoiceDesignSurface,
    }),
  ],
};

export default hypitPackage;
