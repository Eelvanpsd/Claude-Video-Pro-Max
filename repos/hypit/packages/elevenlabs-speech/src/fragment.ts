import { createExactModelPrimaryGenerationFragment } from "@hypit/generation/model";
import type { ExactModelEndpoint, ExactModelMediaInput, ExactModelTextInput } from "@hypit/generation/model";

/** Model result projection over the same graph-native request assembly as every exact model. */
export function createElevenLabsSpeechAudioFragment(
  endpoint: ExactModelEndpoint,
  mediaInputs: readonly ExactModelMediaInput[] = [],
  textInputs: readonly ExactModelTextInput[] = [],
) {
  return createExactModelPrimaryGenerationFragment(endpoint, mediaInputs, textInputs);
}
