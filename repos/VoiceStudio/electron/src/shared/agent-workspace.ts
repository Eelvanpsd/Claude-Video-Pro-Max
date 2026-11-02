export const agentFeatures = [
  'repair',
  'setup',
  'clone',
  'design',
  'dub',
  'transcribe',
  'stories',
  'audiobook',
  'workflows',
  'tools',
] as const;
export type AgentFeature = (typeof agentFeatures)[number];
export interface AgentChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const featureGuidance: Record<AgentFeature, string> = {
  repair: 'Diagnose app health, logs and runtime failures; restore operation and verify recovery.',
  setup:
    'Inspect local hardware and installed models. Choose a compatible performance preset and install or activate required engines only as requested. Preserve working user choices.',
  clone:
    'Create or use a saved voice profile, with a user-provided reference recording. Generate speech and verify the audio output.',
  design: 'Design a voice from the user brief and save a reusable profile.',
  dub: 'Prepare a dubbing project, transcribe, translate, fit segments and render the requested language.',
  transcribe: 'Transcribe a supplied recording using an installed compatible ASR model.',
  stories: 'Build a story with scenes and assigned character voices, then render it.',
  audiobook:
    'Create an audiobook from supplied text. Clean OCR headers, page numbers and broken line wraps while preserving wording. For a test, use only a few lines. Select an existing voice when authorized, generate a short preview, and verify the result before a full render.',
  workflows:
    'Configure and run the requested workflow through supported app routes. External calls require an explicit user request.',
  tools: 'Use supported local audio processing and conversion tools for the requested files.',
};

export function validateAgentWorkspace(request: {
  workspace?: unknown;
  features?: unknown;
  history?: unknown;
}): void {
  if (
    request.workspace !== undefined &&
    request.workspace !== 'app' &&
    request.workspace !== 'source'
  )
    throw new Error('Invalid agent workspace');
  if (
    request.features !== undefined &&
    (!Array.isArray(request.features) ||
      request.features.length > agentFeatures.length ||
      request.features.some((value) => !agentFeatures.includes(value)))
  )
    throw new Error('Invalid agent features');
  if (
    request.history !== undefined &&
    (!Array.isArray(request.history) ||
      request.history.length > 12 ||
      request.history.some(
        (message) =>
          !message ||
          !['user', 'assistant'].includes(message.role) ||
          typeof message.content !== 'string' ||
          message.content.length > 4000,
      ))
  )
    throw new Error('Invalid agent conversation');
}

export function agentUsesAppWorkspace(
  request: { workspace?: 'app' | 'source'; report: string },
  hasSource: boolean,
): boolean {
  return (
    request.workspace === 'app' ||
    (request.workspace !== 'source' &&
      !hasSource &&
      /^ACTION_REQUEST\s*:/i.test(request.report.trimStart()))
  );
}
