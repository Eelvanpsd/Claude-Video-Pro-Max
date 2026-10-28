import { canonicalize } from "@hypit/hypit/protocol";
import type { ProducerPackage } from "@hypit/hypit/producer";
import type { AdmissionPackage } from "@hypit/hypit/admission";
import type { StoredValue } from "@hypit/hypit/protocol";
import type { AudioTrack, VisualTrack } from "@hypit/composition";
import type { Canvas } from "@hypit/spatial";
import type { Timeline } from "@hypit/timeline";

import { filmProducers } from "./manifest.js";
import { appendFilmAudioTrack, appendFilmVisualTrack, compileFilmComposition, createFilmTrackSet } from "./program.js";
import type { FilmProgram, FilmTrackSet } from "./types.js";

function inline<T>(value: StoredValue | undefined, subject: string): T {
  if (value?.kind !== "inline") throw new Error(`${subject} must be inline`);
  return value.value as unknown as T;
}

export const filmComponent = {
  producers: [
    {
      producer: filmProducers.createTrackSet,
      handler: () => ({
        outputs: { set: { kind: "inline", value: canonicalize(createFilmTrackSet()) } },
        needs: {},
      }),
    },
    {
      producer: filmProducers.appendVisualTrack,
      handler: ({ inputs }) => ({
        outputs: { set: { kind: "inline", value: canonicalize(appendFilmVisualTrack(
          inline<FilmTrackSet>(inputs.set?.value, "FilmTrackSet"),
          inline<Timeline>(inputs.timeline?.value, "Timeline"),
          inline<VisualTrack>(inputs.track?.value, "VisualTrack"),
        )) } },
        needs: {},
      }),
    },
    {
      producer: filmProducers.appendAudioTrack,
      handler: ({ inputs }) => ({
        outputs: { set: { kind: "inline", value: canonicalize(appendFilmAudioTrack(
          inline<FilmTrackSet>(inputs.set?.value, "FilmTrackSet"),
          inline<Timeline>(inputs.timeline?.value, "Timeline"),
          inline<AudioTrack>(inputs.track?.value, "AudioTrack"),
        )) } },
        needs: {},
      }),
    },
    {
      producer: filmProducers.compileComposition,
      handler: ({ inputs }) => ({
        outputs: { composition: { kind: "inline", value: canonicalize(compileFilmComposition(
          inline<FilmProgram>(inputs.program?.value, "FilmProgram"),
          inline<Canvas>(inputs.canvas?.value, "Canvas"),
          inline<Timeline>(inputs.timeline?.value, "Timeline"),
          inline<FilmTrackSet>(inputs.set?.value, "FilmTrackSet"),
        )) } },
        needs: {},
      }),
    },
  ],
} satisfies ProducerPackage & AdmissionPackage;
