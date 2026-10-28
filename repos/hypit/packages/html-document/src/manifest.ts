import { compositionDependency, compositionTypes } from "@hypit/composition";
import { htmlProgramModuleRef, htmlProgramSchema } from "@hypit/html-program";
import { audioProgramPlanSchema, mediaOperationsModuleRef } from "@hypit/media-operations";
import { timelineDependency, timelineTypes } from "@hypit/timeline";
import type { ModuleManifest, ValueSchema } from "@hypit/hypit/protocol";

export const htmlDocumentModuleRef = { name: "@hypit/html-document", version: "1" } as const;
export const htmlDocumentTypes = { document: { module: htmlDocumentModuleRef, name: "HtmlDocument" } } as const;
export const htmlDocumentProducers = { compile: { module: htmlDocumentModuleRef, name: "compile-document" } } as const;
export const htmlDocumentSchema: ValueSchema = {
  kind: "object",
  fields: {
    format: { schema: { kind: "literal", value: "hypit.html-document@1" } },
    program: { schema: htmlProgramSchema },
    audio: { schema: audioProgramPlanSchema },
    bindings: { schema: { kind: "array", items: { kind: "object", fields: {
      id: { schema: { kind: "string", minLength: 1 } },
      artifact: { schema: { kind: "object", fields: {
        kind: { schema: { kind: "literal", value: "blob" } },
        resource: { schema: { kind: "string", minLength: 1 } },
        size: { schema: { kind: "number", integer: true, minimum: 0 } },
        mediaType: { schema: { kind: "string", minLength: 1 } },
      } } },
    } } } },
  },
};
export const htmlDocumentMarkupSurfaces = [{
  name: "document", tag: "Document", mode: "structured",
  outputs: [htmlDocumentTypes.document],
  vocabulary: {
    summary: "Produces a playable HTML document with its picture, sound and material references.",
    attributes: [
      { name: "id", kind: "identifier", required: true, summary: "Names the document output." },
      { name: "composition", kind: "reference", required: true, accepts: [compositionTypes.composition], summary: "Selects the picture and sound." },
      { name: "timeline", kind: "reference", required: true, accepts: [timelineTypes.timeline], summary: "Selects the frame clock and duration." },
    ],
    ports: [{ name: "document", type: htmlDocumentTypes.document, summary: "The document, addressed as <id>.document." }],
    example: '<page:Document id="preview" composition={main.composition} timeline={animation.timeline}/>',
  },
}] as const;
export const htmlDocumentManifest: ModuleManifest = {
  format: "hypit.module@1", ...htmlDocumentModuleRef,
  dependencies: [compositionDependency, timelineDependency, { module: htmlProgramModuleRef }, { module: mediaOperationsModuleRef }],
  types: [{ name: "HtmlDocument" }], capabilities: [],
  producers: [{
    name: htmlDocumentProducers.compile.name,
    inputs: [{ name: "composition", type: compositionTypes.composition }, { name: "timeline", type: timelineTypes.timeline }],
    outputs: [{ name: "document", type: htmlDocumentTypes.document }], needs: [],
  }],
};
