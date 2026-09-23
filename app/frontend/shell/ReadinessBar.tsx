import type { StudioReadiness } from '../../domain/index';
import type { LoadState } from '../model/skill-view-model';

export function ReadinessBar({
  readiness,
  state,
}: {
  readiness: StudioReadiness;
  state: LoadState;
}) {
  const claudeReady = readiness.claude.available && readiness.claude.authenticated;
  return (
    <section className="readiness-bar" aria-label="Studio readiness" aria-live="polite">
      <div className="readiness-title">
        <strong>Local setup</strong>
      </div>
      <div className="readiness-items">
        <span data-state={claudeReady ? 'ready' : 'warning'}>
          Claude:{' '}
          {readiness.authLogin?.state === 'completed'
            ? 'sign-in refreshed'
            : readiness.authLogin?.state === 'running'
              ? 'sign-in in progress'
              : claudeReady
                ? 'account found'
                : 'sign-in required'}
        </span>
        <span data-state={readiness.database === 'ready' ? 'ready' : 'warning'}>
          Draft store: {readiness.database}
        </span>
        <span data-state={readiness.activeTests ? 'active' : 'neutral'}>
          Active tests: {readiness.activeTests}
        </span>
      </div>
      <p>
        {state === 'error'
          ? 'Readiness unavailable. Editing and demo browsing remain available.'
          : 'Live traces are not saved. Final results are saved on this computer.'}
      </p>
    </section>
  );
}
