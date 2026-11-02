import { useRef, useState } from 'react';
export function useSettingsAction() {
  const pending = useRef(false);
  const attempt = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const run = async (work: () => Promise<void>, notify = true) => {
    if (pending.current) return;
    pending.current = true;
    const currentAttempt = ++attempt.current;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await work();
      setSaved(notify);
    } catch {
      setError(currentAttempt);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return {
    busy,
    error: error !== null,
    saved,
    run,
    reset: () => setSaved(false),
    // An async recovery may only clear the failure it observed, never one
    // produced by another save while recovery was in flight.
    clearError: () => setError((current) => (current === error ? null : current)),
  };
}
