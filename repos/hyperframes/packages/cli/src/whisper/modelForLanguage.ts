/** The model whisper runs: a non-English language swaps an English-only `.en` model for its multilingual twin. */
export function initialModelForLanguage(model: string, language?: string): string {
  const baseLanguage = language?.trim().toLowerCase().split(/[-_]/, 1)[0];
  if (baseLanguage && baseLanguage !== "en" && model.endsWith(".en")) {
    return model.slice(0, -3);
  }
  return model;
}
