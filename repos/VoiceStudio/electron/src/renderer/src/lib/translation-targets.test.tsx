/**
 * #2810: Uyghur. OmniVoice speaks it and NLLB-200 / Google / LLM engines
 * translate into it, but Whisper cannot transcribe it, so it is a translation
 * target and never a speech-recognition source.
 */
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { LANG_CODES } from '@shared/utils/languages';
import { Textarea } from '@/components/ui/textarea';
import { languageOptions, languageSupported } from './language-options';
import {
  TRANSLATION_TARGET_LABELS,
  TRANSLATION_TARGETS,
  translationTargetCode,
} from './translation-targets';

it('offers Uyghur as a translation target only', () => {
  expect(translationTargetCode('Uyghur')).toBe('ug');
  expect(LANG_CODES.some((item) => item.code === 'ug')).toBe(false);
  expect(TRANSLATION_TARGETS).toHaveLength(LANG_CODES.length + 1);
  const at = TRANSLATION_TARGET_LABELS.indexOf('Uyghur');
  expect(TRANSLATION_TARGET_LABELS.slice(at - 1, at + 2)).toEqual(['Urdu', 'Uyghur', 'Uzbek']);
});

it('shows Uyghur with its native name and finds it by either spelling', () => {
  const [uyghur] = languageOptions(['Uyghur'], 'en', 'Auto');
  expect(uyghur.code).toBe('ug');
  expect(uyghur.native).toBe('ئۇيغۇرچە');
  expect(uyghur.search).toEqual(expect.arrayContaining(['uyghur', 'ug']));
  // The engine vocabulary spells it "Uighur"; both name the same language.
  expect(languageSupported('Uyghur', ['english', 'uighur'])).toBe(true);
  expect(languageSupported('Uyghur', ['english'])).toBe(false);
});

it('lets right-to-left script text set its own direction', () => {
  render(<Textarea aria-label="script" defaultValue="test" />);
  expect(screen.getByLabelText('script')).toHaveAttribute('dir', 'auto');
});
