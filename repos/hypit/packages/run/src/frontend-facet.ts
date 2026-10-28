import {
  createFrontendFacet,
  frontendsFromFacets,
} from "@hypit/facet";
import type {
  FrontendFacet,
  Facet,
} from "@hypit/facet";
import { sourceFrontendPackageAbi } from "@hypit/source";

import type { RunFrontend } from "./types.js";

export type RunFrontendFacet = FrontendFacet<"run", RunFrontend> & {
  readonly abi: typeof sourceFrontendPackageAbi;
};

export function createRunFrontendFacet(frontend: RunFrontend): RunFrontendFacet {
  return createFrontendFacet(sourceFrontendPackageAbi, "run", frontend) as RunFrontendFacet;
}

export function runFrontendsFromFacets(facets: readonly Facet[]): readonly RunFrontend[] {
  return frontendsFromFacets<"run", RunFrontend>(sourceFrontendPackageAbi, "run", facets);
}
