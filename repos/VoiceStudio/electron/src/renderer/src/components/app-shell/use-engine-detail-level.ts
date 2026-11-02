import { useState } from 'react';

export const engineDetailLevels = ['simple', 'models', 'details'] as const;
export type EngineDetailLevel = (typeof engineDetailLevels)[number];
const storageKey = 'voicestudio.engine-detail-level';

export function useEngineDetailLevel() {
  const [level, setLevel] = useState<EngineDetailLevel>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return engineDetailLevels.includes(saved as EngineDetailLevel)
        ? (saved as EngineDetailLevel)
        : 'simple';
    } catch {
      return 'simple';
    }
  });
  const chooseLevel = (next: EngineDetailLevel) => {
    setLevel(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // Keep the control usable when persistent storage is unavailable.
    }
  };
  return { level, chooseLevel };
}
