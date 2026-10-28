import {
  createRuntimeCredentialStoreAdapterFacet,
  runtimeConfigExact,
  runtimeConfigObject,
} from "@hypit/runtime-local/extension";

import { EnvironmentCredentialStore } from "./index.js";

const environmentCredentialStoreAdapter = createRuntimeCredentialStoreAdapterFacet({
  use: "@hypit/credential-store-env",
  validate(context) {
    const config = runtimeConfigObject(context.config, "environment CredentialStore");
    runtimeConfigExact(config, [], "environment CredentialStore");
  },
  open() {
    return { value: new EnvironmentCredentialStore() };
  },
});

export const hypitPackage = {
  format: "hypit.package@1" as const,
  facets: [environmentCredentialStoreAdapter],
};

export default hypitPackage;
