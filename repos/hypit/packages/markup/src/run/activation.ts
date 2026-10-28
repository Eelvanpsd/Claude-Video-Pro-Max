import { createRunFrontendFacet } from "@hypit/run";

import { runMarkupFrontend } from "./index.js";

export const hypitPackage = {
  format: "hypit.package@1" as const,
  facets: [createRunFrontendFacet(runMarkupFrontend)],
};

export default hypitPackage;
