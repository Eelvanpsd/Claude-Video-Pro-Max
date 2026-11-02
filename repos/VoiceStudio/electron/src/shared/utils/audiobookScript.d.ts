export function parseCastNames(text: string): string[];
export function scriptStats(text: string): { chapters: number; words: number; runtimeSec: number };
export type ChapterOutlineItem = {
  index: number;
  title: string;
  start: number;
  headingEnd: number;
  line: number;
  words: number;
};
export function parseChapterOutline(text: string): ChapterOutlineItem[];
export function chapterHeadingSnippet(text: string, caret: number, end?: number): string;
export function formatRuntimeClock(seconds: number): string;
export function validateScript(
  text: string,
  options?: { mappedNames?: string[]; profileIds?: string[] },
): { type: string; name?: string; title?: string; tag?: string }[];
export const AUDIOBOOK_WPM: number;
