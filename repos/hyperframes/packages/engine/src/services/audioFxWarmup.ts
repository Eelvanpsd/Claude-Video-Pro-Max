import { delayTailSeconds, reverbRoomSeconds } from "@hyperframes/core/audio-fx-tail";
import {
  enabledAudioFxNodes,
  normalizeAudioFxParams,
  type HfAudioFxChain,
  type HfAudioFxNode,
} from "@hyperframes/core/audio-fx";

/** Where state stops mattering: -60 dB, i.e. e^-6.9 of what it started as. */
const DECAY_TO_FLOOR = Math.log(1000);

const param = (node: HfAudioFxNode, key: string): number =>
  Number(normalizeAudioFxParams(node.type, node.params)[key] ?? 0);

const reverbMemory = (node: HfAudioFxNode): number =>
  param(node, "wet") > 0 ? reverbRoomSeconds(param(node, "size")) : 0;

const delayMemory = (node: HfAudioFxNode): number =>
  param(node, "mix") > 0 ? delayTailSeconds(param(node, "time"), param(node, "feedback")) : 0;

const releaseMemory = (node: HfAudioFxNode): number =>
  (DECAY_TO_FLOOR * param(node, "release")) / 1000;

/** Seconds of input a node still remembers, to -60 dB. */
const MEMORY: Record<string, (node: HfAudioFxNode) => number> = {
  reverb: reverbMemory,
  delay: delayMemory,
  compressor: releaseMemory,
  limiter: releaseMemory,
  truepeak: releaseMemory,
  gate: releaseMemory,
};

/**
 * How far ahead of a window a chain must be fed for its state to match a whole render.
 *
 * Summed, since the chain is serial: a delay ahead of a reverb hands the reverb every repeat.
 * Biquads, chorus and pitch shift settle well inside the caller's floor.
 */
export function chainWarmupSeconds(chain: HfAudioFxChain): number {
  return enabledAudioFxNodes(chain).reduce(
    (sum, node) => sum + (MEMORY[node.type]?.(node) ?? 0),
    0,
  );
}

/** The pre-roll a chain gets: its own memory, between `floorSeconds` and `capSeconds`. */
export function windowPrerollSeconds(
  chain: HfAudioFxChain,
  floorSeconds: number,
  capSeconds: number,
): { seconds: number; capped: boolean } {
  const needed = chainWarmupSeconds(chain);
  return {
    seconds: Math.min(capSeconds, Math.max(floorSeconds, needed)),
    capped: needed > capSeconds,
  };
}
