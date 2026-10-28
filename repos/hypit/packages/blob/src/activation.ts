import { blobManifest } from "./index.js";

export const hypitPackage = {
  format: "hypit.package@1" as const,
  modules: [{ manifest: blobManifest }],
};

export default hypitPackage;
