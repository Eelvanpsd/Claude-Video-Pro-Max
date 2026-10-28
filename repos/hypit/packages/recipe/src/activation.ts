import { createAuthorFrontendFacet } from "@hypit/author";

import { recipeFrontend, recipeManifest } from "./index.js";

export const hypitPackage = {
  format: "hypit.package@1" as const,
  modules: [{ manifest: recipeManifest }],
  facets: [createAuthorFrontendFacet(recipeFrontend)],
};

export default hypitPackage;
