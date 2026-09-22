import { useEffect, useState } from 'react';
import { normalizeSetupReadiness, setupFallback, type SetupReadiness } from './model';

export function useSetupReadiness(): SetupReadiness {
  const [readiness, setReadiness] = useState<SetupReadiness>(setupFallback);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSetup(): Promise<void> {
      try {
        const response = await fetch('/api/setup', {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Setup endpoint unavailable');
        setReadiness(normalizeSetupReadiness(await response.json()));
      } catch {
        if (!controller.signal.aborted) setReadiness(setupFallback);
      }
    }

    void loadSetup();
    return () => controller.abort();
  }, []);

  return readiness;
}
