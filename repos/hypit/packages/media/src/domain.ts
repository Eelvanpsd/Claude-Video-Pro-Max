import { sealLocalTemporalDomain } from "@hypit/temporal";
import type { LocalTemporalDomain } from "@hypit/temporal";

import { verifySynchronizedMedia } from "./identity.js";
import type { SynchronizedMedia } from "./types.js";

/** Give normalized media one author-visible local coordinate identity. */
export function mediaLocalTemporalDomain(id: string, media: SynchronizedMedia): LocalTemporalDomain {
  verifySynchronizedMedia(media);
  return sealLocalTemporalDomain({ id, ...structuredClone(media.frameDomain) });
}
