import { GROVE_THEME, type ThemeColors, type ThemeDefinition } from './t3-palettes';

// Refined VoiceStudio/Tauri palette: original charcoal canvas and rose action,
// lavender text, plum surfaces, and quieter translucent borders.
// The light variant is a complementary adaptation; the original default is dark.
function colors(light: boolean): ThemeColors {
  const canvas = light ? '#faf6fc' : '#211c29';
  const chrome = light ? '#eee5f2' : '#191420';
  const surface = light ? '#fffbff' : '#302638';
  const text = light ? '#392c42' : '#eee5f4';
  const muted = light ? '#796784' : '#b8a5c3';
  const action = light ? '#8f3f71' : '#d3869b';
  const border = light ? 'rgb(100 65 125 / 15%)' : 'rgb(217 185 237 / 14%)';
  const hover = light ? '#eadff0' : '#403049';
  return {
    ...(light ? GROVE_THEME.colors : GROVE_THEME.variants!.dark!),
    canvas,
    chrome,
    toolbar: chrome,
    toolbarForeground: text,
    toolbarBorder: border,
    toolbarControl: surface,
    toolbarControlForeground: text,
    toolbarControlHover: hover,
    surface,
    surfaceRaised: light ? '#ffffff' : '#382c42',
    surfaceOverlay: light ? '#fffbff' : '#382c42',
    text,
    textMuted: muted,
    border,
    input: border,
    focus: action,
    accent: action,
    accentForeground: light ? '#ffffff' : '#1d2021',
    secondary: hover,
    secondaryForeground: text,
    muted: hover,
    mutedForeground: muted,
    placeholder: muted,
    secondaryLabel: muted,
    iconMuted: muted,
    error: light ? '#9d0006' : '#fb4934',
    errorForeground: light ? '#9d0006' : '#fb4934',
    errorSurface: surface,
    warning: light ? '#af3a03' : '#fabd2f',
    warningForeground: light ? '#af3a03' : '#fabd2f',
    warningSurface: surface,
    update: action,
    updateForeground: action,
    updateSurface: hover,
    accentSurface: hover,
    accentSurfaceForeground: text,
    messageSurface: surface,
    messageForeground: text,
    messageAction: action,
    messageActionForeground: light ? '#ffffff' : '#1d2021',
    messageActionHover: light ? '#7b305e' : '#b16286',
    codeBackground: chrome,
    codeForeground: text,
    sidebar: chrome,
    sidebarForeground: text,
    sidebarMutedForeground: muted,
    sidebarControlSurface: surface,
    sidebarRowHover: hover,
    sidebarRowActive: light ? '#e5d3ee' : '#50365c',
    sidebarRowSelected: surface,
    sidebarBorder: border,
    terminalBackground: canvas,
    terminalForeground: text,
    terminalCursor: action,
    terminalSelection: hover,
    terminalScrollbar: border,
    terminalScrollbarHover: muted,
  };
}
export const TAURI_THEME: ThemeDefinition = {
  id: 'heritage',
  label: 'VoiceStudio Classic',
  appearance: 'dark',
  colors: colors(false),
  variants: { light: colors(true) },
  sidebarArtwork: true,
};
